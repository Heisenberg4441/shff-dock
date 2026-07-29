import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import type {
  InstalledStack,
  LogLevel,
  Settings,
  StackManifest,
  StackPost,
  StackPostInfo,
  StackValues,
} from '@dock/shared';
import { DriverError, NotFoundError } from '../driver';
import type { ProgressFn } from '../driver';
import { ComposeProgress, ComposeRunner } from './compose';
import type { ComposeTarget } from './compose';
import { Layout } from './layout';
import { parseManifest } from './manifest';
import { Registry } from './registry';
import { parseEnvFile, renderEnvFile, renderTemplate } from './template';
import {
  activeProfiles,
  contextKeys,
  defaultValues,
  isMasked,
  maskSecrets,
  resolveValues,
  secretKeys,
} from './values';
import type { StackContext } from './values';

interface StackMeta {
  installedAt: string;
  secrets: string[];
  profiles: string[];
  version: string;
}

export interface StackManagerDeps {
  layout: Layout;
  registry: Registry;
  compose: ComposeRunner;
  network: string;
  puid: number;
  pgid: number;
  settings: () => Settings;
  log: (svc: string, text: string, level?: LogLevel) => void;
}

/**
 * Жизненный цикл стека: разложить по каталогу, поднять, править, снять.
 *
 * Установка это всегда одна и та же последовательность, и порядок в ней
 * важен: сначала на диске появляется всё, что нужно контейнеру (конфиги,
 * каталоги данных с правильным владельцем), и только потом запускается
 * compose. Обратный порядок — самая частая причина «поставилось, но упало»:
 * докер создаёт недостающий каталог от root, а образ, работающий не от root,
 * не может в него писать.
 */
export class StackManager {
  constructor(private readonly deps: StackManagerDeps) {}

  private get layout(): Layout {
    return this.deps.layout;
  }

  private get registry(): Registry {
    return this.deps.registry;
  }

  private get compose(): ComposeRunner {
    return this.deps.compose;
  }

  /** Переменные, которые ядро подставляет само. */
  context(id: string): StackContext {
    const settings = this.deps.settings();
    const dir = this.layout.stackDir(id);
    return {
      DOCK_STACK_ID: id,
      DOCK_STACK_DIR: dir,
      DOCK_DATA_DIR: path.posix.join(dir, 'data'),
      DOCK_NETWORK: this.deps.network,
      DOCK_TZ: settings.tz,
      DOCK_DOMAIN: settings.domain,
      DOCK_HOSTNAME: settings.hostname,
      DOCK_PUID: String(this.deps.puid),
      DOCK_PGID: String(this.deps.pgid),
    };
  }

  // ── чтение установленного ─────────────────────────────────────────────────

  async installed(): Promise<InstalledStack[]> {
    const ids = await this.layout.listStackIds();
    const stacks: InstalledStack[] = [];
    for (const id of ids) {
      try {
        stacks.push(await this.read(id));
      } catch (err) {
        this.deps.log(id, `каталог стека испорчен: ${describe(err)}`, 'err');
      }
    }
    return stacks;
  }

  async read(id: string): Promise<InstalledStack> {
    const dir = this.layout.stackDir(id);
    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(this.layout.manifestPath(id), 'utf8');
    } catch {
      throw new NotFoundError(id);
    }
    const manifest = parseManifest(manifestRaw);

    let values: StackValues = {};
    try {
      values = parseEnvFile(await fs.readFile(this.layout.envPath(id), 'utf8'));
    } catch {
      /* .env мог не сохраниться — форма отрисуется на значениях по умолчанию */
    }

    const meta = await this.meta(id);
    const secrets = meta?.secrets ?? secretKeys(manifest);

