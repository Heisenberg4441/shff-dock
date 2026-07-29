import fs from 'node:fs';
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

/**
 * Первый существующий путь из списка. Нужен для /host/proc и rootfs: если хост
 * примонтирован — читаем его, если нет — молча живём с тем, что видно изнутри.
 */
function firstExisting(candidates: string[], fallback: string): string {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* нет доступа — пробуем следующий */
    }
  }
  return fallback;
}

const socketPath = str('DOCK_DOCKER_SOCKET', '/var/run/docker.sock');
const driverEnv = str('DOCK_DRIVER', 'auto').toLowerCase();

/**
 * Драйвер по умолчанию выбирается по факту: есть сокет — работаем с докером,
 * нет — с выдуманным хостом.
 *
 * Раньше умолчанием был mock, и это оказалось ловушкой: панель в контейнере,
 * до которой переменная почему-либо не доехала, молча рисовала правдоподобные
 * 64 ГБ и 4 ТБ, и отличить её от настоящей можно было только по логам.
 * Явные `mock` и `docker` по-прежнему считаются приказом.
 */
function pickDriver(): 'mock' | 'docker' {
  if (driverEnv === 'docker') return 'docker';
  if (driverEnv === 'mock') return 'mock';
  try {
    return fs.existsSync(socketPath) ? 'docker' : 'mock';
  } catch {
    return 'mock';
  }
}

/**
 * Корень раскладки. Всё, что панель создаёт на хосте, лежит здесь и нигде
 * больше: стеки, кэш реестра, конфиг панели, бэкапы. Путь одинаков внутри
 * контейнера панели и снаружи — только поэтому bind-монтирования, которые
 * ядро пишет в compose-файлы, разрешаются на хосте в те же каталоги.
 */
const dockRoot = path.posix.normalize(str('DOCK_ROOT', '/home/dock'));

const procRoot = firstExisting([str('DOCK_PROC_ROOT', '/host/proc'), '/proc'], '/proc');
const sysRoot = firstExisting([str('DOCK_SYS_ROOT', '/host/sys'), '/sys'], '/sys');
const rootfs = firstExisting([str('DOCK_ROOTFS', '/host/rootfs'), '/'], '/');

export const config = {
  port: int('PORT', 7788),
  host: str('HOST', '0.0.0.0'),

  /** mock — синтетический хост, docker — настоящий демон на сокете. */
  driver: pickDriver(),

  paths: {
    root: dockRoot,
    /** /home/dock/stacks/<id> — по каталогу на стек. */
    stacks: path.posix.join(dockRoot, 'stacks'),
    /** Кэш скачанных манифестов реестра. */
    registry: path.posix.join(dockRoot, 'registry'),
    backups: path.posix.join(dockRoot, 'backups'),
    /** dock.yml и state.json лежат прямо в корне — их видно сразу. */
    config: dockRoot,
  },

  /**
   * Репозиторий с готовыми стеками. В образе их нет: каталог обновляется
   * коммитом в этот репозиторий, а не пересборкой и переустановкой панели.
   * Формат: https://raw.githubusercontent.com/<owner>/<repo>/<ref>
   */
  registryUrl: str(
    'DOCK_REGISTRY_URL',
    'https://raw.githubusercontent.com/Heisenberg4441/shff-registry/master',
  ),

  /**
   * Как часто перечитывается индекс реестра, минуты. Ноль и меньше — только
   * при старте и по кнопке в каталоге.
   */
  registryTtlMinutes: int('DOCK_REGISTRY_TTL', 60),

  /**
   * Реестр на диске. Пусто — панель живёт на удалённом реестре и его кэше;
   * путь имеет смысл задавать при разработке стеков и тем, кто держит свой
   * реестр локально. Такие стеки идут в основу, удалённые накладываются сверху.
   */
  bundledRegistry: str('DOCK_BUNDLED_REGISTRY', ''),

  docker: {
    socketPath,
    /** Docker-сеть, в которую подключаются стеки. */
    network: str('DOCK_NETWORK', 'dock'),
    /** Показывать ли контейнеры, созданные не через dock. */
    adoptForeign: bool('DOCK_ADOPT_FOREIGN', true),
    /** Под каким uid:gid создавать каталоги данных стеков. */
    puid: int('DOCK_PUID', 1000),
    pgid: int('DOCK_PGID', 1000),
    composeTimeoutMs: int('DOCK_COMPOSE_TIMEOUT', 15 * 60 * 1000),
  },

  /**
   * Откуда снимаются метрики. Внутри контейнера /proc и / показывают то, что
   * выделено докеру, поэтому compose монтирует хостовые в /host/*. Если их нет,
   * ядро честно пометит метрики как неполные, а не соврёт цифрами.
   */
  metrics: {
    procRoot,
    sysRoot,
    rootfs,
    hostMounted: procRoot !== '/proc' || rootfs !== '/',
    /** Место считаем по разделу, где лежат стеки, — он и кончается первым. */
    diskPath: dockRoot,
  },

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
