import type {
  DriverInfo,
  HostStats,
  LogLevel,
  RestartPolicy,
  Service,
  ServiceConfig,
  Settings,
} from '@dock/shared';

/** Что нужно знать драйверу, чтобы поднять новый сервис. */
export interface CreateServiceSpec {
  id: string;
  name: string;
  desc: string;
  image: string;
  hostPort: string;
  containerPort: string;
  /** Путь тома относительно корня томов: 'dock/gitea'. */
  volume: string;
  mount: string;
  domain: string;
  restart: RestartPolicy;
  env: string;
  autostart: boolean;
  backup: boolean;
}

export type ProgressFn = (pct: number, step: string) => void;

/** Обратные вызовы ядра, которые драйвер получает при инициализации. */
export interface DriverContext {
  log(svc: string, text: string, level?: LogLevel): void;
  /** Актуальные настройки панели: часовой пояс, домен, корень данных. */
  settings(): Settings;
  /** Сообщить ядру, что снимок сервисов изменился и его пора разослать. */
  changed(): void;
}

/**
 * Единственная точка соприкосновения ядра с хостом.
 *
 * Ровно два воплощения: MockDriver держит выдуманный хост в памяти,
 * DockerodeDriver ходит в настоящий демон по сокету. Всё остальное ядро
 * (маршруты, журнал, настройки, задачи) о разнице не знает — поэтому
 * переключение режима это одна переменная окружения, а не ветка в коде.
 */
export interface DockerDriver {
  readonly kind: 'mock' | 'docker';

  init(ctx: DriverContext): Promise<void>;
  info(): Promise<DriverInfo>;

  /** Полный снимок сервисов вместе со свежими метриками. */
  list(): Promise<Service[]>;

  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  pull(id: string, onProgress: ProgressFn): Promise<void>;
  remove(id: string): Promise<void>;

  create(spec: CreateServiceSpec, onProgress: ProgressFn): Promise<Service>;

  /** Применяет конфиг: контейнер пересоздаётся с новыми параметрами. */
  applyConfig(id: string, config: ServiceConfig, onProgress: ProgressFn): Promise<void>;

  host(): Promise<HostStats>;

  dispose(): Promise<void>;
}

/** Ошибка, которую маршруты превращают в 4xx вместо 500. */
export class DriverError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'driver_error',
  ) {
    super(message);
    this.name = 'DriverError';
  }
}

export class NotFoundError extends DriverError {
  constructor(what: string) {
    super(`нет такого сервиса: ${what}`, 404, 'not_found');
    this.name = 'NotFoundError';
  }
}
