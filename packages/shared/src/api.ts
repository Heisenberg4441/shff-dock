import type {
  BackupInfo,
  ConsoleResult,
  DriverInfo,
  HostStats,
  Job,
  LogEntry,
  Service,
  ServiceConfig,
  Settings,
} from './domain';

/** Префикс всех HTTP-ручек ядра. */
export const API_PREFIX = '/api';

/** Путь вебсокета внутри префикса API — им сервер регистрирует маршрут. */
export const WS_ROUTE = '/stream';

/** Полный путь вебсокета — по нему подключается панель. */
export const WS_PATH = `${API_PREFIX}${WS_ROUTE}`;

/**
 * События сервер → клиент. Панель держит один сокет и раскладывает
 * события по своему стору, поэтому дополнительный поллинг не нужен.
 */
export type ServerEvent =
  | { type: 'hello'; driver: DriverInfo }
  | { type: 'log'; entry: LogEntry }
  | { type: 'services'; services: Service[] }
  | { type: 'host'; host: HostStats }
  | { type: 'job'; job: Job }
  | { type: 'settings'; settings: Settings }
  | { type: 'backup'; backup: BackupInfo };

/** Сообщения клиент → сервер. Пока только пинг, чтобы держать соединение живым. */
export type ClientMessage = { type: 'ping' };

export interface ApiError {
  error: string;
  message: string;
}

export interface ServicesResponse {
  services: Service[];
}

export interface LogsResponse {
  logs: LogEntry[];
}

export interface JobResponse {
  job: Job;
}

export interface ConsoleRequest {
  cmd: string;
}

export type { ConsoleResult };

export interface BootstrapResponse {
  driver: DriverInfo;
  host: HostStats;
  services: Service[];
  settings: Settings;
  backup: BackupInfo;
  logs: LogEntry[];
}

/**
 * Пути ручек в одном месте: сервер регистрирует эти шаблоны как есть,
 * клиент подставляет в них id через `withParams` — рассинхрон невозможен.
 */
export const routes = {
  health: '/health',
  bootstrap: '/bootstrap',
  host: '/host',
  services: '/services',
  install: '/services/install',
  pullAll: '/services/pull-all',
  service: '/services/:id',
  serviceStart: '/services/:id/start',
  serviceStop: '/services/:id/stop',
  serviceRestart: '/services/:id/restart',
  servicePull: '/services/:id/pull',
  serviceCompose: '/services/:id/compose',
  catalog: '/catalog',
  catalogCompose: '/catalog/:id/compose',
  logs: '/logs',
  settings: '/settings',
  settingsReset: '/settings/reset',
  backupRun: '/backup/run',
  console: '/console',
  daemonRestart: '/daemon/restart',
} as const;

/** '/services/:id' + { id: 'gitea' } → '/services/gitea'. */
export function withParams(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/:(\w+)/g, (_match, key: string) =>
    encodeURIComponent(params[key] ?? ''),
  );
}

export type ServiceConfigPatch = Partial<ServiceConfig>;
