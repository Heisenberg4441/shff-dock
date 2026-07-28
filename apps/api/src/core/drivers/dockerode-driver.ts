import fs from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import Docker from 'dockerode';
import type Dockerode from 'dockerode';
import type { DriverInfo, HostStats, LogLevel, RestartPolicy, Service, ServiceConfig } from '@dock/shared';
import type { Config } from '../../config';
import { composeYaml } from '../catalog';
import type { CreateServiceSpec, DockerDriver, DriverContext, ProgressFn } from '../driver';
import { DriverError, NotFoundError } from '../driver';
import { clampPct, humanDuration, parseEnv, stringifyEnv, usageLabel } from '../format';
import { HostMetrics, volumeFillPct } from '../host-metrics';

/**
 * Метки, которыми dock помечает свои контейнеры. Всё, что панель знает о
 * сервисе сверх докеровского инспекта — описание, поддомен, участие в бэкапе —
 * живёт здесь же, на контейнере. Отдельной базы у панели нет: снёс контейнер —
 * снёс и запись, docker остаётся единственным источником правды.
 */
const L = {
  managed: 'dock.managed',
  id: 'dock.id',
  desc: 'dock.desc',
  domain: 'dock.domain',
  volume: 'dock.volume',
  mount: 'dock.mount',
  backup: 'dock.backup',
  autostart: 'dock.autostart',
  containerPort: 'dock.container-port',
} as const;

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

interface AttachedStream {
  stream: NodeJS.ReadableStream & { destroy?: () => void };
}

export class DockerodeDriver implements DockerDriver {
  readonly kind = 'docker' as const;

  private readonly docker: Docker;
  private readonly metrics: HostMetrics;
  private ctx!: DriverContext;
  private readonly attached = new Map<string, AttachedStream>();
  private version = 'unknown';
  private connected = false;
  private connectError: string | undefined;

  constructor(private readonly config: Config) {
    this.docker = new Docker({ socketPath: config.docker.socketPath });
    this.metrics = new HostMetrics(config.hostRoot);
  }

  async init(ctx: DriverContext): Promise<void> {
    this.ctx = ctx;
    try {
      const v = await this.docker.version();
      this.version = `docker ${v.Version} · api ${v.ApiVersion}`;
      this.connected = true;
      ctx.log('dock', `подключился к докеру · ${this.version}`, 'ok');
    } catch (err) {
      this.connected = false;
      this.connectError = err instanceof Error ? err.message : String(err);
      ctx.log('dock', `докер недоступен на ${this.config.docker.socketPath}: ${this.connectError}`, 'err');
    }
  }

  async info(): Promise<DriverInfo> {
    return {
      driver: 'docker',
      version: this.version,
      connected: this.connected,
      message: this.connected ? undefined : this.connectError,
    };
  }

  async list(): Promise<Service[]> {
    if (!this.connected) {
      // сокета нет — отдаём пустой список вместо падения, панель покажет это в шапке
      await this.retryConnect();
      if (!this.connected) return [];
    }

    const summaries = await this.docker.listContainers({ all: true });
    const wanted = summaries.filter(
      (c) => c.Labels?.[L.managed] === 'true' || this.config.docker.adoptForeign,
    );

    const services = await Promise.all(
      wanted.map(async (summary) => {
        try {
          return await this.toService(summary);
        } catch {
          return null;
        }
      }),
    );

    const result = services.filter((s): s is Service => s !== null);
    result.sort((a, b) => Number(b.managed) - Number(a.managed) || a.name.localeCompare(b.name));
    this.syncLogStreams(result);
    return result;
  }

  async start(id: string): Promise<void> {
    const container = await this.require(id);
    await this.guard(() => container.start(), `не удалось запустить ${id}`);
    this.ctx.log(id, 'container started', 'ok');
    this.ctx.changed();
  }

  async stop(id: string): Promise<void> {
    const container = await this.require(id);
    await this.guard(() => container.stop({ t: 10 }), `не удалось остановить ${id}`);
    this.ctx.log(id, 'container stopped', 'warn');
    this.ctx.changed();
  }

