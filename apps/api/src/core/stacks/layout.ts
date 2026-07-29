import fs from 'node:fs/promises';
import path from 'node:path';

export interface LayoutPaths {
  root: string;
  stacks: string;
  registry: string;
  backups: string;
  config: string;
  /** /home/dock/media — общая библиотека, живущая дольше любого стека. */
  media: string;
}

/**
 * Раскладка на хосте. Одна на всю панель и одинаковая на любой машине:
 *
 *   /home/dock/
 *   ├── stacks/<id>/        стек целиком: манифест, compose, .env, конфиги, data
 *   ├── media/              общая библиотека: music, films, shows
 *   ├── registry/           кэш скачанных манифестов
 *   ├── backups/
 *   ├── dock.yml            настройки панели
 *   └── state.json          служебные отметки
 *
 * Медиа лежит отдельно от стеков намеренно: качалка, музыкальный сервер и
 * медиатека — разные стеки, но библиотека у них одна, и снос любого из них
 * не должен её задевать.
 *
 * Каталог стека самодостаточен: скопировал его на другую машину и поднял тем же
 * `docker compose up` — получил тот же сервис. Панель ничего не прячет в своей
 * базе, потому что базы у неё нет.
 *
 * Путь внутри контейнера панели и снаружи обязан совпадать: bind-монтирования
 * в сгенерированных compose-файлах — это пути на хосте, а записывает их процесс
 * внутри контейнера.
 */
export class Layout {
  constructor(readonly paths: LayoutPaths) {}

  /** Создаёт дерево при старте — панель не должна требовать ручной подготовки. */
  async ensure(): Promise<void> {
    for (const dir of [
      this.paths.root,
      this.paths.stacks,
      this.paths.media,
      this.paths.registry,
      this.paths.backups,
    ]) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  stackDir(id: string): string {
    return path.posix.join(this.paths.stacks, id);
  }

  composePath(id: string): string {
    return path.posix.join(this.stackDir(id), 'compose.yaml');
  }

  envPath(id: string): string {
    return path.posix.join(this.stackDir(id), '.env');
  }

  manifestPath(id: string): string {
    return path.posix.join(this.stackDir(id), 'stack.yaml');
  }

  /** Отметка ядра о стеке: когда поставлен, какие ключи считать секретами. */
  metaPath(id: string): string {
    return path.posix.join(this.stackDir(id), '.dock.json');
  }

  /** Каталоги установленных стеков — по наличию compose-файла. */
  async listStackIds(): Promise<string[]> {
    let entries;
    try {
      entries = await fs.readdir(this.paths.stacks, { withFileTypes: true });
    } catch {
      return [];
    }
    const ids: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await fs.access(this.composePath(entry.name));
        ids.push(entry.name);
      } catch {
        /* каталог без compose стеком не считается */
      }
    }
    return ids.sort();
  }

  /**
   * Защита от выхода за пределы каталога стека: путь файла приходит из
   * манифеста, который может быть скачан из чужого репозитория.
   */
  resolveInStack(id: string, relative: string): string {
    const base = this.stackDir(id);
    const full = path.posix.normalize(path.posix.join(base, relative));
    if (full !== base && !full.startsWith(base + '/')) {
      throw new Error(`путь ${relative} уходит за пределы каталога стека`);
    }
    return full;
  }

  /**
   * Общий каталог: media/films и подобные, живущие вне стека. Проверка та же —
   * манифест приезжает из чужого репозитория, и `../../etc` в нём не должно
   * никуда попасть.
   */
  resolveShared(relative: string): string {
    const base = this.paths.root;
    const full = path.posix.normalize(path.posix.join(base, relative));
    if (full === base || !full.startsWith(base + '/')) {
      throw new Error(`общий путь ${relative} уходит за пределы ${base}`);
    }
    if (full === this.paths.stacks || full.startsWith(this.paths.stacks + '/')) {
      throw new Error(`общий путь ${relative} ведёт внутрь stacks — это каталог стеков`);
    }
    return full;
  }
}
