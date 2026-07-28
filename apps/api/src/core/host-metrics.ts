import fs from 'node:fs/promises';
import os from 'node:os';
import type { HostStats } from '@dock/shared';
import { clampPct, humanBytes, humanDuration } from './format';

interface CpuSample {
  idle: number;
  total: number;
}

/**
 * Метрики хоста. В контейнере панели /proc виден хостовый (пространство имён
 * PID не изолирует /proc/stat при обычном запуске), поэтому читаем его напрямую,
 * а на системах без procfs — например, при разработке под Windows — молча
 * откатываемся на модуль os.
 */
export class HostMetrics {
  private prev: CpuSample | null = null;

  constructor(private readonly rootPath: string) {}

  async read(): Promise<HostStats> {
    const [cpuPct, mem, disk, uptimeSeconds] = await Promise.all([
      this.cpu(),
      this.memory(),
      this.disk(),
      this.uptime(),
    ]);

    return {
      cpu: `${cpuPct}%`,
      cpuPct,
      ram: `${humanBytes(mem.used)} / ${humanBytes(mem.total)}`,
      ramPct: clampPct(mem.total ? (mem.used / mem.total) * 100 : 0),
      disk: `${humanBytes(disk.used)} / ${humanBytes(disk.total)}`,
      diskPct: clampPct(disk.total ? (disk.used / disk.total) * 100 : 0),
      uptime: humanDuration(uptimeSeconds),
      uptimeSeconds,
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
      const raw = await fs.readFile('/proc/stat', 'utf8');
      const line = raw.split('\n').find((l) => l.startsWith('cpu '));
      if (!line) return null;
      const parts = line.trim().split(/\s+/).slice(1).map(Number);
      if (parts.length < 4) return null;
      const total = parts.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
      // idle + iowait
      const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
      return { idle, total };
    } catch {
      return null;
    }
  }

  private osCpuSample(): CpuSample {
    let idle = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    return { idle, total };
  }

  private async memory(): Promise<{ used: number; total: number }> {
    try {
      const raw = await fs.readFile('/proc/meminfo', 'utf8');
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
    try {
      const st = await fs.statfs(this.rootPath);
      const total = Number(st.blocks) * Number(st.bsize);
      const free = Number(st.bavail) * Number(st.bsize);
      return { used: Math.max(0, total - free), total };
    } catch {
      return { used: 0, total: 0 };
    }
  }

  private async uptime(): Promise<number> {
    try {
      const raw = await fs.readFile('/proc/uptime', 'utf8');
      const seconds = Number(raw.split(/\s+/)[0]);
      if (Number.isFinite(seconds)) return Math.floor(seconds);
    } catch {
      /* нет procfs */
    }
    return Math.floor(os.uptime());
  }
}

/** Заполненность файловой системы, на которой лежит том сервиса. */
export async function volumeFillPct(pathname: string): Promise<number> {
  try {
    const st = await fs.statfs(pathname);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    if (!total) return 0;
    return clampPct(((total - free) / total) * 100);
  } catch {
    return 0;
  }
}
