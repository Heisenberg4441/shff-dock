import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import type { RegistryEntry, RegistryIndex, RegistrySource, StackManifest } from '@dock/shared';
import { DriverError, NotFoundError } from '../driver';
import { parseManifest } from './manifest';

/** Откуда берутся файлы стека: с диска или по http. */
interface Provider {
  readonly kind: 'bundled' | 'remote';
  readonly url: string;
  read(relative: string): Promise<string>;
}

class LocalProvider implements Provider {
  readonly kind = 'bundled' as const;

  constructor(readonly url: string) {}

  async read(relative: string): Promise<string> {
    const root = path.resolve(this.url);
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new DriverError(`путь ${relative} уходит за пределы реестра`, 400);
    }
    return fs.readFile(full, 'utf8');
  }
}

class HttpProvider implements Provider {
  readonly kind = 'remote' as const;

  constructor(
    readonly url: string,
    private readonly cacheDir: string,
  ) {}

  async read(relative: string): Promise<string> {
    const target = `${this.url.replace(/\/+$/, '')}/${relative.replace(/^\/+/, '')}`;
    const res = await fetch(target, {
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'text/plain, application/yaml, */*' },
    });
    if (!res.ok) {
      throw new DriverError(`реестр вернул ${res.status} на ${relative}`, 502, 'registry_error');
    }
    const body = await res.text();
    await this.cache(relative, body);
    return body;
  }

  /** Кэш нужен ради одного: панель должна работать, когда гитхаб недоступен. */
  private async cache(relative: string, body: string): Promise<void> {
    try {
      const full = this.inCache(relative);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, body, 'utf8');
    } catch {
      /* кэш не критичен */
    }
  }

  async readCached(relative: string): Promise<string> {
    return fs.readFile(this.inCache(relative), 'utf8');
  }

  /**
   * Путь внутри кэша. Складывается он из `path` чужого registry.yaml, то есть
   * из текста, который панель скачала из интернета, — поэтому проверяется, что
   * запись не уходит выше кэша.
   */
  private inCache(relative: string): string {
    const root = path.resolve(this.cacheDir);
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new DriverError(`путь ${relative} уходит за пределы кэша реестра`, 400);
    }
    return full;
  }
}

/**
 * Реестр готовых стеков.
 *
 * Стеки живут отдельным репозиторием и приезжают по сети — в образе панели их
 * нет, поэтому каталог пополняется коммитом в реестр, а не выкаткой новой
 * версии панели всем подряд. Скачанное оседает в кэше на хосте: недоступный
 * гитхаб перестаёт быть поводом не поставить сервис.
 *
 * Локальный каталог (`DOCK_BUNDLED_REGISTRY`) необязателен и нужен тем, кто
 * пишет свои стеки: он идёт в основу, а удалённые стеки накладываются сверху —
 * одноимённые перекрывают локальные, остальные добавляются.
 */
export class Registry {
  private entries: RegistryEntry[] = [];
  private providers = new Map<string, { provider: Provider; base: string }>();
  private status: RegistrySource;

  constructor(
    private readonly bundledDir: string,
    private readonly remoteUrl: string,
    private readonly cacheDir: string,
    private readonly log: (text: string, level?: 'ok' | 'warn' | 'err' | 'dim') => void,
  ) {
    this.status = {
      kind: remoteUrl ? 'remote' : 'bundled',
      url: remoteUrl || bundledDir,
      fetchedAt: null,
    };
  }

  /** Пустой путь — штатная ситуация: локального реестра просто нет. */
  private get hasBundled(): boolean {
    return this.bundledDir.trim().length > 0;
  }

  source(): RegistrySource {
    return { ...this.status };
  }

  list(): RegistryEntry[] {
    return this.entries;
  }

  entry(id: string): RegistryEntry {
    const found = this.entries.find((e) => e.id === id);
    if (!found) throw new NotFoundError(id);
    return found;
  }

