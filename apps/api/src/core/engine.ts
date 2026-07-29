import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  BootstrapResponse,
  ConsoleResult,
  HostStats,
  Job,
  JobKind,
  LogEntry,
  RegistryEntry,
  RegistrySource,
  Service,
  ServerEvent,
  Settings,
  StackManifest,
  StackValues,
} from '@dock/shared';
import type { Config } from '../config';
import type { DockerDriver, DriverContext, ProgressFn } from './driver';
import { DriverError, NotFoundError } from './driver';
import { DockerodeDriver } from './drivers/dockerode-driver';
import { MockDriver } from './drivers/mock-driver';
import { LogBus } from './log-bus';
import { SettingsStore } from './settings-store';
import { ComposeRunner } from './stacks/compose';
import { Layout } from './stacks/layout';
import { StackManager } from './stacks/manager';
import { Registry } from './stacks/registry';

/**
 * Ядро панели.
 *
 * Держит драйвер, реестр стеков, журнал, настройки и список задач; маршруты
 * HTTP и вебсокет не знают ничего, кроме этого класса. Любое изменение
 * состояния заканчивается событием в шину — панель обновляется по нему, а не
 * по опросу.
 */
export class DockEngine {
  readonly logs: LogBus;
  readonly settingsStore: SettingsStore;
  readonly layout: Layout;
  readonly registry: Registry;
  readonly stacks: StackManager;

  private readonly driver: DockerDriver;
  private readonly compose: ComposeRunner;
  private readonly bus = new EventEmitter();
  private readonly jobs = new Map<string, Job>();

  private services: Service[] = [];
  private hostStats: HostStats = {
    cpu: '—',
    cpuPct: 0,
    cpuCores: 0,
    ram: '—',
    ramPct: 0,
    disk: '—',
    diskPct: 0,
    uptime: '—',
    uptimeSeconds: 0,
    truthful: false,
  };

  private poll: NodeJS.Timeout | null = null;
  private catalogPoll: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(private readonly config: Config) {
    this.logs = new LogBus(config.logBuffer);
    this.settingsStore = new SettingsStore(config.paths.config);
    this.layout = new Layout(config.paths);

    this.registry = new Registry(
      config.bundledRegistry,
      config.registryUrl,
      config.paths.registry,
      (text, level) => void this.logs.push('dock', text, level ?? 'dim'),
    );

    this.compose = new ComposeRunner(
      config.docker.socketPath,
      config.docker.composeTimeoutMs,
      (text, level) => void this.logs.push('dock', text, level),
    );

    this.stacks = new StackManager({
      layout: this.layout,
      registry: this.registry,
      compose: this.compose,
      network: config.docker.network,
      puid: config.docker.puid,
      pgid: config.docker.pgid,
      settings: () => this.settingsStore.get(),
      log: (svc, text, level) => void this.logs.push(svc, text, level),
    });

    this.driver =
      config.driver === 'docker'
        ? new DockerodeDriver(config, this.stacks)
        : new MockDriver(config, this.registry);

    this.bus.setMaxListeners(0);
    this.logs.on('log', (entry: LogEntry) => this.emit({ type: 'log', entry }));
  }

