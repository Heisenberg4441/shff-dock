/**
 * Доменные типы SHFF Dock. Один источник правды для ядра и панели:
 * apps/api отдаёт ровно эти структуры, apps/web ровно их и рисует.
 */

export type ServiceStatus = 'running' | 'stopped' | 'updating' | 'error';

export type RestartPolicy = 'unless-stopped' | 'always' | 'on-failure' | 'no';

export const RESTART_POLICIES: RestartPolicy[] = ['unless-stopped', 'always', 'on-failure', 'no'];

/** Уровень строки журнала — определяет цвет в терминале панели. */
export type LogLevel = 'ok' | 'info' | 'warn' | 'err' | 'dim';

/**
 * Сервис = один управляемый докером контейнер плюс метаданные dock.
 * Числовые поля (`cpu`/`mem`/`vol`) — проценты 0..100 для прогресс-баров,
 * строковые (`usage`/`uptime`) — уже отформатированные подписи.
 */
export interface Service {
  id: string;
  name: string;
  desc: string;
  /** ':8096' для проброшенного порта, '—' если наружу ничего не торчит. */
  port: string;
  status: ServiceStatus;
  cpu: number;
  mem: number;
  vol: number;
  usage: string;
  uptime: string;
  image: string;
  /** Поддомен без базового домена: 'media' → media.home.lan. '—' если прокси не нужен. */
  domain: string;
  /** Путь тома относительно каталога данных: 'dock/jellyfin'. */
  volume: string;
  restart: RestartPolicy;
  autostart: boolean;
  backup: boolean;
  /** Переменные окружения, по паре KEY=value на строку. */
  env: string;
  /** Полный id контейнера в докере; null у сервисов, которых на хосте ещё нет. */
  containerId: string | null;
  /** true, если контейнер создан самим dock (помечен меткой dock.managed). */
  managed: boolean;
}

/** Изменяемая через панель часть сервиса. */
export interface ServiceConfig {
  port: string;
  domain: string;
  volume: string;
  restart: RestartPolicy;
  env: string;
  autostart: boolean;
  backup: boolean;
}

export interface HostStats {
  cpu: string;
  cpuPct: number;
  ram: string;
  ramPct: number;
  disk: string;
  diskPct: number;
  uptime: string;
  uptimeSeconds: number;
}

export interface LogEntry {
  id: string;
  /** Локальное время хоста в формате HH:MM:SS. */
  ts: string;
  /** id сервиса либо 'dock' для сообщений самой панели. */
  svc: string;
  level: LogLevel;
  text: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  cat: string;
  desc: string;
  meta: string;
  /** Порт на хосте по умолчанию. */
  port: string;
  /** Порт, который образ слушает внутри контейнера. */
  containerPort: string;
  /** Том по умолчанию относительно каталога данных. */
  vol: string;
  image: string;
  /** Куда монтировать том внутри контейнера. */
  mount: string;
  env: Record<string, string>;
}

export interface Settings {
  hostname: string;
  domain: string;
  tz: string;
  root: string;
  autoUpdate: boolean;
  crt: boolean;
  proxy: string;
  panelPort: string;
  tls: boolean;
  lanOnly: boolean;
  cron: string;
  keep: string;
  backupPath: string;
  operator: string;
  totp: boolean;
  audit: boolean;
}

export const TZ_OPTIONS = ['Europe/Belgrade', 'Europe/Moscow', 'Europe/Berlin', 'Asia/Tbilisi', 'UTC'];
export const PROXY_OPTIONS = ['caddy', 'traefik', 'nginx', 'без прокси'];
export const KEEP_OPTIONS = ['7 копий', '14 копий', '30 копий', 'всё хранить'];

export type JobKind = 'install' | 'pull' | 'remove' | 'backup' | 'restart';
export type JobStatus = 'running' | 'done' | 'error';

/** Долгая операция ядра; прогресс уезжает клиенту событиями по вебсокету. */
export interface Job {
  id: string;
  kind: JobKind;
  /** id сервиса или элемента каталога, к которому относится операция. */
  target: string;
  pct: number;
  step: string;
  status: JobStatus;
  error?: string;
}

export interface BackupInfo {
  /** Готовая подпись для панели: '// последний бэкап: … · 4.2 GB'. */
  label: string;
  at: string | null;
  size: string | null;
}

export interface InstallRequest {
  catalogId: string;
  port: string;
  domain: string;
  volume: string;
  autostart: boolean;
}

export interface ConsoleResult {
  lines: string[];
  /** Навигационный побочный эффект команды: `dock logs` уводит на #logs. */
  navigate?: string;
  /** Команда `clear` просит панель очистить буфер консоли. */
  clear?: boolean;
}

export interface DriverInfo {
  driver: 'mock' | 'docker';
  version: string;
  /** Доступен ли докер-сокет; в mock-режиме всегда true. */
  connected: boolean;
  message?: string;
}
