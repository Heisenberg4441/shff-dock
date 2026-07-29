import { Writable } from 'node:stream';
import Docker from 'dockerode';
import type Dockerode from 'dockerode';
import type {
  ContainerRef,
  DriverInfo,
  HostStats,
  InstalledStack,
  LogLevel,
  RestartPolicy,
  Service,
  ServiceStatus,
  StackValues,
} from '@dock/shared';
import type { Config } from '../../config';
import type { DockerDriver, DriverContext, ProgressFn } from '../driver';
import { DriverError, NotFoundError } from '../driver';
import { clampPct, humanDuration, usageLabel } from '../format';
import { HostMetrics, volumeFillPct } from '../host-metrics';
import type { StackManager } from '../stacks/manager';

/**
 * Сколько строк истории забирать при подключении к журналу контейнера.
 * Достаточно, чтобы поймать вывод первых секунд, и мало, чтобы перезапуск
 * панели не завалил журнал историей всех контейнеров сразу.
 */
const LOG_BACKLOG = 50;

/** Метки, которые compose сам вешает на контейнеры проекта. */
const COMPOSE_PROJECT = 'com.docker.compose.project';
const COMPOSE_SERVICE = 'com.docker.compose.service';

const RESTART_NAMES: RestartPolicy[] = ['unless-stopped', 'always', 'on-failure', 'no'];

function toRestartPolicy(name: string | undefined): RestartPolicy {
  if (!name) return 'no';
  return (RESTART_NAMES as string[]).includes(name) ? (name as RestartPolicy) : 'no';
}

function levelFor(text: string): LogLevel {
  if (/\b(error|fatal|panic|failed|refused)\b/i.test(text)) return 'err';
  if (/\b(warn|deprecated|retry|timeout)\b/i.test(text)) return 'warn';
  return 'dim';
}

/** Writable, который режет поток контейнера на строки и отдаёт их в журнал. */
function lineSink(onLine: (line: string) => void): Writable {
  let tail = '';
  return new Writable({
    write(chunk, _enc, cb) {
      tail += chunk.toString('utf8');
      const parts = tail.split('\n');
      tail = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.replace(/\r$/, '').trim();
        if (line) onLine(line);
      }
      cb();
    },
  });
}

interface Attached {
  stream: NodeJS.ReadableStream & { destroy?: () => void };
}

interface Member {
  info: Dockerode.ContainerInspectInfo;
  ref: ContainerRef;
  project: string | null;
}

/**
 * Драйвер настоящего докера.
 *
 * Читает состояние через dockerode (инспект, статистика, журналы), а всё, что
 * меняет мир, отдаёт StackManager — то есть `docker compose` поверх каталога
 * стека. Разделение намеренное: инспект должен быть быстрым и частым, а
 * изменения — воспроизводимыми файлами на диске, а не последовательностью
 * вызовов api, которую потом никто не повторит руками.
 */
export class DockerodeDriver implements DockerDriver {
  readonly kind = 'docker' as const;

  private readonly docker: Docker;
  private readonly metrics: HostMetrics;
  private ctx!: DriverContext;
  private readonly attached = new Map<string, Attached>();
  private version = 'unknown';
  private composeVersion: string | null = null;
  private connected = false;
  private connectError: string | undefined;

  constructor(
    private readonly config: Config,
    private readonly stacks: StackManager,
  ) {
    this.docker = new Docker({ socketPath: config.docker.socketPath });
    this.metrics = new HostMetrics(config.metrics);
  }

  async init(ctx: DriverContext): Promise<void> {
    this.ctx = ctx;
    await this.connect();
    if (this.connected) await this.ensureNetwork();
  }

  /**
   * Общая сеть, в которую стеки включаются как external. Создаём её сами:
   * иначе первый же `compose up` упадёт на «network dock not found», если
   * панель подняли не своим compose-файлом.
   */
  private async ensureNetwork(): Promise<void> {
    const name = this.config.docker.network;
    if (!name || ['bridge', 'host', 'none'].includes(name)) return;
    try {
      const existing = await this.docker.listNetworks({ filters: { name: [name] } });
      if (existing.some((n) => n.Name === name)) return;
      await this.docker.createNetwork({ Name: name, Driver: 'bridge' });
      this.ctx.log('dock', `создана docker-сеть ${name}`, 'ok');
    } catch (err) {
      this.ctx.log('dock', `не создать сеть ${name}: ${describe(err)}`, 'warn');
    }
  }

  private async connect(): Promise<void> {
    try {
      const v = await this.docker.version();
      this.version = `docker ${v.Version} · api ${v.ApiVersion}`;
      this.connected = true;
      this.connectError = undefined;
      this.ctx.log('dock', `подключился к докеру · ${this.version}`, 'ok');
    } catch (err) {
      this.connected = false;
      this.connectError = err instanceof Error ? err.message : String(err);
      this.ctx.log(
        'dock',
        `докер недоступен на ${this.config.docker.socketPath}: ${this.connectError}`,
        'err',
      );
    }
  }

