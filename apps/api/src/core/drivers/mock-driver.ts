import type { DriverInfo, HostStats, Service, ServiceConfig } from '@dock/shared';
import type { CreateServiceSpec, DockerDriver, DriverContext, ProgressFn } from '../driver';
import { NotFoundError } from '../driver';
import { clampPct, humanDuration, usageLabel } from '../format';

/**
 * Выдуманный хост в памяти процесса.
 *
 * Нужен, чтобы панель можно было разрабатывать и показывать на машине,
 * где докера нет вовсе. Повторяет поведение живого драйвера: операции не
 * мгновенные, статусы проходят через `updating`, контейнеры шумят в журнал.
 */

interface MockService extends Service {
  /** Момент запуска, от него считается uptime. */
  startedAt: number | null;
  memBytes: number;
}

const SEED: Array<Omit<MockService, 'uptime' | 'usage'>> = [
  {
    id: 'jellyfin',
    name: 'jellyfin',
    desc: 'Медиасервер · транскод на iGPU',
    port: ':8096',
    status: 'running',
    cpu: 18,
    mem: 34,
    vol: 62,
    memBytes: 1.4 * 1024 ** 3,
    image: 'jellyfin/jellyfin:10.9.6',
    domain: 'media',
    volume: 'dock/jellyfin',
    restart: 'unless-stopped',
    autostart: true,
    backup: true,
    env: 'JELLYFIN_PublishedServerUrl=https://media.home.lan\nTZ=Europe/Belgrade',
    containerId: 'mock-jellyfin',
    managed: true,
    startedAt: Date.now() - 12 * 86400 * 1000,
  },
  {
    id: 'caddy',
    name: 'caddy',
    desc: 'Reverse proxy · автосертификаты',
    port: ':443',
    status: 'running',
    cpu: 3,
    mem: 9,
    vol: 4,
    memBytes: 82 * 1024 ** 2,
    image: 'caddy:2.8-alpine',
    domain: '—',
    volume: 'dock/caddy',
    restart: 'always',
    autostart: true,
    backup: true,
    env: 'ACME_AGREE=true\nTZ=Europe/Belgrade',
    containerId: 'mock-caddy',
    managed: true,
    startedAt: Date.now() - 31 * 86400 * 1000,
  },
  {
    id: 'restic',
    name: 'restic',
    desc: 'Бэкапы · cron 03:00',
    port: '—',
    status: 'updating',
    cpu: 41,
    mem: 22,
    vol: 78,
    memBytes: 610 * 1024 ** 2,
    image: 'restic/restic:0.16',
    domain: '—',
    volume: 'dock/restic',
    restart: 'on-failure',
    autostart: true,
    backup: false,
    env: 'RESTIC_REPOSITORY=/srv/backup\nTZ=Europe/Belgrade',
    containerId: 'mock-restic',
    managed: true,
    startedAt: Date.now() - 6 * 3600 * 1000,
  },
  {
    id: 'vaultwarden',
    name: 'vaultwarden',
    desc: 'Пароли · веб-хранилище',
    port: ':8222',
    status: 'running',
    cpu: 2,
    mem: 7,
    vol: 11,
    memBytes: 96 * 1024 ** 2,
    image: 'vaultwarden/server:1.32',
    domain: 'vault',
    volume: 'dock/vault',
    restart: 'unless-stopped',
    autostart: true,
    backup: true,
    env: 'SIGNUPS_ALLOWED=false\nTZ=Europe/Belgrade',
    containerId: 'mock-vaultwarden',
    managed: true,
    startedAt: Date.now() - 31 * 86400 * 1000,
  },
  {
    id: 'immich',
    name: 'immich',
    desc: 'Фотоархив · индексация',
    port: ':2283',
    status: 'stopped',
    cpu: 0,
    mem: 0,
    vol: 44,
    memBytes: 0,
    image: 'ghcr.io/immich-app/server:v1.118',
    domain: 'photos',
    volume: 'dock/immich',
    restart: 'unless-stopped',
    autostart: false,
    backup: true,
    env: 'DB_PASSWORD=•••••••\nTZ=Europe/Belgrade',
    containerId: 'mock-immich',
    managed: true,
    startedAt: null,
  },
];