  async load(): Promise<void> {
    const merged = new Map<string, RegistryEntry>();
    const providers = new Map<string, { provider: Provider; base: string }>();

    if (this.hasBundled) {
      const bundled = new LocalProvider(this.bundledDir);
      try {
        const index = await this.readIndex(bundled);
        for (const entry of index.stacks) {
          merged.set(entry.id, entry);
          providers.set(entry.id, { provider: bundled, base: entry.path });
        }
      } catch (err) {
        this.log(`локальный реестр ${this.bundledDir} не прочитался: ${describe(err)}`, 'err');
      }
    }

    if (this.remoteUrl) {
      const remote = new HttpProvider(this.remoteUrl, this.cacheDir);
      try {
        const index = await this.readIndex(remote);
        for (const entry of index.stacks) {
          merged.set(entry.id, entry);
          providers.set(entry.id, { provider: remote, base: entry.path });
        }
        this.status = { kind: 'remote', url: this.remoteUrl, fetchedAt: new Date().toISOString() };
        this.log(`реестр обновлён · ${index.stacks.length} стеков из ${this.remoteUrl}`, 'ok');
      } catch (err) {
        // сеть отвалилась — пробуем то, что уже лежит в кэше
        const message = describe(err);
        try {
          const cachedRaw = await remote.readCached('registry.yaml');
          const index = this.parseIndex(cachedRaw);
          for (const entry of index.stacks) {
            merged.set(entry.id, entry);
            providers.set(entry.id, { provider: remote, base: entry.path });
          }
          this.status = { kind: 'remote', url: this.remoteUrl, fetchedAt: null, error: message };
          this.log(`реестр недоступен, взял кэш: ${message}`, 'warn');
        } catch {
          // ни сети, ни кэша: остаётся то, что нашлось на диске, а обычно ничего
          this.status = { kind: 'bundled', url: this.bundledDir, fetchedAt: null, error: message };
          this.log(`реестр недоступен и кэша нет: ${message}`, merged.size ? 'warn' : 'err');
        }
      }
    }

    this.entries = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.providers = providers;

    // Пустой каталог выглядит как поломка панели, хотя дело в реестре, —
    // поэтому причина проговаривается вслух, а не остаётся пустым экраном.
    if (!this.entries.length) {
      this.log('каталог пуст — до реестра не достучаться, ставить нечего', 'err');
    }
  }

  /** Манифест стека — читается по требованию, а не при загрузке индекса. */
  async manifest(id: string): Promise<StackManifest> {
    const source = this.providerFor(id);
    const raw = await this.readWithFallback(source, `${source.base}/stack.yaml`);
    const manifest = parseManifest(raw);
    if (manifest.id !== id) {
      throw new DriverError(`в реестре id ${id}, а в манифесте ${manifest.id}`, 422, 'bad_manifest');
    }
    return manifest;
  }

  /** Файл стека: compose-документ или шаблон конфига. */
  async file(id: string, relative: string): Promise<string> {
    const source = this.providerFor(id);
    return this.readWithFallback(source, `${source.base}/${relative.replace(/^\/+/, '')}`);
  }

  private providerFor(id: string): { provider: Provider; base: string } {
    const source = this.providers.get(id);
    if (!source) throw new NotFoundError(id);
    return source;
  }

  private async readWithFallback(
    source: { provider: Provider; base: string },
    relative: string,
  ): Promise<string> {
    try {
      return await source.provider.read(relative);
    } catch (err) {
      if (source.provider instanceof HttpProvider) {
        try {
          return await source.provider.readCached(relative);
        } catch {
          /* в кэше тоже нет */
        }
      }
      throw new DriverError(`не прочитать ${relative}: ${describe(err)}`, 502, 'registry_error');
    }
  }

  private async readIndex(provider: Provider): Promise<RegistryIndex> {
    return this.parseIndex(await provider.read('registry.yaml'));
  }

  private parseIndex(raw: string): RegistryIndex {
    const doc = parse(raw) as RegistryIndex | null;
    if (!doc || doc.kind !== 'Registry' || !Array.isArray(doc.stacks)) {
      throw new DriverError('registry.yaml: ожидается kind: Registry со списком stacks', 422);
    }
    for (const entry of doc.stacks) {
      if (!entry.id || !entry.path) {
        throw new DriverError('registry.yaml: у каждой записи обязательны id и path', 422);
      }
      // path превращается и в адрес запроса, и в путь в кэше, а приезжает из
      // чужого репозитория — поэтому только каталог относительно корня реестра
      if (/^([a-z]+:)?[\\/]/i.test(entry.path) || /(^|[\\/])\.\.([\\/]|$)/.test(entry.path)) {
        throw new DriverError(
          `registry.yaml: path ${entry.path} должен быть путём внутри реестра`,
          422,
        );
      }
    }
    return doc;
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