  async start(): Promise<void> {
    await this.layout.ensure();
    await this.settingsStore.load();
    this.logs.push('dock', `раскладка готова · ${this.config.paths.root}`, 'dim');

    await this.registry.load();
    this.emit({ type: 'catalog', catalog: this.registry.list(), source: this.registry.source() });

    if (this.config.driver === 'docker') {
      const version = await this.compose.version();
      (this.driver as DockerodeDriver).setComposeVersion(version);
      if (version) {
        this.logs.push('dock', `docker compose ${version}`, 'dim');
      } else {
        this.logs.push(
          'dock',
          'docker compose не найден — стеки поднять не выйдет, проверь образ панели',
          'err',
        );
      }
    }

    const ctx: DriverContext = {
      log: (svc, text, level) => void this.logs.push(svc, text, level),
      settings: () => this.settingsStore.get(),
      changed: () => void this.refresh(),
    };
    await this.driver.init(ctx);

    if (!this.config.metrics.hostMounted && this.config.driver === 'docker') {
      this.logs.push(
        'dock',
        'хостовые /proc и корень не примонтированы — метрики будут про контейнер, а не про железо',
        'warn',
      );
    }

    await this.refresh();
    this.poll = setInterval(() => void this.refresh(), this.config.pollInterval);

    // Реестр живёт в чужом репозитории и меняется без нашего ведома, поэтому
    // панель перечитывает его сама. Кнопка «обновить» в каталоге остаётся —
    // она для тех, кто только что запушил стек и не хочет ждать час.
    const ttlMs = this.config.registryTtlMinutes * 60_000;
    if (this.config.registryUrl && ttlMs > 0) {
      this.catalogPoll = setInterval(() => void this.pollCatalog(), ttlMs);
      this.catalogPoll.unref?.();
    }
  }

  /**
   * Плановое обновление каталога. В отличие от ручного, молчит при неудаче:
   * `Registry.load()` уже написал в журнал, что случилось, и оставил рабочим
   * то, что было, — ронять панель из-за отвалившегося гитхаба незачем.
   */
  private async pollCatalog(): Promise<void> {
    try {
      await this.refreshCatalog();
    } catch (err) {
      this.logs.push('dock', `реестр не обновился: ${describe(err)}`, 'warn');
    }
  }