    return {
      id,
      name: manifest.name,
      version: manifest.version,
      dir,
      values: maskSecrets(values, secrets),
      secrets,
      manifest,
      installedAt: meta?.installedAt ?? '',
    };
  }

  async exists(id: string): Promise<boolean> {
    try {
      await fs.access(this.layout.composePath(id));
      return true;
    } catch {
      return false;
    }
  }

  /** Форма установки: манифест из реестра плюс значения по умолчанию. */
  async form(stackId: string): Promise<{ manifest: StackManifest; values: StackValues }> {
    const manifest = await this.registry.manifest(stackId);
    return { manifest, values: defaultValues(manifest, this.context(stackId)) };
  }

  async composeText(id: string): Promise<string> {
    return fs.readFile(this.layout.composePath(id), 'utf8');
  }

  /**
   * Реквизиты установленного стека.
   *
   * Значения берутся из `.env` неотмаскированными, в отличие от `read`: адрес
   * и заметки существуют ровно ради того, чтобы показать сгенерированный
   * пароль, а маска в этом месте сделала бы блок бессмысленным.
   */
  async postInfo(id: string): Promise<StackPostInfo | null> {
    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(this.layout.manifestPath(id), 'utf8');
    } catch {
      throw new NotFoundError(id);
    }
    const manifest = parseManifest(manifestRaw);
    if (!manifest.post) return null;

    const values = parseEnvFile(await fs.readFile(this.layout.envPath(id), 'utf8').catch(() => ''));
    return renderPost(manifest.post, values);
  }

  /** Предпросмотр compose до установки — то, что показывает диалог «compose». */
  async previewCompose(stackId: string): Promise<string> {
    const manifest = await this.registry.manifest(stackId);
    return this.composeDocument(manifest, stackId);
  }

  // ── установка ─────────────────────────────────────────────────────────────

  async install(stackId: string, provided: StackValues, progress: ProgressFn): Promise<InstalledStack> {
    if (await this.exists(stackId)) {
      throw new DriverError(`стек ${stackId} уже стоит на хосте`, 409, 'already_exists');
    }

    progress(4, 'читаю манифест …');
    const manifestRaw = await this.registry.file(stackId, 'stack.yaml');
    const manifest = parseManifest(manifestRaw);
    if (manifest.id !== stackId) {
      throw new DriverError(`в реестре id ${stackId}, а в манифесте ${manifest.id}`, 422);
    }

    const ctx = this.context(stackId);
    const values = resolveValues(manifest, provided, ctx);
    const profiles = activeProfiles(manifest, values);

    progress(12, 'раскладываю файлы стека …');
    await this.materialize(stackId, manifest, manifestRaw, values, profiles);

    progress(20, 'поднимаю стек …');
    const services = this.serviceCount(manifest);
    const reporter = new ComposeProgress(services, progress, 20, 96);

    try {
      await this.compose.up(this.target(stackId, profiles), {
        onLine: (line) => {
          reporter.line(line);
          if (worthLogging(line)) this.deps.log(stackId, line, 'dim');
        },
      });
    } catch (err) {
      // Установка атомарна: либо стек стоит и работает, либо от него не остаётся
      // ничего. Иначе недоделанный каталог заблокирует повторную попытку
      // сообщением «уже стоит на хосте», а данных, которые стоило бы беречь,
      // у не поднявшегося стека и нет.
      await this.safeDown(stackId, profiles);
      await fs.rm(this.layout.stackDir(stackId), { recursive: true, force: true });
      throw err;
    }

    progress(100, 'готово');
    this.deps.log(stackId, `стек поднят · ${manifest.name} ${manifest.version}`, 'ok');
    return this.read(stackId);
  }

  /**
   * Правка конфига: значения переписываются, файлы рендерятся заново,
   * compose пересоздаёт только те контейнеры, у которых что-то изменилось.
   */
  async applyValues(id: string, provided: StackValues, progress: ProgressFn): Promise<void> {
    const current = await this.read(id);
    const manifestRaw = await fs.readFile(this.layout.manifestPath(id), 'utf8');
    const stored = parseEnvFile(await fs.readFile(this.layout.envPath(id), 'utf8').catch(() => ''));

    // заглушка вместо секрета означает «не трогать»
    const merged: StackValues = { ...provided };
    for (const key of current.secrets) {
      if (merged[key] === undefined || isMasked(merged[key])) {
        if (stored[key] !== undefined) merged[key] = stored[key];
        else delete merged[key];
      }
    }

    const ctx = this.context(id);
    const values = resolveValues(current.manifest, merged, ctx);
    const profiles = activeProfiles(current.manifest, values);

    progress(20, 'переписываю конфиги …');
    await this.materialize(id, current.manifest, manifestRaw, values, profiles);

    progress(45, 'пересоздаю изменившееся …');
    const reporter = new ComposeProgress(this.serviceCount(current.manifest), progress, 45, 96);
    await this.compose.up(this.target(id, profiles), {
      onLine: (line) => {
        reporter.line(line);
        if (worthLogging(line)) this.deps.log(id, line, 'dim');
      },
    });

    progress(100, 'готово');
    this.deps.log(id, 'конфиг применён', 'ok');
  }

  // ── жизненный цикл ────────────────────────────────────────────────────────

  async start(id: string, progress?: ProgressFn): Promise<void> {
    const profiles = (await this.meta(id))?.profiles ?? [];
    // up вместо start: если контейнеров ещё нет, их надо создать
    await this.compose.up(this.target(id, profiles), { onLine: (l) => this.trace(id, l, progress) });
  }

  async stop(id: string, progress?: ProgressFn): Promise<void> {
    const profiles = (await this.meta(id))?.profiles ?? [];
    await this.compose.stop(this.target(id, profiles), { onLine: (l) => this.trace(id, l, progress) });
  }

  async restart(id: string, progress?: ProgressFn): Promise<void> {
    const profiles = (await this.meta(id))?.profiles ?? [];
    await this.compose.restart(this.target(id, profiles), {
      onLine: (l) => this.trace(id, l, progress),
    });
  }

  async pull(id: string, progress: ProgressFn): Promise<void> {
    const profiles = (await this.meta(id))?.profiles ?? [];
    const target = this.target(id, profiles);
    const reporter = new ComposeProgress(4, progress, 0, 70);

    await this.compose.pull(target, {
      onLine: (line) => {
        reporter.line(line);
        if (worthLogging(line)) this.deps.log(id, line, 'dim');
      },
    });

    progress(75, 'пересоздаю на новых образах …');
    await this.compose.up(target, { onLine: (line) => this.deps.log(id, line, 'dim') });
    progress(100, 'образы свежие');
  }

  /** Снимает контейнеры. Каталог стека с данными остаётся, если purge = false. */
  async remove(id: string, progress: ProgressFn, purge = false): Promise<void> {
    const profiles = (await this.meta(id))?.profiles ?? [];
    progress(20, 'снимаю контейнеры …');
    await this.safeDown(id, profiles);

    if (purge) {
      progress(70, 'удаляю каталог стека …');
      await fs.rm(this.layout.stackDir(id), { recursive: true, force: true });
      this.deps.log(id, 'стек удалён вместе с данными', 'err');
    } else {
      // compose и данные остаются: сервис можно поднять обратно тем же up
      this.deps.log(id, `стек снят · данные остались в ${this.layout.stackDir(id)}`, 'warn');
    }
    progress(100, 'готово');
  }

  // ── внутреннее ────────────────────────────────────────────────────────────

  private trace(id: string, line: string, progress?: ProgressFn): void {
    this.deps.log(id, line, 'dim');
    progress?.(50, line.slice(0, 80));
  }

  private async safeDown(id: string, profiles: string[]): Promise<void> {
    try {
      await this.compose.down(this.target(id, profiles), {
        onLine: (line) => this.deps.log(id, line, 'dim'),
      });
    } catch (err) {
      this.deps.log(id, `не удалось снять стек: ${describe(err)}`, 'err');
    }
  }

  private target(id: string, profiles: string[]): ComposeTarget {
    return {
      id,
      dir: this.layout.stackDir(id),
      file: this.layout.composePath(id),
      profiles,
    };
  }

  private async meta(id: string): Promise<StackMeta | null> {
    try {
      return JSON.parse(await fs.readFile(this.layout.metaPath(id), 'utf8')) as StackMeta;
    } catch {
      return null;
    }
  }

  private serviceCount(manifest: StackManifest): number {
    if (typeof manifest.compose === 'string') return 3;
    const services = (manifest.compose as { services?: Record<string, unknown> }).services;
    return services ? Object.keys(services).length : 1;
  }

  /** Compose-документ стека: либо из отдельного файла реестра, либо из манифеста. */
  private async composeDocument(manifest: StackManifest, stackId: string): Promise<string> {
    if (typeof manifest.compose === 'string') {
      return this.registry.file(stackId, manifest.compose);
    }
    const header =
      '# Сгенерировано dock из stack.yaml. Значения подставляет docker compose из .env рядом.\n';
    return header + stringify(manifest.compose, { lineWidth: 0 });
  }

  /**
   * Раскладывает стек по каталогу. Всё, что здесь пишется, — это состояние
   * сервиса целиком: перенеси каталог на другую машину, и `docker compose up`
   * поднимет то же самое.
   */
  private async materialize(
    id: string,
    manifest: StackManifest,
    manifestRaw: string,
    values: StackValues,
    profiles: string[],
  ): Promise<void> {
    const dir = this.layout.stackDir(id);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(this.layout.manifestPath(id), manifestRaw, 'utf8');
    await fs.writeFile(this.layout.composePath(id), await this.composeDocument(manifest, id), 'utf8');

    // контекстные переменные в .env не пишем как секреты, но пишем как значения:
    // без них compose не разрешит ${DOCK_STACK_DIR} в путях монтирования
    await fs.writeFile(
      this.layout.envPath(id),
      renderEnvFile(values, `# Значения стека ${id}. Правится через панель, читается docker compose.`),
      { encoding: 'utf8', mode: 0o600 },
    );

    for (const file of manifest.files ?? []) {
      if (file.when && values[file.when] !== true) continue;
      if (file.whenNot && values[file.whenNot] === true) continue;

      const source = file.content !== undefined ? file.content : await this.registry.file(id, file.template as string);
      let rendered: string;
      try {
        rendered = renderTemplate(source, values);
      } catch (err) {
        throw new DriverError(`${file.path}: ${describe(err)}`, 422, 'bad_template');
      }

      const target = this.layout.resolveInStack(id, file.path);
      await fs.mkdir(path.posix.dirname(target), { recursive: true });
      await fs.writeFile(target, rendered, {
        encoding: 'utf8',
        mode: file.mode ? Number.parseInt(file.mode, 8) : 0o644,
      });
    }

    for (const volume of manifest.volumes ?? []) {
      const target = this.layout.resolveInStack(id, volume.path);
      await fs.mkdir(target, { recursive: true });
      if (volume.mode) {
        await fs.chmod(target, Number.parseInt(volume.mode, 8)).catch(() => undefined);
      }
      if (volume.owner) {
        const [uid, gid] = volume.owner.split(':').map(Number);
        await fs.chown(target, uid as number, gid as number).catch((err: Error) => {
          this.deps.log(id, `не сменить владельца ${volume.path}: ${err.message}`, 'warn');
        });
      }
    }

    const meta: StackMeta = {
      installedAt: (await this.meta(id))?.installedAt ?? new Date().toISOString(),
      secrets: secretKeys(manifest),
      profiles,
      version: manifest.version,
    };
    await fs.writeFile(this.layout.metaPath(id), JSON.stringify(meta, null, 2), 'utf8');
  }
}

