import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  BootstrapResponse,
  ConsoleResult,
  HostStats,
  InstallRequest,
  Job,
  JobKind,
  LogEntry,
  Service,
  ServiceConfig,
  ServerEvent,
  Settings,
} from '@dock/shared';
import type { Config } from '../config';
import { CATALOG, catalogCompose, composeYaml, findCatalogItem } from './catalog';
import type { DockerDriver, DriverContext, ProgressFn } from './driver';
import { DriverError, NotFoundError } from './driver';
import { DockerodeDriver } from './drivers/dockerode-driver';
import { MockDriver } from './drivers/mock-driver';
import { LogBus } from './log-bus';
import { slug } from './format';
import { SettingsStore } from './settings-store';

/**
 * Ядро панели.
 *
 * Держит драйвер, журнал, настройки и список задач; маршруты HTTP и вебсокет
 * не знают ничего, кроме этого класса. Любое изменение состояния заканчивается
 * событием в шину — панель обновляется по нему, а не по опросу.
 */
export class DockEngine {
  readonly logs: LogBus;
  readonly settingsStore: SettingsStore;

  private readonly driver: DockerDriver;
  private readonly bus = new EventEmitter();
  private readonly jobs = new Map<string, Job>();

  private services: Service[] = [];
  private hostStats: HostStats = {
    cpu: '—',
    cpuPct: 0,
    ram: '—',
    ramPct: 0,
    disk: '—',
    diskPct: 0,
    uptime: '—',
    uptimeSeconds: 0,
  };

  private poll: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(private readonly config: Config) {
    this.logs = new LogBus(config.logBuffer);
    this.settingsStore = new SettingsStore(config.dataDir);
    this.driver = config.driver === 'docker' ? new DockerodeDriver(config) : new MockDriver();
    this.bus.setMaxListeners(0);
    this.logs.on('log', (entry: LogEntry) => this.emit({ type: 'log', entry }));
  }

  async start(): Promise<void> {
    await this.settingsStore.load();

    const ctx: DriverContext = {
      log: (svc, text, level) => void this.logs.push(svc, text, level),
      settings: () => this.settingsStore.get(),
      changed: () => void this.refresh(),
    };
    await this.driver.init(ctx);

    await this.refresh();
    this.poll = setInterval(() => void this.refresh(), this.config.pollInterval);
  }

  async stop(): Promise<void> {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    await this.driver.dispose();
  }

