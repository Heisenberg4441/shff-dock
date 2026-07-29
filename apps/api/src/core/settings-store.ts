import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import type { BackupInfo, Settings } from '@dock/shared';
import { humanBytes } from './format';
import type { HostIdentity } from './host-identity';

/**
 * Последний рубеж: сюда падаем, только если хост не примонтирован и спросить
 * его не у кого. Имя, пояс и оператор в норме определяются по хосту.
 */
export const DEFAULT_SETTINGS: Settings = {
  hostname: 'homelab',
  domain: 'home.lan',
  tz: 'Europe/Belgrade',
  root: 'dock',
  autoUpdate: true,
  crt: true,
  proxy: 'caddy',
  panelPort: '7788',
  tls: true,
  lanOnly: false,
  cron: '0 3 * * *',
  keep: '14 копий',
  backupPath: 'srv/backup',
  operator: 'mikhail',
  totp: true,
  audit: true,
};

interface StoredState {
  settings: Settings;
  backup: { at: string | null; sizeBytes: number | null };
}

/**
 * Значения, приехавшие из макета. Панель раздавала их как настоящие: они
 * уходили в TZ каждого контейнера и в ссылки вида http://homelab:8929.
 * В уже сохранённом dock.yml они означают не выбор пользователя, а то, что
 * спросить хост панель тогда не умела, — поэтому их можно молча заменить.
 */
const PROTOTYPE_VALUES = {
  hostname: 'homelab',
  tz: 'Europe/Belgrade',
  operator: 'mikhail',
} as const;

type IdentityKey = keyof typeof PROTOTYPE_VALUES;

/**
 * Всё, что меняется на экране настроек, лежит в одном файле dock.yml —
 * ровно так, как обещает лид страницы. Рядом кладётся state.json со
 * служебными отметками (когда прошёл последний бэкап).
 */
export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private backupAt: string | null = null;
  private backupSize: number | null = null;

  /** Каким панель увидела хост при загрузке. Основа для reset. */
  private base: Settings = { ...DEFAULT_SETTINGS };

  constructor(
    private readonly dataDir: string,
    private readonly detect: () => Promise<HostIdentity>,
    private readonly log: (text: string, level?: 'ok' | 'warn' | 'dim') => void = () => {},
  ) {}

  private get configPath(): string {
    return path.join(this.dataDir, 'dock.yml');
  }

  private get statePath(): string {
    return path.join(this.dataDir, 'state.json');
  }

  async load(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    const identity = await this.detect();
    this.base = { ...DEFAULT_SETTINGS, ...identity };

    let stored: Partial<Settings> | null = null;
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      const parsed = parse(raw) as Partial<Settings> | null;
      if (parsed && typeof parsed === 'object') stored = parsed;
    } catch {
      /* первого запуска ещё не было */
    }

    if (!stored) {
      this.settings = { ...this.base };
      await this.persist();
      this.log(`хост: ${identity.operator}@${identity.hostname} · ${identity.tz}`, 'dim');
    } else {
      this.settings = { ...this.base, ...stored };
      if (await this.healPrototypeValues(identity)) {
        this.log(`настройки хоста уточнены: ${identity.operator}@${identity.hostname} · ${identity.tz}`, 'ok');
      }
    }
    try {
      const raw = await fs.readFile(this.statePath, 'utf8');
      const state = JSON.parse(raw) as StoredState['backup'];
      this.backupAt = state?.at ?? null;
      this.backupSize = state?.sizeBytes ?? null;
    } catch {
      /* отметок о бэкапах ещё нет */
    }
  }

  get(): Settings {
    return { ...this.settings };
  }

  async save(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch };
    await this.persist();
    return this.get();
  }

  async reset(): Promise<Settings> {
    // Сброс возвращает к тому, что панель видит на хосте, а не к макету.
    this.settings = { ...this.base };
    await this.persist();
    return this.get();
  }

  /**
   * Замена значений из макета на настоящие. Трогается только то, что в точности
   * совпало с макетным: если человек сам вписал имя хоста, оно остаётся.
   */
  private async healPrototypeValues(identity: HostIdentity): Promise<boolean> {
    let changed = false;
    for (const key of Object.keys(PROTOTYPE_VALUES) as IdentityKey[]) {
      if (this.settings[key] === PROTOTYPE_VALUES[key] && identity[key] !== PROTOTYPE_VALUES[key]) {
        this.settings[key] = identity[key];
        changed = true;
      }
    }
    if (changed) await this.persist();
    return changed;
  }

  async markBackup(sizeBytes: number): Promise<BackupInfo> {
    this.backupAt = new Date().toISOString();
    this.backupSize = sizeBytes;
    await fs.writeFile(
      this.statePath,
      JSON.stringify({ at: this.backupAt, sizeBytes: this.backupSize }, null, 2),
      'utf8',
    );
    return this.backupInfo();
  }

  backupInfo(): BackupInfo {
    if (!this.backupAt) {
      return { label: '// бэкапов ещё не было', at: null, size: null };
    }
    const size = this.backupSize ? humanBytes(this.backupSize) : null;
    const stamp = this.backupAt.replace('T', ' ').slice(0, 16);
    return {
      label: `// последний бэкап: ${stamp}${size ? ` · ${size}` : ''}`,
      at: this.backupAt,
      size,
    };
  }

  private async persist(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const header = '# SHFF Dock — конфиг панели. Правится через ~/settings или руками.\n';
    await fs.writeFile(this.configPath, header + stringify(this.settings), 'utf8');
  }
}