/** Ключи, которые панель не показывает в форме: их подставляет ядро. */
export const CONTEXT_KEYS = contextKeys();

/**
 * Отсеивает построчный прогресс докера. `abc123 Downloading 15.73MB` десятки раз
 * в секунду — это шум, из-за которого в журнале не видно ничего осмысленного;
 * прогресс и так уезжает в панель отдельным событием задачи.
 */
function worthLogging(line: string): boolean {
  return !/^\S+\s+(Downloading|Extracting|Waiting|Pulling fs layer|Already exists|Verifying Checksum|Download complete|Pull complete)\b/i.test(
    line,
  );
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Подстановка значений в адрес и заметки.
 *
 * В отличие от файлов стека, недостающая переменная здесь не ошибка: показать
 * заметку с неразвёрнутым `${VAR}` полезнее, чем не показать ничего и оставить
 * человека без пароля.
 */
export function renderPost(post: StackPost, values: StackValues): StackPostInfo {
  const safe = (source: string | undefined): string | undefined => {
    if (!source) return undefined;
    try {
      return renderTemplate(source, values);
    } catch {
      return source;
    }
  };

  const info: StackPostInfo = {};
  const url = safe(post.url);
  const notes = safe(post.notes);
  if (url) info.url = url;
  if (notes) info.notes = notes;
  return info;
}