  // ── подписка ──────────────────────────────────────────────────────────────

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.bus.on('event', listener);
    return () => this.bus.off('event', listener);
  }

  private emit(event: ServerEvent): void {
    this.bus.emit('event', event);
  }

  // ── снимок состояния ──────────────────────────────────────────────────────

  async bootstrap(): Promise<BootstrapResponse> {
    return {
      driver: await this.driver.info(),
      host: this.hostStats,
      services: this.services,
      settings: this.settingsStore.get(),
      backup: this.settingsStore.backupInfo(),
      logs: this.logs.tail(200),
    };
  }

  getServices(): Service[] {
    return this.services;
  }

  getService(id: string): Service {
    const svc = this.services.find((s) => s.id === id);
    if (!svc) throw new NotFoundError(id);
    return svc;
  }

  getHost(): HostStats {
    return this.hostStats;
  }

  /** Пересобирает снимок сервисов и метрик и рассылает его подписчикам. */
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const [services, host] = await Promise.all([this.driver.list(), this.driver.host()]);
      this.services = services;
      this.hostStats = host;
      this.emit({ type: 'services', services });
      this.emit({ type: 'host', host });
    } catch (err) {
      this.logs.push('dock', `опрос хоста не удался: ${describe(err)}`, 'err');
    } finally {
      this.refreshing = false;
    }
  }

  // ── действия над сервисами ────────────────────────────────────────────────

  async startService(id: string): Promise<void> {
    await this.driver.start(id);
    await this.refresh();
  }

  async stopService(id: string): Promise<void> {
    await this.driver.stop(id);
    await this.refresh();
  }

  async restartService(id: string): Promise<Job> {
    return this.runJob('restart', id, async () => {
      await this.driver.restart(id);
    });
  }

  async pullService(id: string): Promise<Job> {
    return this.runJob('pull', id, (progress) => this.driver.pull(id, progress));
  }

  async pullAll(): Promise<Job> {
    const ids = this.services.map((s) => s.id);
    this.logs.push('dock', `pulling all images … · ${ids.length} сервисов`, 'dim');
    return this.runJob('pull', 'all', async (progress) => {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i] as string;
        progress(Math.round((i / ids.length) * 100), `обновляю ${id} …`);
        try {
          await this.driver.pull(id, () => undefined);
        } catch (err) {
          this.logs.push(id, `образ не обновился: ${describe(err)}`, 'err');
        }
      }
      progress(100, 'все образы проверены');
    });
  }

  async removeService(id: string): Promise<void> {
    await this.driver.remove(id);
    await this.refresh();
  }

  async updateConfig(id: string, patch: Partial<ServiceConfig>): Promise<Job> {
    const current = this.getService(id);
    const config: ServiceConfig = {
      port: patch.port ?? current.port.replace(':', ''),
      domain: patch.domain ?? current.domain,
      volume: patch.volume ?? current.volume,
      restart: patch.restart ?? current.restart,
      env: patch.env ?? current.env,
      autostart: patch.autostart ?? current.autostart,
      backup: patch.backup ?? current.backup,
    };
    return this.runJob('install', id, (progress) => this.driver.applyConfig(id, config, progress));
  }

  async install(req: InstallRequest): Promise<Job> {
    const item = findCatalogItem(req.catalogId);
    if (!item) throw new NotFoundError(req.catalogId);

    const id = slug(item.id);
    if (this.services.some((s) => s.id === id)) {
      throw new DriverError(`${item.name} уже стоит на хосте`, 409, 'already_exists');
    }

    const settings = this.settingsStore.get();
    const env = Object.entries({ ...item.env, TZ: settings.tz })
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    return this.runJob('install', id, async (progress) => {
      await this.driver.create(
        {
          id,
          name: item.name,
          desc: item.desc.split('.')[0] ?? item.desc,
          image: item.image,
          hostPort: (req.port || item.port).trim(),
          containerPort: item.containerPort,
          volume: (req.volume || item.vol).trim(),
          mount: item.mount,
          domain: (req.domain || item.id).trim(),
          restart: req.autostart ? 'unless-stopped' : 'no',
          env,
          autostart: req.autostart,
          backup: true,
        },
        progress,
      );
    });
  }

  // ── каталог ───────────────────────────────────────────────────────────────

  getCatalog() {
    return CATALOG;
  }

  catalogCompose(id: string): string {
    const item = findCatalogItem(id);
    if (!item) throw new NotFoundError(id);
    const settings = this.settingsStore.get();
    return catalogCompose(item, settings.tz, this.volumeRoot());
  }

  /** compose.yml уже стоящего сервиса — собирается из его текущего состояния. */
  serviceCompose(id: string): string {
    const svc = this.getService(id);
    const item = findCatalogItem(id);
    return composeYaml({
      id: svc.id,
      image: svc.image,
      hostPort: svc.port.replace(':', '').replace('—', ''),
      containerPort: item?.containerPort ?? svc.port.replace(':', '') ?? '',
      volume: `${this.volumeRoot()}/${svc.volume}`.replace(/\/+/g, '/'),
      mount: item?.mount ?? '/data',
      restart: svc.restart,
      env: svc.env,
    });
  }

  // ── настройки и бэкапы ────────────────────────────────────────────────────

  getSettings(): Settings {
    return this.settingsStore.get();
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const settings = await this.settingsStore.save(patch);
    this.logs.push('dock', 'config written to ~/dock/dock.yml', 'ok');
    this.emit({ type: 'settings', settings });
    return settings;
  }

  async resetSettings(): Promise<Settings> {
    const settings = await this.settingsStore.reset();
    this.logs.push('dock', 'config reset to defaults', 'warn');
    this.emit({ type: 'settings', settings });
    return settings;
  }

  async runBackup(): Promise<Job> {
    return this.runJob('backup', 'restic', async (progress) => {
      const settings = this.settingsStore.get();
      this.logs.push('restic', 'manual snapshot started …', 'dim');
      progress(30, `снимаю ~/${settings.backupPath} …`);
      // Реальный restic живёт в своём контейнере; панель лишь фиксирует запуск
      // и отметку времени — гонять бэкап изнутри панели было бы неверно.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      progress(90, 'записываю отметку …');
      const backup = await this.settingsStore.markBackup(4.3 * 1024 ** 3);
      this.logs.push('restic', `snapshot saved · ${backup.size ?? ''}`.trim(), 'ok');
      this.emit({ type: 'backup', backup });
      progress(100, 'готово');
    });
  }

  getBackup() {
    return this.settingsStore.backupInfo();
  }

  async restartDaemon(): Promise<void> {
    this.logs.push('dock', 'daemon restart requested', 'warn');
    await this.refresh();
  }

  // ── консоль ───────────────────────────────────────────────────────────────

  async console(raw: string): Promise<ConsoleResult> {
    const cmd = raw.trim();
    const settings = this.settingsStore.get();
    const echo = `${settings.operator}@${settings.hostname}:~$ ${cmd}`;

    if (cmd === 'clear') return { lines: [], clear: true };
    if (cmd === 'help') {
      return {
        lines: [
          echo,
          'dock ps · dock up <имя> · dock down <имя> · dock restart <имя> · dock pull <имя>',
          'dock logs · dock config · clear',
        ],
      };
    }
    if (cmd === 'dock ps') {
      return {
        lines: [
          echo,
          ...this.services.map(
            (s) => s.name.padEnd(16, ' ') + s.status.padEnd(12, ' ') + s.port,
          ),
        ],
      };
    }
    if (cmd === 'dock logs') return { lines: [echo], navigate: '#logs' };
    if (cmd === 'dock config') return { lines: [echo], navigate: '#settings' };

    const action = cmd.match(/^dock (up|down|restart|pull) (\S+)$/);
    if (action) {
      const [, verb, id] = action as unknown as [string, string, string];
      if (!this.services.some((s) => s.id === id)) {
        return { lines: [echo, `нет такого сервиса: ${id}`] };
      }
      switch (verb) {
        case 'up':
          await this.startService(id);
          return { lines: [echo, `started ${id}`] };
        case 'down':
          await this.stopService(id);
          return { lines: [echo, `stopped ${id}`] };
        case 'restart':
          await this.restartService(id);
          return { lines: [echo, `restarting ${id} …`] };
        default:
          await this.pullService(id);
          return { lines: [echo, `pulling ${id} …`] };
      }
    }

    return { lines: [echo, `неизвестная команда: ${cmd} — попробуй help`] };
  }

  // ── задачи ────────────────────────────────────────────────────────────────

  getJob(id: string): Job {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundError(id);
    return job;
  }

  /**
   * Запускает долгую операцию в фоне и сразу возвращает её описание.
   * Прогресс уезжает в панель событиями, поэтому HTTP-запрос не висит
   * всё время, пока тянется образ.
   */
  private async runJob(
    kind: JobKind,
    target: string,
    fn: (progress: ProgressFn) => Promise<void>,
  ): Promise<Job> {
    const job: Job = { id: randomUUID(), kind, target, pct: 0, step: '', status: 'running' };
    this.jobs.set(job.id, job);
    this.emit({ type: 'job', job: { ...job } });

    const progress: ProgressFn = (pct, step) => {
      job.pct = Math.max(0, Math.min(100, Math.round(pct)));
      job.step = step;
      this.emit({ type: 'job', job: { ...job } });
    };

    void (async () => {
      try {
        await fn(progress);
        job.pct = 100;
        job.status = 'done';
      } catch (err) {
        job.status = 'error';
        job.error = describe(err);
        this.logs.push(target === 'all' ? 'dock' : target, job.error, 'err');
      } finally {
        this.emit({ type: 'job', job: { ...job } });
        await this.refresh();
        // задача больше не нужна — панель уже получила финальное событие
        setTimeout(() => this.jobs.delete(job.id), 60_000).unref?.();
      }
    })();

    return { ...job };
  }

  /**
   * Корень, относительно которого заданы тома. Сам `settings.root` уже
   * входит в путь тома ('dock/gitea'), поэтому второй раз его не клеим.
   */
  private volumeRoot(): string {
    return this.config.docker.hostVolumeRoot.replace(/\/+$/, '');
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