  async stop(): Promise<void> {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (this.catalogPoll) clearInterval(this.catalogPoll);
    this.catalogPoll = null;
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
      catalog: this.registry.list(),
      catalogSource: this.registry.source(),
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

  async startService(id: string): Promise<Job> {
    return this.runJob('restart', id, (progress) => this.driver.start(id, progress));
  }

  async stopService(id: string): Promise<Job> {
    return this.runJob('restart', id, (progress) => this.driver.stop(id, progress));
  }

  async restartService(id: string): Promise<Job> {
    return this.runJob('restart', id, (progress) => this.driver.restart(id, progress));
  }

  async pullService(id: string): Promise<Job> {
    return this.runJob('pull', id, (progress) => this.driver.pull(id, progress));
  }

  async pullAll(): Promise<Job> {
    const ids = this.services.filter((s) => s.kind === 'stack').map((s) => s.id);
    this.logs.push('dock', `обновляю образы · ${ids.length} стеков`, 'dim');
    return this.runJob('pull', 'all', async (progress) => {
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i] as string;
        progress(Math.round((i / Math.max(ids.length, 1)) * 100), `обновляю ${id} …`);
        try {
          await this.driver.pull(id, () => undefined);
        } catch (err) {
          this.logs.push(id, `образы не обновились: ${describe(err)}`, 'err');
        }
      }
      progress(100, 'все образы проверены');
    });
  }

  async removeService(id: string, purge = false): Promise<Job> {
    return this.runJob('remove', id, (progress) => this.driver.removeStack(id, progress, purge));
  }

  /** Установка стека из реестра с введёнными значениями. */
  async install(stackId: string, values: StackValues): Promise<Job> {
    this.registry.entry(stackId);
    if (this.services.some((s) => s.id === stackId)) {
      throw new DriverError(`${stackId} уже стоит на хосте`, 409, 'already_exists');
    }
    return this.runJob('install', stackId, (progress) =>
      this.driver.installStack(stackId, values, progress),
    );
  }

  /** Правка конфига установленного стека. */
  async applyValues(id: string, values: StackValues): Promise<Job> {
    this.getService(id);
    return this.runJob('install', id, (progress) =>
      this.driver.applyStackValues(id, values, progress),
    );
  }

  // ── реестр ────────────────────────────────────────────────────────────────

  getCatalog(): RegistryEntry[] {
    return this.registry.list();
  }

  getCatalogSource(): RegistrySource {
    return this.registry.source();
  }

  async refreshCatalog(): Promise<RegistryEntry[]> {
    await this.registry.load();
    const catalog = this.registry.list();
    this.emit({ type: 'catalog', catalog, source: this.registry.source() });
    return catalog;
  }

  /** Манифест и значения по умолчанию — форма установки. */
  async stackForm(stackId: string): Promise<{
    manifest: StackManifest;
    values: StackValues;
    busyPorts: number[];
  }> {
    const form = await this.stacks.form(stackId);
    return { ...form, busyPorts: this.busyPorts() };
  }

  /** Форма конфига уже установленного стека: значения из .env, секреты скрыты. */
  async installedForm(id: string): Promise<{
    manifest: StackManifest;
    values: StackValues;
    busyPorts: number[];
  }> {
    const service = this.getService(id);
    if (service.kind !== 'stack') {
      throw new DriverError(`${id} поднят не через dock — конфига у панели для него нет`, 409);
    }
    if (this.config.driver === 'mock') {
      const manifest = await this.registry.manifest(id);
      return { manifest, values: service.env ? envToValues(service.env) : {}, busyPorts: [] };
    }
    const stack = await this.stacks.read(id);
    return { manifest: stack.manifest, values: stack.values, busyPorts: this.busyPorts() };
  }

  async catalogCompose(stackId: string): Promise<string> {
    return this.stacks.previewCompose(stackId);
  }

  async serviceCompose(id: string): Promise<string> {
    const service = this.getService(id);
    if (service.kind !== 'stack' || !service.stackId) {
      throw new DriverError(`${id} поднят не через dock — compose-файла у панели нет`, 409);
    }
    if (this.config.driver === 'mock') return this.stacks.previewCompose(service.stackId);
    return this.stacks.composeText(service.stackId);
  }

  /** Порты, уже занятые чем-то на хосте, — панель подсветит конфликт в форме. */
  private busyPorts(): number[] {
    const ports = new Set<number>();
    for (const service of this.services) {
      for (const container of service.containers) {
        const port = Number(container.port.replace(':', ''));
        if (Number.isInteger(port) && port > 0) ports.add(port);
      }
    }
    return [...ports].sort((a, b) => a - b);
  }

  // ── настройки и бэкапы ────────────────────────────────────────────────────

  getSettings(): Settings {
    return this.settingsStore.get();
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const settings = await this.settingsStore.save(patch);
    this.logs.push('dock', `config written to ${this.config.paths.config}/dock.yml`, 'ok');
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
      this.logs.push('dock', 'manual snapshot started …', 'dim');
      progress(30, `снимаю ~/${settings.backupPath} …`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      progress(90, 'записываю отметку …');
      const backup = await this.settingsStore.markBackup(4.3 * 1024 ** 3);
      this.logs.push('dock', `snapshot saved · ${backup.size ?? ''}`.trim(), 'ok');
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
          'dock stacks · dock search · dock logs · dock config · clear',
        ],
      };
    }
    if (cmd === 'dock ps') {
      return {
        lines: [
          echo,
          ...this.services.map(
            (s) =>
              s.name.padEnd(20, ' ') +
              s.status.padEnd(11, ' ') +
              String(s.containers.length).padEnd(4, ' ') +
              s.port,
          ),
        ],
      };
    }
    if (cmd === 'dock stacks') {
      return {
        lines: [
          echo,
          ...this.services
            .filter((s) => s.kind === 'stack')
            .map((s) => `${s.id.padEnd(20, ' ')}${(s.version ?? '—').padEnd(10, ' ')}${s.volume}`),
        ],
      };
    }
    if (cmd === 'dock search') {
      return {
        lines: [
          echo,
          ...this.registry
            .list()
            .map((e) => `${e.id.padEnd(24, ' ')}${e.version.padEnd(10, ' ')}${e.summary}`),
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
          return { lines: [echo, `starting ${id} …`] };
        case 'down':
          await this.stopService(id);
          return { lines: [echo, `stopping ${id} …`] };
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
        setTimeout(() => this.jobs.delete(job.id), 60_000).unref?.();
      }
    })();

    return { ...job };
  }
}

function envToValues(env: string): StackValues {
  const values: StackValues = {};
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) values[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return values;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
