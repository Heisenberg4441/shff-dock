import path from 'node:path';
import { parse } from 'yaml';
import type {
  ContainerRef,
  DriverInfo,
  HostStats,
  Service,
  ServiceStatus,
  StackManifest,
  StackValues,
} from '@dock/shared';
import type { Config } from '../../config';
import type { DockerDriver, DriverContext, ProgressFn } from '../driver';
import { DriverError, NotFoundError } from '../driver';
import { clampPct, humanBytes, humanDuration, usageLabel } from '../format';
import type { Registry } from '../stacks/registry';
import { activeProfiles, maskSecrets, resolveValues, secretKeys } from '../stacks/values';

interface MockContainer {
  service: string;
  image: string;
  port: string;
  cpu: number;
  memBytes: number;
  status: ServiceStatus;
  startedAt: number | null;
}

interface MockStack {
  id: string;
  manifest: StackManifest;
  values: StackValues;
  secrets: string[];
  containers: MockContainer[];
}

/** Фоновый шум в журнал — чтобы поток выглядел живым. */
const CHATTER = [
  'GET / 200 · 4ms',
  'heartbeat ok',
  'scrape completed · 128 series',
  'session refreshed',
  'compaction finished',
  'client connected · 192.168.1.31',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/**
 * Выдуманный хост в памяти процесса.
 *
 * Нужен, чтобы панель можно было разрабатывать и показывать на машине, где
 * докера нет вовсе. Работает по тем же манифестам, что и настоящий драйвер:
 * стек из трёх сервисов и в моке будет стеком из трёх контейнеров, а не
 * одной строчкой, — иначе mock перестанет ловить ошибки вёрстки.
 */
export class MockDriver implements DockerDriver {
  readonly kind = 'mock' as const;

  private stacks = new Map<string, MockStack>();
  private ctx!: DriverContext;
  private chatter: NodeJS.Timeout | null = null;
  private readonly bootedAt = Date.now() - 31 * 86400 * 1000;
  private readonly totalRam = 64 * 1024 ** 3;

  constructor(
    private readonly config: Config,
    private readonly registry: Registry,
  ) {}

  async init(ctx: DriverContext): Promise<void> {
    this.ctx = ctx;
    ctx.log('dock', 'mock-драйвер поднят · хост выдуманный, докер не трогаем', 'dim');

    // ставим несколько стеков из реестра, чтобы панель не пустовала
    for (const entry of this.registry.list().slice(0, 3)) {
      try {
        const manifest = await this.registry.manifest(entry.id);
        this.stacks.set(entry.id, await this.build(manifest, {}));
        ctx.log(entry.id, `стек поднят · ${manifest.name} ${manifest.version}`, 'ok');
      } catch (err) {
        ctx.log('dock', `не собрать демо-стек ${entry.id}: ${describe(err)}`, 'warn');
      }
    }

    this.chatter = setInterval(() => {
      const running = [...this.stacks.values()].flatMap((s) =>
        s.containers.filter((c) => c.status === 'running').map((c) => ({ stack: s.id, c })),
      );
      if (!running.length) return;
      const target = pick(running);
      this.ctx.log(target.stack, `${target.c.service}: ${pick(CHATTER)}`, 'dim');
    }, 4200);
  }

  async info(): Promise<DriverInfo> {
    return {
      driver: 'mock',
      version: 'mock 0.9.2',
      connected: true,
      message: 'докер не подключён — данные синтетические',
      composeVersion: 'mock',
      root: this.config.paths.root,
    };
  }

  async list(): Promise<Service[]> {
    return [...this.stacks.values()].map((stack) => this.present(stack));
  }

  async start(id: string): Promise<void> {
    const stack = this.require(id);
    for (const container of stack.containers) {
      if (container.status === 'running') continue;
      container.status = 'running';
      container.startedAt = Date.now();
      container.cpu = 2 + Math.random() * 8;
      container.memBytes = (60 + Math.random() * 300) * 1024 ** 2;
    }
    this.ctx.log(id, 'стек запущен', 'ok');
    this.ctx.changed();
  }

  async stop(id: string): Promise<void> {
    const stack = this.require(id);
    for (const container of stack.containers) {
      container.status = 'stopped';
      container.startedAt = null;
      container.cpu = 0;
      container.memBytes = 0;
    }
    this.ctx.log(id, 'стек остановлен', 'warn');
    this.ctx.changed();
  }

  async restart(id: string, progress?: ProgressFn): Promise<void> {
    const stack = this.require(id);
    for (const container of stack.containers) container.status = 'updating';
    this.ctx.log(id, 'перезапускаю контейнеры …', 'warn');
    this.ctx.changed();
    progress?.(50, 'перезапускаю контейнеры …');
    await sleep(1200);
    await this.start(id);
  }

  async pull(id: string, progress: ProgressFn): Promise<void> {
    const stack = this.require(id);
    for (const container of stack.containers) container.status = 'updating';
    this.ctx.changed();
    for (let pct = 10; pct < 90; pct += 16) {
      progress(pct, 'тяну образы …');
      await sleep(260);
    }
    progress(92, 'пересоздаю на новых образах …');
    await sleep(300);
    await this.start(id);
    progress(100, 'образы свежие');
    this.ctx.log(id, 'образы обновлены', 'ok');
  }

  async installStack(stackId: string, values: StackValues, progress: ProgressFn): Promise<void> {
    if (this.stacks.has(stackId)) {
      throw new DriverError(`стек ${stackId} уже стоит на хосте`, 409, 'already_exists');
    }
    const manifest = await this.registry.manifest(stackId);

    const steps = [
      'читаю манифест …',
      'раскладываю файлы стека …',
      'тяну образы …',
      'создаю каталоги данных …',
      'поднимаю контейнеры …',
    ];
    for (let i = 0; i < steps.length; i += 1) {
      progress(Math.round(((i + 1) / (steps.length + 1)) * 100), steps[i] as string);
      await sleep(420);
    }

    this.stacks.set(stackId, await this.build(manifest, values));
    progress(100, 'готово');
    this.ctx.log(stackId, `стек поднят · ${manifest.name} ${manifest.version}`, 'ok');
    this.ctx.changed();
  }

  async applyStackValues(id: string, values: StackValues, progress: ProgressFn): Promise<void> {
    const stack = this.require(id);
    progress(30, 'переписываю конфиги …');
    await sleep(400);
    const resolved = resolveValues(stack.manifest, values, this.context(id));
    stack.values = maskSecrets(resolved, stack.secrets);
    progress(70, 'пересоздаю изменившееся …');
    await sleep(500);
    progress(100, 'готово');
    this.ctx.log(id, 'конфиг применён', 'ok');
    this.ctx.changed();
  }

  async removeStack(id: string, progress: ProgressFn, purge = false): Promise<void> {
    this.require(id);
    progress(40, 'снимаю контейнеры …');
    await sleep(400);
    this.stacks.delete(id);
    progress(100, 'готово');
    this.ctx.log(id, purge ? 'стек удалён вместе с данными' : 'стек снят · данные остались', 'err');
    this.ctx.changed();
  }

  async host(): Promise<HostStats> {
    const drift = (base: number, spread: number) => clampPct(base + (Math.random() - 0.5) * spread);
    const cpuPct = drift(23, 8);
    const ramPct = drift(29, 4);
    const uptimeSeconds = Math.floor((Date.now() - this.bootedAt) / 1000);
    return {
      cpu: `${cpuPct}%`,
      cpuPct,
      cpuCores: 16,
      ram: `${humanBytes(this.totalRam * (ramPct / 100))} / ${humanBytes(this.totalRam)}`,
      ramPct,
      disk: '1.8 TB / 4.0 TB',
      diskPct: 45,
      uptime: humanDuration(uptimeSeconds),
      uptimeSeconds,
      truthful: true,
    };
  }

  async dispose(): Promise<void> {
    if (this.chatter) clearInterval(this.chatter);
  }

  // ── внутреннее ────────────────────────────────────────────────────────────

  private context(id: string) {
    const settings = this.ctx.settings();
    const dir = path.posix.join(this.config.paths.stacks, id);
    return {
      DOCK_STACK_ID: id,
      DOCK_STACK_DIR: dir,
      DOCK_DATA_DIR: path.posix.join(dir, 'data'),
      DOCK_NETWORK: this.config.docker.network,
      DOCK_TZ: settings.tz,
      DOCK_DOMAIN: settings.domain,
      DOCK_HOSTNAME: settings.hostname,
      DOCK_PUID: String(this.config.docker.puid),
      DOCK_PGID: String(this.config.docker.pgid),
    };
  }

  /**
   * Собирает выдуманный стек по манифесту: по контейнеру на сервис compose.
   * Compose-файл читается из реестра по-настоящему — иначе стек из пяти
   * сервисов выглядел бы в моке одной строчкой и перестал бы ловить ошибки
   * вёрстки списка контейнеров.
   */
  private async build(manifest: StackManifest, provided: StackValues): Promise<MockStack> {
    const values = resolveValues(manifest, provided, this.context(manifest.id));
    const profiles = new Set(activeProfiles(manifest, values));

    const compose = await this.composeOf(manifest);

    const containers: MockContainer[] = Object.entries(compose.services ?? {})
      .filter(([, svc]) => !svc.profiles?.length || svc.profiles.some((p) => profiles.has(p)))
      .map(([service, svc]) => {
        const portSpec = svc.ports?.[0] ?? '';
        const hostPort = this.resolvePort(portSpec, values);
        return {
          service,
          image: this.resolve(svc.image ?? `${service}:latest`, values),
          port: hostPort ? `:${hostPort}` : '—',
          cpu: 2 + Math.random() * 12,
          memBytes: (60 + Math.random() * 400) * 1024 ** 2,
          status: 'running' as ServiceStatus,
          startedAt: Date.now() - Math.floor(Math.random() * 6 * 3600 * 1000),
        };
      });

    return {
      id: manifest.id,
      manifest,
      values: maskSecrets(values, secretKeys(manifest)),
      secrets: secretKeys(manifest),
      containers: containers.length ? containers : [this.placeholder(manifest)],
    };
  }

  private async composeOf(manifest: StackManifest): Promise<{
    services?: Record<string, { image?: string; ports?: string[]; profiles?: string[] }>;
  }> {
    if (typeof manifest.compose !== 'string') {
      return manifest.compose as { services?: Record<string, never> };
    }
    try {
      const raw = await this.registry.file(manifest.id, manifest.compose);
      return (parse(raw) ?? {}) as { services?: Record<string, never> };
    } catch {
      return {};
    }
  }

  private placeholder(manifest: StackManifest): MockContainer {
    return {
      service: manifest.id,
      image: `${manifest.id}:latest`,
      port: '—',
      cpu: 3,
      memBytes: 120 * 1024 ** 2,
      status: 'running',
      startedAt: Date.now(),
    };
  }

  private resolve(text: string, values: StackValues): string {
    return text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) =>
      values[key] !== undefined ? String(values[key]) : match,
    );
  }

  private resolvePort(spec: string, values: StackValues): string {
    const resolved = this.resolve(spec, values);
    const host = resolved.split(':')[0] ?? '';
    return /^\d+$/.test(host) ? host : '';
  }

  private require(id: string): MockStack {
    const stack = this.stacks.get(id);
    if (!stack) throw new NotFoundError(id);
    return stack;
  }

  private present(stack: MockStack): Service {
    const containers: ContainerRef[] = stack.containers.map((c) => ({
      id: `mock-${stack.id}-${c.service}`,
      service: c.service,
      name: `${stack.id}-${c.service}-1`,
      image: c.image,
      status: c.status,
      cpu: clampPct(c.cpu),
      mem: clampPct((c.memBytes / this.totalRam) * 100 * 20),
      usage: c.status === 'running' ? usageLabel(c.cpu, c.memBytes) : '— / —',
      uptime: c.startedAt ? humanDuration((Date.now() - c.startedAt) / 1000) : '—',
      port: c.port,
    }));

    const running = containers.filter((c) => c.status === 'running').length;
    let status: ServiceStatus;
    if (containers.some((c) => c.status === 'updating')) status = 'updating';
    else if (running === containers.length && running > 0) status = 'running';
    else if (running === 0) status = 'stopped';
    else status = 'error';

    const primaryName = stack.manifest.primary ?? containers[0]?.service;
    const primary = containers.find((c) => c.service === primaryName) ?? containers[0];

    const cpu = clampPct(stack.containers.reduce((sum, c) => sum + c.cpu, 0));
    const memBytes = stack.containers.reduce((sum, c) => sum + c.memBytes, 0);
    const oldest = stack.containers
      .map((c) => c.startedAt)
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b)[0];

    const domain = stack.values.DOMAIN ?? stack.values.SUBDOMAIN;

    return {
      kind: 'stack',
      stackId: stack.id,
      version: stack.manifest.version,
      containers,
      id: stack.id,
      name: stack.manifest.name,
      desc: stack.manifest.summary,
      port: primary?.port ?? '—',
      status,
      cpu,
      mem: clampPct((memBytes / this.totalRam) * 100 * 20),
      vol: 20 + (stack.id.length % 5) * 12,
      usage: running ? usageLabel(cpu, memBytes) : '— / —',
      uptime: oldest && running ? humanDuration((Date.now() - oldest) / 1000) : '—',
      image: primary?.image ?? '—',
      domain: domain ? String(domain) : '—',
      volume: path.posix.join(this.config.paths.stacks, stack.id),
      restart: 'unless-stopped',
      autostart: true,
      backup: true,
      env: Object.entries(stack.values)
        .filter(([key]) => !key.startsWith('DOCK_'))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('\n'),
      containerId: primary?.id ?? null,
      managed: true,
    };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
