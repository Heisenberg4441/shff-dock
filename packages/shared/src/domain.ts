/**
 * Доменные типы SHFF Dock. Один источник правды для ядра и панели:
 * apps/api отдаёт ровно эти структуры, apps/web ровно их и рисует.
 */

export type ServiceStatus = 'running' | 'stopped' | 'updating' | 'error';

export type RestartPolicy = 'unless-stopped' | 'always' | 'on-failure' | 'no';

export const RESTART_POLICIES: RestartPolicy[] = ['unless-stopped', 'always', 'on-failure', 'no'];

/** Уровень строки журнала — определяет цвет в терминале панели. */
export type LogLevel = 'ok' | 'info' | 'warn' | 'err' | 'dim';

/** Контейнер внутри стека — одна строка в списке участников. */
export interface ContainerRef {
  /** Полный id контейнера в докере. */
  id: string;
  /** Имя сервиса в compose: 'grafana', 'prometheus'. */
  service: string;
  name: string;
  image: string;
  status: ServiceStatus;
  cpu: number;
  mem: number;
  usage: string;
  uptime: string;
  port: string;
}

/**
 * Карточка сервиса в панели. Это либо стек (один или несколько контейнеров,
 * поднятых одним compose-файлом), либо одиночный контейнер, найденный на хосте
 * и поднятый не через dock.
 *
 * Числовые поля (`cpu`/`mem`/`vol`) — проценты 0..100 для прогресс-баров,
 * строковые (`usage`/`uptime`) — уже отформатированные подписи. У стека они
 * агрегированы по всем контейнерам.
 */
export interface Service {
  /** 'stack' — поднят панелью из манифеста, 'container' — чужой контейнер. */
  kind: 'stack' | 'container';
  /** id стека, если сервис им является. */
  stackId: string | null;
  /** Версия манифеста, из которого стек поставлен. */
  version: string | null;
  /** Участники стека; у одиночного контейнера — он сам. */
  containers: ContainerRef[];
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
  /** Каталог стека на хосте: /home/dock/stacks/grafana. */
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

/**
 * Метрики хоста, а не контейнера панели. Если ядро видит только то, что
 * выделено докеру, `truthful` = false — панель об этом честно скажет вместо
 * того, чтобы показывать 30 ГБ там, где на машине 64.
 */
export interface HostStats {
  cpu: string;
  cpuPct: number;
  /** Сколько ядер у хоста. */
  cpuCores: number;
  ram: string;
  ramPct: number;
  disk: string;
  diskPct: number;
  uptime: string;
  uptimeSeconds: number;
  /** true, если цифры сняты с хоста (примонтированы /host/proc и rootfs). */
  truthful: boolean;
  /** Что именно не примонтировано, если truthful = false. */
  note?: string;
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
  /** Есть ли рядом `docker compose` — без него стеки не поднять. */
  composeVersion?: string;
  /** Корень раскладки: /home/dock. */
  root?: string;
}