  async restart(id: string): Promise<void> {
    const container = await this.require(id);
    this.ctx.log(id, 'restarting …', 'warn');
    await this.guard(() => container.restart({ t: 10 }), `не удалось перезапустить ${id}`);
    this.ctx.log(id, 'container started', 'ok');
    this.ctx.changed();
  }

  /**
   * Тянет свежий образ и пересоздаёт контейнер на нём: одного `pull` мало,
   * работающий контейнер продолжит крутиться на старом слое.
   */
  async pull(id: string, onProgress: ProgressFn): Promise<void> {
    const container = await this.require(id);
    const info = await container.inspect();
    const image = info.Config.Image;

    this.ctx.log(id, `pulling ${image} …`, 'dim');
    await this.pullImage(image, (pct, step) => onProgress(Math.round(pct * 0.8), step));

    onProgress(85, 'пересоздаю контейнер на новом образе …');
    await this.recreate(container, info, {});
    onProgress(100, 'образ на свежем теге');
    this.ctx.log(id, 'image up to date', 'ok');
    this.ctx.changed();
  }

  async remove(id: string): Promise<void> {
    const container = await this.require(id);
    this.detach(id);
    await this.guard(() => container.remove({ force: true }), `не удалось удалить ${id}`);
    await fs.rm(path.join(this.config.dataDir, 'services', id), { recursive: true, force: true });
    this.ctx.log(id, 'container removed · том остался на диске', 'err');
    this.ctx.changed();
  }

  async create(spec: CreateServiceSpec, onProgress: ProgressFn): Promise<Service> {
    if (await this.findContainer(spec.id)) {
      throw new DriverError(`сервис ${spec.id} уже есть на хосте`, 409, 'already_exists');
    }

    onProgress(4, 'подтягиваю образ …');
    await this.pullImage(spec.image, (pct, step) => onProgress(4 + Math.round(pct * 0.55), step));

    onProgress(62, 'создаю том …');
    const binds = this.bindsFor(spec.volume, spec.mount);

    onProgress(72, 'поднимаю контейнер …');
    await this.ensureNetwork();
    const container = await this.guard(
      () => this.docker.createContainer(this.containerSpec(spec)),
      `не удалось создать контейнер ${spec.id}`,
    );
    await this.guard(() => container.start(), `контейнер ${spec.id} создан, но не стартовал`);

    onProgress(90, 'записываю compose …');
    await this.writeCompose(spec, binds);

    onProgress(100, 'готово');
    this.ctx.log(spec.id, `container created · ${spec.hostPort ? ':' + spec.hostPort : 'без порта'}`, 'ok');
    this.ctx.changed();

    const summaries = await this.docker.listContainers({ all: true, filters: { id: [container.id] } });
    const summary = summaries[0];
    if (!summary) throw new DriverError(`контейнер ${spec.id} исчез сразу после старта`, 500);
    return this.toService(summary);
  }

  async applyConfig(id: string, cfg: ServiceConfig, onProgress: ProgressFn): Promise<void> {
    const container = await this.require(id);
    const info = await container.inspect();

    onProgress(25, 'останавливаю контейнер …');
    onProgress(60, 'пересоздаю с новыми параметрами …');
    await this.recreate(container, info, cfg);

    onProgress(90, 'обновляю compose …');
    const spec = this.specFromInspect(id, info, cfg);
    await this.writeCompose(spec, this.bindsFor(spec.volume, spec.mount));

    onProgress(100, 'готово');
    this.ctx.log(id, 'config applied · recreating container', 'ok');
    this.ctx.changed();
  }

  async host(): Promise<HostStats> {
    return this.metrics.read();
  }

  async dispose(): Promise<void> {
    for (const id of [...this.attached.keys()]) this.detach(id);
  }

  // ── внутреннее ────────────────────────────────────────────────────────────

