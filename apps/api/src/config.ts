import path from 'node:path';

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

const driverEnv = str('DOCK_DRIVER', 'mock').toLowerCase();

export const config = {
  /** Порт панели. По умолчанию совпадает с panelPort в настройках. */
  port: int('PORT', 7788),
  host: str('HOST', '0.0.0.0'),

  /** mock — синтетический хост, docker — настоящий демон на сокете. */
  driver: (driverEnv === 'docker' ? 'docker' : 'mock') as 'mock' | 'docker',

  /** Куда ядро пишет dock.yml, compose-файлы и метку последнего бэкапа. */
  dataDir: path.resolve(str('DOCK_DATA_DIR', path.join(process.cwd(), 'data'))),

  docker: {
    socketPath: str('DOCK_DOCKER_SOCKET', '/var/run/docker.sock'),
    /**
     * Корень на хосте, куда ложатся тома сервисов. Внутри контейнера панели
     * этот путь может отличаться, поэтому bind монтируется по hostVolumeRoot,
     * а панель читает его содержимое по volumeRoot.
     */
    hostVolumeRoot: str('DOCK_HOST_VOLUME_ROOT', '/srv'),
    /** Docker-сеть, в которую подключаются созданные панелью контейнеры. */
    network: str('DOCK_NETWORK', 'dock'),
    /** Показывать ли контейнеры, созданные не через dock. */
    adoptForeign: bool('DOCK_ADOPT_FOREIGN', true),
  },

  /** Точка монтирования корня хоста — с неё считается свободное место. */
  hostRoot: str('DOCK_HOST_ROOT', '/'),

  /** Сколько строк журнала панель держит в памяти. */
  logBuffer: int('DOCK_LOG_BUFFER', 500),

  /** Как часто пересчитываются метрики хоста и сервисов, мс. */
  pollInterval: int('DOCK_POLL_INTERVAL', 4000),

  /**
   * Каталог со сборкой панели. Считается от расположения самого ядра
   * (apps/api/src в разработке, apps/api/dist в проде), поэтому не зависит
   * от того, из какой директории запустили процесс.
   */
  webDist: str('DOCK_WEB_DIST', path.resolve(__dirname, '../../web/dist')),

  logLevel: str('LOG_LEVEL', 'info'),
} as const;

export type Config = typeof config;
