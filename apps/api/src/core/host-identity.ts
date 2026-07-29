import fs from 'node:fs/promises';
import path from 'node:path';

export interface HostIdentity {
  hostname: string;
  tz: string;
  operator: string;
}

/**
 * Кто и где мы на самом деле.
 *
 * Изнутри контейнера ответы на эти вопросы неверны: `os.hostname()` вернёт
 * идентификатор контейнера, а часовой пояс будет UTC, потому что своего у
 * образа нет. Поэтому читается примонтированный корень хоста — тот же
 * `/host/rootfs`, по которому считаются метрики.
 *
 * Всё, что не прочиталось, остаётся прежним: пустое имя хоста хуже, чем
 * значение по умолчанию.
 */
export async function detectHostIdentity(
  rootfs: string,
  puid: number,
  fallback: HostIdentity,
): Promise<HostIdentity> {
  const [hostname, tz, operator] = await Promise.all([
    readHostname(rootfs),
    readTimezone(rootfs),
    readOperator(rootfs, puid),
  ]);

  return {
    hostname: hostname ?? fallback.hostname,
    tz: tz ?? fallback.tz,
    operator: operator ?? fallback.operator,
  };
}

async function readHostname(rootfs: string): Promise<string | null> {
  const raw = await read(path.join(rootfs, 'etc/hostname'));
  const value = raw?.split('\n')[0]?.trim();
  // localhost — это не имя машины, а признак того, что его не задавали
  if (!value || value === 'localhost') return null;
  return value;
}

/**
 * Часовой пояс лежит в двух местах и не всегда в обоих: `/etc/timezone` есть
 * в debian и ubuntu, а `/etc/localtime` — симлинк в zoneinfo — есть почти
 * везде. Читаются оба, побеждает первый сработавший.
 */
async function readTimezone(rootfs: string): Promise<string | null> {
  const direct = (await read(path.join(rootfs, 'etc/timezone')))?.trim();
  if (isZone(direct)) return direct as string;

  try {
    const link = await fs.readlink(path.join(rootfs, 'etc/localtime'));
    const marker = link.indexOf('zoneinfo/');
    if (marker >= 0) {
      const zone = link.slice(marker + 'zoneinfo/'.length).trim();
      if (isZone(zone)) return zone;
    }
  } catch {
    /* не симлинк или нет доступа */
  }

  return null;
}

function isZone(value: string | undefined): boolean {
  // Europe/Belgrade, UTC, America/Argentina/Salta — но не мусор и не пустое
  return !!value && /^[A-Za-z][A-Za-z0-9+_-]*(\/[A-Za-z0-9+_-]+){0,2}$/.test(value);
}

/**
 * Оператор — это владелец каталогов с данными стеков, то есть пользователь с
 * тем же uid, под которым панель их создаёт. Ищется он в хостовом
 * `/etc/passwd`: своего пользователя с этим uid у образа панели нет.
 */
async function readOperator(rootfs: string, puid: number): Promise<string | null> {
  const raw = await read(path.join(rootfs, 'etc/passwd'));
  if (!raw) return null;

  for (const line of raw.split('\n')) {
    const [name, , uid] = line.split(':');
    if (name && uid && Number(uid) === puid) return name;
  }
  return null;
}

async function read(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}