  private async retryConnect(): Promise<void> {
    try {
      const v = await this.docker.version();
      this.version = `docker ${v.Version} · api ${v.ApiVersion}`;
      this.connected = true;
      this.connectError = undefined;
      this.ctx.log('dock', `докер снова на связи · ${this.version}`, 'ok');
    } catch (err) {
      this.connectError = err instanceof Error ? err.message : String(err);
    }
  }

  private async findContainer(id: string): Promise<Dockerode.Container | null> {
    const byLabel = await this.docker.listContainers({
      all: true,
      filters: { label: [`${L.id}=${id}`] },
    });
    if (byLabel[0]) return this.docker.getContainer(byLabel[0].Id);

    const byName = await this.docker.listContainers({ all: true, filters: { name: [id] } });
    const exact = byName.find((c) => c.Names.some((n) => n.replace(/^\//, '') === id));
    return exact ? this.docker.getContainer(exact.Id) : null;
  }

  private async require(id: string): Promise<Dockerode.Container> {
    const container = await this.findContainer(id);
    if (!container) throw new NotFoundError(id);
    return container;
  }

  private async toService(summary: Dockerode.ContainerInfo): Promise<Service> {
    const container = this.docker.getContainer(summary.Id);
    const info = await container.inspect();
    const labels = info.Config.Labels ?? {};
    const managed = labels[L.managed] === 'true';
    const name = labels[L.id] ?? info.Name.replace(/^\//, '');

    const stats = info.State.Running ? await this.readStats(container) : { cpu: 0, mem: 0, memBytes: 0 };

    const bind = (info.HostConfig.Binds ?? [])[0];
    const bindSource = bind ? (bind.split(':')[0] as string) : null;
    const volumeLabel = labels[L.volume] ?? (bindSource ? bindSource.replace(/^\/+/, '') : '—');

    const hostPort = this.firstHostPort(info);
    const startedAt = info.State.StartedAt ? Date.parse(info.State.StartedAt) : NaN;
    const uptimeSeconds = info.State.Running && Number.isFinite(startedAt)
      ? (Date.now() - startedAt) / 1000
      : 0;

    return {
      id: name,
      name,
      desc: labels[L.desc] ?? this.describeImage(info.Config.Image),
      port: hostPort ? `:${hostPort}` : '—',
      status: this.statusOf(info),
      cpu: clampPct(stats.cpu),
      mem: clampPct(stats.mem),
      vol: bindSource ? await volumeFillPct(bindSource) : 0,
      usage: info.State.Running ? usageLabel(stats.cpu, stats.memBytes) : '— / —',
      uptime: info.State.Running ? humanDuration(uptimeSeconds) : '—',
      image: info.Config.Image,
      domain: labels[L.domain] ?? '—',
      volume: volumeLabel,
      restart: toRestartPolicy(info.HostConfig.RestartPolicy?.Name),
      autostart: labels[L.autostart]
        ? labels[L.autostart] === 'true'
        : toRestartPolicy(info.HostConfig.RestartPolicy?.Name) !== 'no',
      backup: labels[L.backup] === 'true',
      env: stringifyEnv(info.Config.Env),
      containerId: info.Id,
      managed,
    };
  }

  private statusOf(info: Dockerode.ContainerInspectInfo): Service['status'] {
    const state = info.State;
    if (state.Restarting) return 'updating';
    if (state.Running) return 'running';
    if (state.OOMKilled || state.Dead || (state.ExitCode ?? 0) !== 0) return 'error';
    return 'stopped';
  }

  private describeImage(image: string): string {
    const short = image.split('/').pop() ?? image;
    return `образ ${short}`;
  }

  private firstHostPort(info: Dockerode.ContainerInspectInfo): string | null {
    const bindings = info.HostConfig.PortBindings ?? info.NetworkSettings.Ports ?? {};
    for (const value of Object.values(bindings as Record<string, Array<{ HostPort?: string }> | null>)) {
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
      const cores =
        raw.cpu_stats.online_cpus ?? raw.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
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

  /** Держит подписку на stdout/stderr ровно тех контейнеров, что сейчас работают. */
  private syncLogStreams(services: Service[]): void {
    const running = new Set(services.filter((s) => s.status === 'running').map((s) => s.id));

    for (const id of [...this.attached.keys()]) {
      if (!running.has(id)) this.detach(id);
    }
    for (const svc of services) {
      if (svc.status !== 'running' || this.attached.has(svc.id) || !svc.containerId) continue;
      void this.attach(svc.id, svc.containerId);
    }
  }

  private async attach(id: string, containerId: string): Promise<void> {
    if (this.attached.has(id)) return;
    // резервируем место сразу, чтобы параллельный опрос не подписался вторым
    this.attached.set(id, { stream: new Writable() as never });
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      const stream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 0,
      })) as unknown as NodeJS.ReadableStream & { destroy?: () => void };

      const sink = lineSink((line) => this.ctx.log(id, line, levelFor(line)));

      if (info.Config.Tty) {
        stream.pipe(sink);
      } else {
        // без TTY докер отдаёт мультиплексированный поток с 8-байтовым заголовком
        this.docker.modem.demuxStream(stream, sink, sink);
      }

      stream.on('end', () => this.detach(id));
      stream.on('error', () => this.detach(id));
      this.attached.set(id, { stream });
    } catch {
      this.attached.delete(id);
    }
  }

  private detach(id: string): void {
    const attached = this.attached.get(id);
    this.attached.delete(id);
    try {
      attached?.stream.destroy?.();
    } catch {
      /* поток уже закрыт */
    }
  }

  // ── создание и пересоздание ───────────────────────────────────────────────

  private bindsFor(volume: string, mount: string): string[] {
    if (!volume || volume === '—' || !mount) return [];
    const source = path.posix.join(this.config.docker.hostVolumeRoot.replace(/\\/g, '/'), volume);
    return [`${source}:${mount}`];
  }

  private containerSpec(spec: CreateServiceSpec): Dockerode.ContainerCreateOptions {
    const settings = this.ctx.settings();
    const env = { TZ: settings.tz, ...parseEnv(spec.env) };
    const exposed: Record<string, Record<string, never>> = {};
    const bindings: Record<string, Array<{ HostPort: string }>> = {};

    if (spec.hostPort && spec.containerPort) {
      const key = `${spec.containerPort}/tcp`;
      exposed[key] = {};
      bindings[key] = [{ HostPort: spec.hostPort }];
    }

    return {
      name: spec.id,
      Image: spec.image,
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: exposed,
      Labels: {
        [L.managed]: 'true',
        [L.id]: spec.id,
        [L.desc]: spec.desc,
        [L.domain]: spec.domain || '—',
        [L.volume]: spec.volume,
        [L.mount]: spec.mount,
        [L.backup]: String(spec.backup),
        [L.autostart]: String(spec.autostart),
        [L.containerPort]: spec.containerPort,
      },
      HostConfig: {
        Binds: this.bindsFor(spec.volume, spec.mount),
        PortBindings: bindings,
        RestartPolicy: { Name: spec.autostart ? spec.restart : 'no' },
        NetworkMode: this.config.docker.network,
      },
    };
  }

  /** Собирает spec из текущего инспекта, накладывая правки с экрана конфига. */
  private specFromInspect(
    id: string,
    info: Dockerode.ContainerInspectInfo,
    cfg: Partial<ServiceConfig>,
  ): CreateServiceSpec {
    const labels = info.Config.Labels ?? {};
    const containerPort =
      labels[L.containerPort] ??
      Object.keys(info.Config.ExposedPorts ?? {})[0]?.split('/')[0] ??
      '';

    return {
      id,
      name: id,
      desc: labels[L.desc] ?? this.describeImage(info.Config.Image),
      image: info.Config.Image,
      hostPort: cfg.port ?? this.firstHostPort(info) ?? '',
      containerPort,
      volume: cfg.volume ?? labels[L.volume] ?? '',
      mount: labels[L.mount] ?? '',
      domain: cfg.domain ?? labels[L.domain] ?? '—',
      restart: cfg.restart ?? toRestartPolicy(info.HostConfig.RestartPolicy?.Name),
      env: cfg.env ?? stringifyEnv(info.Config.Env),
      autostart: cfg.autostart ?? labels[L.autostart] !== 'false',
      backup: cfg.backup ?? labels[L.backup] === 'true',
    };
  }

  /**
   * Снимает контейнер и поднимает новый с тем же именем. Том не трогается —
   * данные переживают и смену образа, и правку конфига.
   */
  private async recreate(
    container: Dockerode.Container,
    info: Dockerode.ContainerInspectInfo,
    cfg: Partial<ServiceConfig>,
  ): Promise<void> {
    const id = (info.Config.Labels ?? {})[L.id] ?? info.Name.replace(/^\//, '');
    const wasRunning = info.State.Running;
    const spec = this.specFromInspect(id, info, cfg);

    this.detach(id);
    await this.guard(() => container.remove({ force: true }), `не удалось снять ${id}`);
    await this.ensureNetwork();
    const next = await this.guard(
      () => this.docker.createContainer(this.containerSpec(spec)),
      `не удалось пересоздать ${id}`,
    );
    if (wasRunning) {
      await this.guard(() => next.start(), `${id} пересоздан, но не стартовал`);
    }
  }

  private async ensureNetwork(): Promise<void> {
    const name = this.config.docker.network;
    if (!name || name === 'bridge' || name === 'host' || name === 'none') return;
    const existing = await this.docker.listNetworks({ filters: { name: [name] } });
    if (existing.some((n) => n.Name === name)) return;
    await this.guard(
      () => this.docker.createNetwork({ Name: name, Driver: 'bridge' }),
      `не удалось создать сеть ${name}`,
    );
    this.ctx.log('dock', `создана docker-сеть ${name}`, 'ok');
  }

  private pullImage(image: string, onProgress: ProgressFn): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, {}, (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err || !stream) {
          reject(new DriverError(`не удалось скачать образ ${image}: ${err?.message ?? 'нет потока'}`, 502));
          return;
        }
        const layers = new Map<string, { current: number; total: number }>();
        this.docker.modem.followProgress(
          stream,
          (doneErr: Error | null) => {
            if (doneErr) {
              reject(new DriverError(`образ ${image} не скачался: ${doneErr.message}`, 502));
              return;
            }
            onProgress(100, 'образ скачан');
            resolve();
          },
          (event: { id?: string; status?: string; progressDetail?: { current?: number; total?: number } }) => {
            if (event.id && event.progressDetail?.total) {
              layers.set(event.id, {
                current: event.progressDetail.current ?? 0,
                total: event.progressDetail.total,
              });
            }
            let current = 0;
            let total = 0;
            for (const layer of layers.values()) {
              current += layer.current;
              total += layer.total;
            }
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            onProgress(pct, event.status ? `${event.status} …` : 'тяну слои …');
          },
        );
      });
    });
  }

  private async writeCompose(spec: CreateServiceSpec, binds: string[]): Promise<void> {
    const dir = path.join(this.config.dataDir, 'services', spec.id);
    await fs.mkdir(dir, { recursive: true });
    const bind = binds[0]?.split(':')[0] ?? '';
    const yaml = composeYaml({
      id: spec.id,
      image: spec.image,
      hostPort: spec.hostPort,
      containerPort: spec.containerPort,
      volume: bind,
      mount: spec.mount,
      restart: spec.autostart ? spec.restart : 'no',
      env: spec.env,
      network: this.config.docker.network,
    });
    await fs.writeFile(path.join(dir, 'compose.yml'), yaml + '\n', 'utf8');
  }

  /** Превращает ошибку демона в DriverError с человеческим текстом. */
  private async guard<T>(fn: () => Promise<T>, message: string): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const raw = err as { statusCode?: number; message?: string; json?: { message?: string } };
      const detail = raw.json?.message ?? raw.message ?? String(err);
      throw new DriverError(`${message}: ${detail}`, raw.statusCode ?? 500, 'docker_error');
    }
  }
}
