import { Scalar, stringify } from 'yaml';
import type { CatalogItem, RestartPolicy } from '@dock/shared';
import { parseEnv } from './format';

/**
 * Каталог проверенных образов. Тексты и метаданные — из прототипа,
 * теги образов и внутренние порты подставлены настоящие, чтобы
 * DockerodeDriver мог поднять сервис без правок.
 */
export const CATALOG: CatalogItem[] = [
  {
    id: 'gitea',
    name: 'gitea',
    cat: 'код',
    desc: 'Лёгкий git-хостинг: репозитории, issues, actions. Живёт в одном контейнере с sqlite.',
    meta: '// 180 MB · 1 контейнер',
    port: '3000',
    containerPort: '3000',
    vol: 'dock/gitea',
    image: 'gitea/gitea:1.22',
    mount: '/data',
    env: { USER_UID: '1000', USER_GID: '1000' },
  },
  {
    id: 'nextcloud',
    name: 'nextcloud',
    cat: 'данные',
    desc: 'Файлы, календарь и контакты. Заменяет облачный диск целиком.',
    meta: '// 1.1 GB · 3 контейнера',
    port: '8080',
    containerPort: '80',
    vol: 'dock/nextcloud',
    image: 'nextcloud:29-apache',
    mount: '/var/www/html',
    env: {},
  },
  {
    id: 'immich',
    name: 'immich',
    cat: 'медиа',
    desc: 'Фотоархив с поиском по лицам. Забирает бэкап с телефона автоматически.',
    meta: '// 2.4 GB · 4 контейнера',
    port: '2283',
    containerPort: '2283',
    vol: 'dock/immich',
    image: 'ghcr.io/immich-app/immich-server:release',
    mount: '/usr/src/app/upload',
    env: {},
  },
  {
    id: 'adguard',
    name: 'adguard-home',
    cat: 'сеть',
    desc: 'DNS-фильтр на весь дом. Режет рекламу и трекеры до того, как они загрузятся.',
    meta: '// 90 MB · 1 контейнер',
    port: '3080',
    containerPort: '3000',
    vol: 'dock/adguard',
    image: 'adguard/adguardhome:latest',
    mount: '/opt/adguardhome/work',
    env: {},
  },
  {
    id: 'uptime-kuma',
    name: 'uptime-kuma',
    cat: 'сеть',
    desc: 'Мониторинг своих же сервисов. Пишет в телеграм, когда что-то упало.',
    meta: '// 320 MB · 1 контейнер',
    port: '3001',
    containerPort: '3001',
    vol: 'dock/kuma',
    image: 'louislam/uptime-kuma:1',
    mount: '/app/data',
    env: {},
  },
  {
    id: 'paperless',
    name: 'paperless-ngx',
    cat: 'данные',
    desc: 'Архив бумажных документов с OCR и поиском по тексту.',
    meta: '// 900 MB · 3 контейнера',
    port: '8010',
    containerPort: '8000',
    vol: 'dock/paperless',
    image: 'ghcr.io/paperless-ngx/paperless-ngx:latest',
    mount: '/usr/src/paperless/data',
    env: { PAPERLESS_TIME_ZONE: 'Europe/Belgrade' },
  },
  {
    id: 'navidrome',
    name: 'navidrome',
    cat: 'медиа',
    desc: 'Стриминг своей музыкальной коллекции. Совместим с subsonic-клиентами.',
    meta: '// 60 MB · 1 контейнер',
    port: '4533',
    containerPort: '4533',
    vol: 'dock/navidrome',
    image: 'deluan/navidrome:latest',
    mount: '/data',
    env: { ND_LOGLEVEL: 'info' },
  },
  {
    id: 'wg-easy',
    name: 'wg-easy',
    cat: 'сеть',
    desc: 'WireGuard с веб-панелью: домашняя сеть в кармане за пару минут.',
    meta: '// 40 MB · 1 контейнер',
    port: '51821',
    containerPort: '51821',
    vol: 'dock/wg',
    image: 'ghcr.io/wg-easy/wg-easy:14',
    mount: '/etc/wireguard',
    env: {},
  },
  {
    id: 'vaultwarden',
    name: 'vaultwarden',
    cat: 'данные',
    desc: 'Менеджер паролей, совместимый с клиентами bitwarden.',
    meta: '// 120 MB · 1 контейнер',
    port: '8222',
    containerPort: '80',
    vol: 'dock/vault',
    image: 'vaultwarden/server:1.32',
    mount: '/data',
    env: { SIGNUPS_ALLOWED: 'false' },
  },
];

export const CATEGORIES = ['all', 'медиа', 'данные', 'сеть', 'код'];

export function findCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

export interface ComposeSpec {
  id: string;
  image: string;
  /** '8096' либо пустая строка, если наружу ничего не пробрасывается. */
  hostPort: string;
  containerPort: string;
  /** Путь тома на хосте. */
  volume: string;
  mount: string;
  restart: RestartPolicy;
  /** Текст 'KEY=value' построчно. */
  env: string;
  network?: string;
}

function quoted(value: string): Scalar {
  const scalar = new Scalar(value);
  scalar.type = Scalar.QUOTE_DOUBLE;
  return scalar;
}

/** Генерирует compose.yml — и для показа в диалоге, и для записи рядом с сервисом. */
export function composeYaml(spec: ComposeSpec): string {
  const service: Record<string, unknown> = {
    image: spec.image,
    container_name: spec.id,
    restart: spec.restart,
  };
  // проброс порта обязан быть строкой: без кавычек yaml прочитает 8:80 как время
  if (spec.hostPort) service.ports = [quoted(`${spec.hostPort}:${spec.containerPort}`)];
  if (spec.volume) service.volumes = [`${spec.volume}:${spec.mount}`];
  const env = parseEnv(spec.env);
  if (Object.keys(env).length) service.environment = env;
  if (spec.network) service.networks = [spec.network];

  const doc: Record<string, unknown> = { services: { [spec.id]: service } };
  if (spec.network) doc.networks = { [spec.network]: { external: true } };

  return stringify(doc, { lineWidth: 0 }).trimEnd();
}

/** compose.yml для карточки каталога — то, что показывает диалог «compose». */
export function catalogCompose(item: CatalogItem, tz: string, volumeRoot: string): string {
  const env = Object.entries({ ...item.env, TZ: tz })
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  return composeYaml({
    id: item.id,
    image: item.image,
    hostPort: item.port,
    containerPort: item.containerPort,
    volume: `${volumeRoot.replace(/\/+$/, '')}/${item.vol}`,
    mount: item.mount,
    restart: 'unless-stopped',
    env,
  });
}
