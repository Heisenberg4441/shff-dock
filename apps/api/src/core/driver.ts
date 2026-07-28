import type { DriverInfo, HostStats, LogLevel, Service, Settings, StackValues } from '@dock/shared';

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
 * DockerodeDriver ходит в настоящий демон и раскладывает стеки по
 * /home/dock/stacks. Всё остальное ядро (маршруты, журнал, настройки, задачи)
 * о разнице не знает — поэтому переключение режима это одна переменная
 * окружения, а не ветка в коде.
 */
export interface DockerDriver {
  readonly kind: 'mock' | 'docker';

  init(ctx: DriverContext): Promise<void>;
  info(): Promise<DriverInfo>;

  /** Полный снимок: стеки со свёрнутыми в них контейнерами плюс чужие контейнеры. */
  list(): Promise<Service[]>;

  start(id: string, progress?: ProgressFn): Promise<void>;
  stop(id: string, progress?: ProgressFn): Promise<void>;
  restart(id: string, progress?: ProgressFn): Promise<void>;
  pull(id: string, progress: ProgressFn): Promise<void>;

  /** Ставит стек из реестра с введёнными значениями инпутов. */
  installStack(stackId: string, values: StackValues, progress: ProgressFn): Promise<void>;

  /** Применяет новые значения инпутов к уже стоящему стеку. */
  applyStackValues(id: string, values: StackValues, progress: ProgressFn): Promise<void>;

  /** Снимает стек. purge = true — вместе с каталогом данных. */
  removeStack(id: string, progress: ProgressFn, purge?: boolean): Promise<void>;

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
