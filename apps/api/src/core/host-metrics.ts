import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { HostStats } from '@dock/shared';
import { clampPct, humanBytes, humanDuration } from './format';

interface CpuSample {
  idle: number;
  total: number;
}

export interface MetricsPaths {
  procRoot: string;
  sysRoot: string;
  rootfs: string;
  hostMounted: boolean;
  /**
   * По какому пути считать место на диске. Это каталог раскладки: он
   * примонтирован с хоста, поэтому statfs по нему возвращает статистику
   * настоящей файловой системы — той самой, которая и кончается, когда
   * ставишь сервисы.
   */
  diskPath?: string;
}

/**
 * Метрики хоста, а не контейнера панели.
 *
 * Изнутри контейнера `/proc/meminfo` и `statfs('/')` показывают то, что видно
 * докеру: на машине с 64 ГБ панель уверенно рисовала 30, потому что столько
 * отдано виртуалке движка. Лечится только монтированием хостовых `/proc`,
 * `/sys` и корня — их пути ядро получает в `MetricsPaths`. Если хост не
 * примонтирован, метрики отдаются с пометкой `truthful: false`: лучше сказать
 * «вижу только контейнер», чем показать красивую неправду.
 *
 * Ограничения cgroup здесь сознательно игнорируются: `memory.max` контейнера
 * панели к железу отношения не имеет.
 */
export class HostMetrics {
  private prev: CpuSample | null = null;
  private cores = 0;

  constructor(private readonly paths: MetricsPaths) {}

  async read(): Promise<HostStats> {
    const [cpuPct, mem, disk, uptimeSeconds] = await Promise.all([
      this.cpu(),
      this.memory(),
      this.disk(),
      this.uptime(),
    ]);

    const cores = this.cores || os.cpus().length || 1;

    return {
      cpu: `${cpuPct}%`,
      cpuPct,
      cpuCores: cores,
      ram: `${humanBytes(mem.used)} / ${humanBytes(mem.total)}`,
      ramPct: clampPct(mem.total ? (mem.used / mem.total) * 100 : 0),
      disk: `${humanBytes(disk.used)} / ${humanBytes(disk.total)}`,
      diskPct: clampPct(disk.total ? (disk.used / disk.total) * 100 : 0),
      uptime: humanDuration(uptimeSeconds),
      uptimeSeconds,
      truthful: this.paths.hostMounted,
      note: this.paths.hostMounted
        ? undefined
        : 'хостовые /proc и корень не примонтированы — видно только то, что выделено докеру',
    };
  }

  private async cpu(): Promise<number> {
    const sample = (await this.procCpuSample()) ?? this.osCpuSample();
    const prev = this.prev;
    this.prev = sample;
    if (!prev) return 0;
    const totalDelta = sample.total - prev.total;
    const idleDelta = sample.idle - prev.idle;
    if (totalDelta <= 0) return 0;
    return clampPct(((totalDelta - idleDelta) / totalDelta) * 100);
  }

  private async procCpuSample(): Promise<CpuSample | null> {
    try {
      const raw = await fs.readFile(path.join(this.paths.procRoot, 'stat'), 'utf8');
      const lines = raw.split('\n');

      // строки cpu0..cpuN — по одной на ядро хоста
      this.cores = lines.filter((l) => /^cpu\d+ /.test(l)).length;

      const line = lines.find((l) => l.startsWith('cpu '));
      if (!line) return null;
      const parts = line.trim().split(/\s+/).slice(1).map(Number);
      if (parts.length < 4) return null;
      const total = parts.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
      const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
      return { idle, total };
    } catch {
      return null;
    }
  }

  private osCpuSample(): CpuSample {
    let idle = 0;
    let total = 0;
    const cpus = os.cpus();
    this.cores = cpus.length;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    return { idle, total };
  }

  private async memory(): Promise<{ used: number; total: number }> {
    try {
      const raw = await fs.readFile(path.join(this.paths.procRoot, 'meminfo'), 'utf8');
      const grab = (key: string): number => {
        const match = raw.match(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm'));
        return match ? Number(match[1]) * 1024 : 0;
      };
      const total = grab('MemTotal');
      const available = grab('MemAvailable');
      if (total > 0 && available > 0) return { used: total - available, total };
    } catch {
      /* нет procfs — считаем через os */
    }
    const total = os.totalmem();
    return { used: total - os.freemem(), total };
  }

  private async disk(): Promise<{ used: number; total: number }> {
    for (const target of [this.paths.diskPath, this.paths.rootfs, '/']) {
      if (!target) continue;
      const usage = await statfsUsage(target);
      if (usage.total > 0) return usage;
    }
    return { used: 0, total: 0 };
  }

  private async uptime(): Promise<number> {
    try {
      const raw = await fs.readFile(path.join(this.paths.procRoot, 'uptime'), 'utf8');
      const seconds = Number(raw.split(/\s+/)[0]);
      if (Number.isFinite(seconds)) return Math.floor(seconds);
    } catch {
      /* нет procfs */
    }
    return Math.floor(os.uptime());
  }
}

async function statfsUsage(target: string): Promise<{ used: number; total: number }> {
  try {
    const st = await fs.statfs(target);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    return { used: Math.max(0, total - free), total };
  } catch {
    return { used: 0, total: 0 };
  }
}

/** Заполненность файловой системы, на которой лежит каталог стека. */
export async function volumeFillPct(pathname: string): Promise<number> {
  const { used, total } = await statfsUsage(pathname);
  if (!total) return 0;
  return clampPct((used / total) * 100);
}

/** Сколько занимает каталог на диске. Считается по дереву, без внешних утилит. */
export async function dirSize(target: string, budget = 20000): Promise<number> {
  let total = 0;
  let seen = 0;

  const walk = async (dir: string): Promise<void> => {
    if (seen > budget) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (seen > budget) return;
      seen += 1;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          total += (await fs.stat(full)).size;
        } catch {
          /* файл исчез между readdir и stat */
        }
      }
    }
  };

  await walk(target);
  return total;
}