/** Фоновый шум в журнал — то же, что имитировал прототип. */
const CHATTER: Record<string, string[]> = {
  jellyfin: [
    'playback started · 1080p direct play',
    'library scan · 0 new items',
    'client connected · 192.168.1.31',
  ],
  caddy: ['GET /  200 · 4ms', 'GET /api/status  200 · 2ms', 'tls handshake ok'],
  vaultwarden: ['vault synced · 0 conflicts', 'session refreshed'],
  restic: ['scanning /srv/data …', 'chunker: 2.1 GB processed'],
  immich: ['thumbnail job queued'],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T;

export class MockDriver implements DockerDriver {
  readonly kind = 'mock' as const;

  private services: MockService[] = SEED.map((s) => ({ ...s, uptime: '—', usage: '— / —' }));
  private ctx!: DriverContext;
  private chatter: NodeJS.Timeout | null = null;
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly bootedAt = Date.now() - 31 * 86400 * 1000;

  async init(ctx: DriverContext): Promise<void> {
    this.ctx = ctx;
    ctx.log('dock', 'mock-драйвер поднят · хост выдуманный, докер не трогаем', 'dim');
    ctx.log('restic', 'snapshot 8f21ac saved · 4.2 GB', 'dim');
    ctx.log('caddy', 'certificate renewed for media.home.lan', 'ok');
    ctx.log('jellyfin', 'library scan finished · 1 284 items', 'info');
    ctx.log('vaultwarden', 'failed login from 192.168.1.44', 'warn');

    this.chatter = setInterval(() => {
      const running = this.services.filter((s) => s.status === 'running');
      if (!running.length) return;
      const svc = pick(running);
      const pool = CHATTER[svc.id] ?? ['heartbeat ok'];
      this.ctx.log(svc.id, pick(pool), 'dim');
    }, 4200);
  }

  async info(): Promise<DriverInfo> {
    return {
      driver: 'mock',
      version: 'mock 0.9.2',
      connected: true,
      message: 'докер не подключён — данные синтетические',
    };
  }

  async list(): Promise<Service[]> {
    return this.services.map((s) => this.present(s));
  }

  async start(id: string): Promise<void> {
    const svc = this.require(id);
    if (svc.status === 'running') return;
    svc.status = 'running';
    svc.startedAt = Date.now();
    svc.cpu = 4;
    svc.mem = 12;
    svc.memBytes = 120 * 1024 ** 2;
    this.ctx.log(svc.id, `container started · ${svc.port}`, 'ok');
    this.ctx.changed();
  }

  async stop(id: string): Promise<void> {
    const svc = this.require(id);
    if (svc.status === 'stopped') return;
    svc.status = 'stopped';
    svc.startedAt = null;
    svc.cpu = 0;
    svc.mem = 0;
    svc.memBytes = 0;
    this.ctx.log(svc.id, 'container stopped', 'warn');
    this.ctx.changed();
  }

  async restart(id: string): Promise<void> {
    const svc = this.require(id);
    svc.status = 'updating';
    this.ctx.log(svc.id, 'restarting …', 'warn');
    this.ctx.changed();
    await this.delay(1200);
    svc.status = 'running';
    svc.startedAt = Date.now();
    this.ctx.log(svc.id, `container started · ${svc.port}`, 'ok');
    this.ctx.changed();
  }

  async pull(id: string, onProgress: ProgressFn): Promise<void> {
    const svc = this.require(id);
    const wasRunning = svc.status === 'running';
    svc.status = 'updating';
    this.ctx.log(svc.id, `pulling ${svc.image} …`, 'dim');
    this.ctx.changed();
    for (let pct = 10; pct < 100; pct += 18) {
      onProgress(pct, `слой ${Math.ceil(pct / 18)} из 5 …`);
      await this.delay(260);
    }
    svc.status = wasRunning ? 'running' : 'stopped';
    onProgress(100, 'образ на свежем теге');
    this.ctx.log(svc.id, 'image up to date', 'ok');
    this.ctx.changed();
  }

  async remove(id: string): Promise<void> {
    const svc = this.require(id);
    this.services = this.services.filter((s) => s.id !== id);
    this.ctx.log(svc.id, 'container removed', 'err');
    this.ctx.changed();
  }

  async create(spec: CreateServiceSpec, onProgress: ProgressFn): Promise<Service> {
    const steps = [
      'подтягиваю образ …',
      'создаю том …',
      'поднимаю контейнер …',
      'прописываю маршрут в caddy …',
    ];
    for (let i = 0; i < steps.length; i += 1) {
      onProgress(Math.round(((i + 1) / (steps.length + 1)) * 100), steps[i] as string);
      await this.delay(420);
    }
    const svc: MockService = {
      id: spec.id,
      name: spec.name,
      desc: spec.desc,
      port: spec.hostPort ? `:${spec.hostPort}` : '—',
      status: 'running',
      cpu: 6,
      mem: 14,
      vol: 8,
      memBytes: 180 * 1024 ** 2,
      uptime: '0 минут',
      usage: '6% / 180 MB',
      image: spec.image,
      domain: spec.domain,
      volume: spec.volume,
      restart: spec.restart,
      autostart: spec.autostart,
      backup: spec.backup,
      env: spec.env,
      containerId: `mock-${spec.id}`,
      managed: true,
      startedAt: Date.now(),
    };
    this.services.push(svc);
    onProgress(100, 'готово');
    this.ctx.log(spec.id, `container created · ${svc.port}`, 'ok');
    this.ctx.changed();
    return this.present(svc);
  }

  async applyConfig(id: string, cfg: ServiceConfig, onProgress: ProgressFn): Promise<void> {
    const svc = this.require(id);
    onProgress(20, 'останавливаю контейнер …');
    await this.delay(300);
    svc.port = cfg.port ? `:${cfg.port}` : '—';
    svc.domain = cfg.domain;
    svc.volume = cfg.volume;
    svc.restart = cfg.restart;
    svc.env = cfg.env;
    svc.autostart = cfg.autostart;
    svc.backup = cfg.backup;
    onProgress(70, 'пересоздаю с новыми параметрами …');
    await this.delay(400);
    if (svc.status === 'running') svc.startedAt = Date.now();
    onProgress(100, 'готово');
    this.ctx.log(svc.id, 'config applied · recreating container', 'ok');
    this.ctx.changed();
  }

  async host(): Promise<HostStats> {
    // лёгкий дрейф вокруг значений прототипа, чтобы графики не выглядели мёртвыми
    const drift = (base: number, spread: number) =>
      clampPct(base + (Math.random() - 0.5) * spread);
    const cpuPct = drift(23, 8);
    const ramPct = drift(29, 4);
    const uptimeSeconds = Math.floor((Date.now() - this.bootedAt) / 1000);
    return {
      cpu: `${cpuPct}%`,
      cpuPct,
      ram: `${((ramPct / 100) * 32).toFixed(1)} / 32 GB`,
      ramPct,
      disk: '1.8 / 4 TB',
      diskPct: 45,
      uptime: humanDuration(uptimeSeconds),
      uptimeSeconds,
    };
  }

  async dispose(): Promise<void> {
    if (this.chatter) clearInterval(this.chatter);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private require(id: string): MockService {
    const svc = this.services.find((s) => s.id === id);
    if (!svc) throw new NotFoundError(id);
    return svc;
  }

  /** Пересчитывает производные подписи прямо перед отдачей наружу. */
  private present(svc: MockService): Service {
    const uptime = svc.startedAt ? humanDuration((Date.now() - svc.startedAt) / 1000) : '—';
    const usage = svc.status === 'running' ? usageLabel(svc.cpu, svc.memBytes) : '— / —';
    const { startedAt: _startedAt, memBytes: _memBytes, ...rest } = svc;
    return { ...rest, uptime, usage };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        resolve();
      }, ms);
      this.timers.add(t);
    });
  }
}

export { sleep };