  async info(): Promise<DriverInfo> {
    return {
      driver: 'docker',
      version: this.version,
      connected: this.connected,
      message: this.connected ? undefined : this.connectError,
      composeVersion: this.composeVersion ?? undefined,
      root: this.config.paths.root,
    };
  }

  setComposeVersion(version: string | null): void {
    this.composeVersion = version;
  }

  // ── снимок ────────────────────────────────────────────────────────────────

  async list(): Promise<Service[]> {
    if (!this.connected) {
      await this.connect();
      if (!this.connected) return [];
    }

    const [summaries, installed] = await Promise.all([
      this.docker.listContainers({ all: true }),
      this.stacks.installed(),
    ]);

    const members = await Promise.all(summaries.map((s) => this.member(s)));
    const alive = members.filter((m): m is Member => m !== null);

    const byProject = new Map<string, Member[]>();
    const foreign: Member[] = [];
    const known = new Map(installed.map((s) => [s.id, s]));

    for (const member of alive) {
      if (member.project && known.has(member.project)) {
        const list = byProject.get(member.project) ?? [];
        list.push(member);
        byProject.set(member.project, list);
      } else {
        foreign.push(member);
      }
    }

    const services: Service[] = [];

    for (const stack of installed) {
      services.push(await this.stackService(stack, byProject.get(stack.id) ?? []));
    }

    if (this.config.docker.adoptForeign) {
      for (const member of foreign) {
        services.push(this.foreignService(member));
      }
    }

    services.sort(
      (a, b) => Number(b.kind === 'stack') - Number(a.kind === 'stack') || a.name.localeCompare(b.name),
    );

    this.syncLogStreams(services);
    return services;
  }

  /** Стек как одна карточка: статусы и ресурсы участников свёрнуты вместе. */
  private async stackService(stack: InstalledStack, members: Member[]): Promise<Service> {
    const manifest = stack.manifest;
    const primaryName = manifest.primary ?? members[0]?.ref.service ?? '';
    const primary = members.find((m) => m.ref.service === primaryName) ?? members[0] ?? null;

    const containers = members.map((m) => m.ref).sort((a, b) => a.service.localeCompare(b.service));
    const running = containers.filter((c) => c.status === 'running').length;

    let status: ServiceStatus;
    if (!containers.length) status = 'stopped';
    else if (containers.some((c) => c.status === 'updating')) status = 'updating';
    else if (containers.some((c) => c.status === 'error')) status = 'error';
    else if (running === containers.length) status = 'running';
    else if (running === 0) status = 'stopped';
    else status = 'error';

    const cpu = clampPct(containers.reduce((sum, c) => sum + c.cpu, 0));
    const mem = clampPct(containers.reduce((sum, c) => sum + c.mem, 0));
    const memBytes = members.reduce((sum, m) => sum + (m.info.State.Running ? this.memOf(m) : 0), 0);

    const oldest = members
      .filter((m) => m.info.State.Running && m.info.State.StartedAt)
      .map((m) => Date.parse(m.info.State.StartedAt))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];

    const domainValue = stack.values.DOMAIN ?? stack.values.SUBDOMAIN;

