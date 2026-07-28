import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import type { BackupInfo, Settings } from '@dock/shared';
import { humanBytes } from './format';

/** Значения из прототипа — они же дефолт свежей установки. */
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
 * Всё, что меняется на экране настроек, лежит в одном файле dock.yml —
 * ровно так, как обещает лид страницы. Рядом кладётся state.json со
 * служебными отметками (когда прошёл последний бэкап).
 */
export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private backupAt: string | null = null;
  private backupSize: number | null = null;

  constructor(private readonly dataDir: string) {}

  private get configPath(): string {
    return path.join(this.dataDir, 'dock.yml');
  }

  private get statePath(): string {
    return path.join(this.dataDir, 'state.json');
  }

  async load(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.configPath, 'utf8');
      const parsed = parse(raw) as Partial<Settings> | null;
      if (parsed && typeof parsed === 'object') {
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // первого запуска ещё не было — пишем дефолт, чтобы файл существовал
      await this.persist();
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
    this.settings = { ...DEFAULT_SETTINGS };
    await this.persist();
    return this.get();
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