    return {
      kind: 'stack',
      stackId: stack.id,
      version: manifest.version,
      containers,
      id: stack.id,
      name: manifest.name,
      desc: manifest.summary || `стек из ${containers.length || this.expected(stack)} контейнеров`,
      port: primary?.ref.port ?? '—',
      status,
      cpu,
      mem,
      vol: await volumeFillPct(stack.dir),
      usage: running ? usageLabel(cpu, memBytes) : '— / —',
      uptime: oldest ? humanDuration((Date.now() - oldest) / 1000) : '—',
      image: primary?.ref.image ?? '—',
      domain: domainValue ? String(domainValue) : '—',
      volume: stack.dir,
      restart: toRestartPolicy(primary?.info.HostConfig.RestartPolicy?.Name),
      autostart: toRestartPolicy(primary?.info.HostConfig.RestartPolicy?.Name) !== 'no',
      backup: stack.values.BACKUP === 'true' || stack.values.BACKUP === true,
      env: this.envPreview(stack),
      containerId: primary?.info.Id ?? null,
      managed: true,
    };
  }

  /** Контейнер, поднятый мимо панели: показываем, но не трогаем его файлы. */
  private foreignService(member: Member): Service {
    const info = member.info;
    const ref = member.ref;
    return {
      kind: 'container',
      stackId: null,
      version: null,
      containers: [ref],
      id: ref.name,
      name: ref.name,
      desc: member.project ? `чужой compose-проект ${member.project}` : 'контейнер поднят не через dock',
      port: ref.port,
      status: ref.status,
      cpu: ref.cpu,
      mem: ref.mem,
      vol: 0,
      usage: ref.usage,
      uptime: ref.uptime,
      image: ref.image,
      domain: '—',
      volume: (info.HostConfig.Binds ?? [])[0]?.split(':')[0] ?? '—',
      restart: toRestartPolicy(info.HostConfig.RestartPolicy?.Name),
      autostart: toRestartPolicy(info.HostConfig.RestartPolicy?.Name) !== 'no',
      backup: false,
      env: (info.Config.Env ?? []).join('\n'),
      containerId: info.Id,
      managed: false,
    };
  }

  private expected(stack: InstalledStack): number {
    const compose = stack.manifest.compose;
    if (typeof compose === 'string') return 1;
    const services = (compose as { services?: Record<string, unknown> }).services;
    return services ? Object.keys(services).length : 1;
  }

  /** Значения инпутов в виде KEY=value — вкладка «конфиг» показывает их как есть. */
  private envPreview(stack: InstalledStack): string {
    return Object.entries(stack.values)
      .filter(([key]) => !key.startsWith('DOCK_'))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n');
  }

  private async member(summary: Dockerode.ContainerInfo): Promise<Member | null> {
    try {
      const container = this.docker.getContainer(summary.Id);
      const info = await container.inspect();
      const labels = info.Config.Labels ?? {};
      const stats = info.State.Running
        ? await this.readStats(container)
        : { cpu: 0, mem: 0, memBytes: 0 };

      const startedAt = info.State.StartedAt ? Date.parse(info.State.StartedAt) : NaN;
      const uptimeSeconds =
        info.State.Running && Number.isFinite(startedAt) ? (Date.now() - startedAt) / 1000 : 0;
      const hostPort = this.firstHostPort(info);

      const ref: ContainerRef = {
        id: info.Id,
        service: labels[COMPOSE_SERVICE] ?? info.Name.replace(/^\//, ''),
        name: info.Name.replace(/^\//, ''),
        image: info.Config.Image,
        status: this.statusOf(info),
        cpu: clampPct(stats.cpu),
        mem: clampPct(stats.mem),
        usage: info.State.Running ? usageLabel(stats.cpu, stats.memBytes) : '— / —',
        uptime: info.State.Running ? humanDuration(uptimeSeconds) : '—',
        port: hostPort ? `:${hostPort}` : '—',
      };

      this.memCache.set(info.Id, stats.memBytes);
      return { info, ref, project: labels[COMPOSE_PROJECT] ?? null };
    } catch {
      return null;
    }
  }

  private readonly memCache = new Map<string, number>();

  private memOf(member: Member): number {
    return this.memCache.get(member.info.Id) ?? 0;
  }

  private statusOf(info: Dockerode.ContainerInspectInfo): ServiceStatus {
    const state = info.State;
    if (state.Restarting) return 'updating';
    if (state.Running) return 'running';
    if (state.OOMKilled || state.Dead || (state.ExitCode ?? 0) !== 0) return 'error';
    return 'stopped';
  }

  private firstHostPort(info: Dockerode.ContainerInspectInfo): string | null {
    const bindings = info.HostConfig.PortBindings ?? info.NetworkSettings.Ports ?? {};
    for (const value of Object.values(
      bindings as Record<string, Array<{ HostPort?: string }> | null>,
    )) {
      const hostPort = value?.[0]?.HostPort;
      if (hostPort) return hostPort;
    }
    return null;
  }

  private async readStats(
    container: Dockerode.Container,
  ): Promise<{ cpu: number; mem: number; memBytes: number }> {
    try {
      const raw = (await container.stats({ stream: false })) as Dockerode.ContainerStats;
      const cpuDelta =
        raw.cpu_stats.cpu_usage.total_usage - (raw.precpu_stats?.cpu_usage?.total_usage ?? 0);
      const systemDelta =
        (raw.cpu_stats.system_cpu_usage ?? 0) - (raw.precpu_stats?.system_cpu_usage ?? 0);
      const cores = raw.cpu_stats.online_cpus ?? raw.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
      const cpu = systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * cores * 100 : 0;

      const cache = (raw.memory_stats.stats as Record<string, number> | undefined)?.cache ?? 0;
      const memBytes = Math.max(0, (raw.memory_stats.usage ?? 0) - cache);
      const limit = raw.memory_stats.limit ?? 0;
      const mem = limit > 0 ? (memBytes / limit) * 100 : 0;

      return { cpu, mem, memBytes };
    } catch {
      return { cpu: 0, mem: 0, memBytes: 0 };
    }
  }

  // ── журнал ────────────────────────────────────────────────────────────────

  /** Подписка на stdout/stderr работающих контейнеров, помеченная id стека. */
  private syncLogStreams(services: Service[]): void {
    const wanted = new Map<string, string>();
    for (const service of services) {
      for (const container of service.containers) {
        if (container.status === 'running') wanted.set(container.id, service.id);
      }
    }

    for (const id of [...this.attached.keys()]) {
      if (!wanted.has(id)) this.detach(id);
    }
    for (const [containerId, serviceId] of wanted) {
      if (!this.attached.has(containerId)) void this.attach(containerId, serviceId);
    }
  }

  private async attach(containerId: string, serviceId: string): Promise<void> {
    if (this.attached.has(containerId)) return;
    this.attached.set(containerId, { stream: new Writable() as never });
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      const stream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        // Не ноль: подключаемся мы на ближайшем опросе, то есть через несколько
        // секунд после старта контейнера, а самое важное сервисы печатают в
        // первую секунду. Так терялся временный пароль qbittorrent — за ним
        // приходилось идти в консоль под sudo, хотя панель для того и нужна.
        tail: LOG_BACKLOG,
      })) as unknown as NodeJS.ReadableStream & { destroy?: () => void };

      const sink = lineSink((line) => this.ctx.log(serviceId, line, levelFor(line)));

      if (info.Config.Tty) {
        stream.pipe(sink);
      } else {
        // без TTY докер отдаёт мультиплексированный поток с 8-байтовым заголовком
        this.docker.modem.demuxStream(stream, sink, sink);
      }

      stream.on('end', () => this.detach(containerId));
      stream.on('error', () => this.detach(containerId));
      this.attached.set(containerId, { stream });
    } catch {
      this.attached.delete(containerId);
    }
  }

  private detach(containerId: string): void {
    const attached = this.attached.get(containerId);
    this.attached.delete(containerId);
    try {
      attached?.stream.destroy?.();
    } catch {
      /* поток уже закрыт */
    }
  }

  // ── действия ──────────────────────────────────────────────────────────────

  async start(id: string, progress?: ProgressFn): Promise<void> {
    if (await this.stacks.exists(id)) {
      await this.stacks.start(id, progress);
    } else {
      await this.container(id, (c) => c.start(), `не удалось запустить ${id}`);
    }
    this.ctx.changed();
  }

  async stop(id: string, progress?: ProgressFn): Promise<void> {
    if (await this.stacks.exists(id)) {
      await this.stacks.stop(id, progress);
    } else {
      await this.container(id, (c) => c.stop({ t: 10 }), `не удалось остановить ${id}`);
    }
    this.ctx.changed();
  }

  async restart(id: string, progress?: ProgressFn): Promise<void> {
    if (await this.stacks.exists(id)) {
      await this.stacks.restart(id, progress);
    } else {
      await this.container(id, (c) => c.restart({ t: 10 }), `не удалось перезапустить ${id}`);
    }
    this.ctx.changed();
  }

  async pull(id: string, progress: ProgressFn): Promise<void> {
    if (!(await this.stacks.exists(id))) {
      throw new DriverError(
        `${id} поднят не через dock — обновлять его образ панель не станет`,
        409,
        'not_managed',
      );
    }
    await this.stacks.pull(id, progress);
    this.ctx.changed();
  }

  async installStack(stackId: string, values: StackValues, progress: ProgressFn): Promise<void> {
    await this.stacks.install(stackId, values, progress);
    this.ctx.changed();
  }

  async applyStackValues(id: string, values: StackValues, progress: ProgressFn): Promise<void> {
    await this.stacks.applyValues(id, values, progress);
    this.ctx.changed();
  }

  async removeStack(id: string, progress: ProgressFn, purge = false): Promise<void> {
    if (!(await this.stacks.exists(id))) {
      // чужой контейнер удаляем напрямую: своего каталога стека у него нет
      await this.container(id, (c) => c.remove({ force: true }), `не удалось удалить ${id}`);
    } else {
      await this.stacks.remove(id, progress, purge);
    }
    this.ctx.changed();
  }

  async host(): Promise<HostStats> {
    return this.metrics.read();
  }

  async dispose(): Promise<void> {
    for (const id of [...this.attached.keys()]) this.detach(id);
  }

  private async container<T>(
    name: string,
    fn: (container: Dockerode.Container) => Promise<T>,
    message: string,
  ): Promise<T> {
    const list = await this.docker.listContainers({ all: true, filters: { name: [name] } });
    const exact = list.find((c) => c.Names.some((n) => n.replace(/^\//, '') === name));
    if (!exact) throw new NotFoundError(name);
    try {
      return await fn(this.docker.getContainer(exact.Id));
    } catch (err) {
      const raw = err as { statusCode?: number; message?: string; json?: { message?: string } };
      throw new DriverError(
        `${message}: ${raw.json?.message ?? raw.message ?? String(err)}`,
        raw.statusCode ?? 500,
        'docker_error',
      );
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
