/**
 * Формат описания готового стека — `stack.yaml`, apiVersion `dock/v1`.
 *
 * Замысел: сервис приезжает уже настроенным. Не «вот образ grafana, дальше сам»,
 * а «grafana, которая при первом запуске уже видит prometheus и loki, потому что
 * datasource'ы и scrape-конфиг сгенерированы вместе с ней».
 *
 * Три решения, на которых стоит формат:
 *
 * 1. **Compose не переизобретается.** Значения инпутов ядро кладёт в `.env`
 *    рядом с compose-файлом, а подстановку `${PORT}` делает сам docker compose.
 *    Свой шаблонизатор нужен только для конфигов сервисов (prometheus.yml и
 *    подобных) — и он умеет ровно одно: `${VAR}`. Условий, циклов и выражений
 *    в шаблонах нет намеренно: файл стека должен читаться как файл, а не как
 *    программа. Необязательные части включаются через `when` у файла и через
 *    родные compose-профили у сервисов.
 *
 * 2. **Каталог стека — это и есть состояние.** `/home/dock/stacks/<id>/`
 *    содержит `stack.yaml`, `compose.yaml`, `.env`, отрендеренные конфиги и
 *    `data/`. Скопировал каталог — перенёс сервис; удалил — удалил. Панель
 *    хранит копию манифеста рядом, поэтому форму «конфиг» можно отрисовать
 *    заново даже если реестр недоступен.
 *
 * 3. **Ключи инпутов — это имена переменных окружения.** `ADMIN_PASSWORD`
 *    попадает и в `.env`, и в шаблоны, и в compose под одним именем. Никакого
 *    отдельного пространства имён и маппинга.
 */

export const STACK_API_VERSION = 'dock/v1';

export type StackInputType = 'string' | 'text' | 'port' | 'number' | 'bool' | 'enum' | 'secret' | 'path';

/** Чем заполнить секрет, если пользователь оставил поле пустым. */
export type StackGenerator = 'password' | 'hex32' | 'hex64' | 'uuid' | 'base64';

export interface StackInput {
  /** Имя переменной: [A-Z][A-Z0-9_]*. Оно же ключ в .env и в шаблонах. */
  key: string;
  label: string;
  type: StackInputType;
  /** Машинная ремарка под полем — попадает в hint дизайн-системы. */
  hint?: string;
  default?: string | number | boolean;
  /** Варианты для type: enum. */
  options?: string[];
  required?: boolean;
  /** Регулярное выражение для проверки строки целиком. */
  pattern?: string;
  min?: number;
  max?: number;
  /** Для secret: чем заполнить пустое поле. */
  generate?: StackGenerator;
  /** Порт занимает место на хосте — ядро проверит, что он свободен. */
  hostPort?: boolean;
  /** Не показывать поле в форме: значение берётся из default или generate. */
  hidden?: boolean;
}

export interface StackFile {
  /** Куда положить, относительно каталога стека: 'prometheus/prometheus.yml'. */
  path: string;
  /** Путь к шаблону внутри стека в реестре. */
  template?: string;
  /** Содержимое прямо в манифесте — для коротких конфигов. */
  content?: string;
  /** Ставить файл только если этот bool-инпут включён. */
  when?: string;
  /** Ставить файл только если этот bool-инпут выключен. */
  whenNot?: string;
  /** Права в восьмеричном виде: '0600' для файлов с секретами. */
  mode?: string;
}

export interface StackVolume {
  /** Каталог относительно каталога стека: 'data/grafana'. */
  path: string;
  /**
   * Каталог общий: путь считается от /home/dock, а не от каталога стека, и
   * вместе со стеком он не удаляется. Так живёт media/films — библиотека
   * переживает и качалку, которая её наполняла, и плеер, который её читал.
   */
  shared?: boolean;
  /**
   * Владелец в виде 'uid:gid'. Без этого докер создаст каталог от root,
   * и образы, работающие не от root (grafana, prometheus), не запишут туда
   * ни байта — самая частая причина «поставилось, но не стартует».
   */
  owner?: string;
  mode?: string;
}

export interface StackProfile {
  /** Имя compose-профиля. */
  name: string;
  /** Ключ bool-инпута, который его включает. */
  when: string;
}

export interface StackRequires {
  /** Минимальная версия dock. */
  dock?: string;
  /** Поддерживаемые архитектуры: ['amd64', 'arm64']. */
  arch?: string[];
  /** Сколько памяти стеку нужно как минимум, МиБ. */
  memoryMiB?: number;
  /** Порты, которые стек займёт помимо описанных инпутами. */
  ports?: number[];
}


export interface StackPost {
  /** Куда идти после установки; поддерживает ${VAR}. */
  url?: string;
  /** Что показать в панели после установки; поддерживает ${VAR}. */
  notes?: string;
  health?: {
    /** Имя сервиса в compose, по которому проверять готовность. */
    service: string;
    /** HTTP-путь; если не задан — достаточно статуса контейнера. */
    path?: string;
    port?: number;
    timeoutSeconds?: number;
  };
}

/**
 * Реквизиты установленного стека: тот же `post`, но с подставленными
 * значениями. Секреты здесь настоящие — в этом весь смысл, сгенерированный
 * пароль человек больше нигде не увидит.
 */
export interface StackPostInfo {
  url?: string;
  notes?: string;
}

/** Compose можно вписать в манифест целиком либо вынести в отдельный файл. */
export type StackCompose = string | Record<string, unknown>;

export interface StackManifest {
  apiVersion: string;
  kind: 'Stack';
  id: string;
  name: string;
  version: string;
  category: string;
  summary: string;
  description?: string;
  homepage?: string;
  maintainer?: string;
  /** Подпись для карточки каталога: '// 420 MB · 3 контейнера'. */
  meta?: string;
  requires?: StackRequires;
  inputs?: StackInput[];
  files?: StackFile[];
  volumes?: StackVolume[];
  profiles?: StackProfile[];
  /**
   * Сервис compose, который представляет стек: его порт показывается на
   * карточке, его журнал открывается по умолчанию.
   */
  primary?: string;
  compose: StackCompose;
  post?: StackPost;
}

/** Строка индекса реестра — то, что панель показывает в каталоге до установки. */
export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  category: string;
  summary: string;
  meta?: string;
  /** Путь к каталогу стека относительно корня реестра. */
  path: string;
}

export interface RegistryIndex {
  apiVersion: string;
  kind: 'Registry';
  name: string;
  updated?: string;
  stacks: RegistryEntry[];
}

export interface RegistrySource {
  /** 'bundled' — реестр, вшитый в образ; 'remote' — репозиторий на github. */
  kind: 'bundled' | 'remote';
  url: string;
  fetchedAt: string | null;
  error?: string;
}

/** Значения инпутов, как их вводит пользователь. */
export type StackValues = Record<string, string | number | boolean>;

export interface StackInstallRequest {
  stackId: string;
  values: StackValues;
}

/** Установленный стек: манифест плюс то, что ядро о нём знает. */
export interface InstalledStack {
  id: string;
  name: string;
  version: string;
  /** Каталог на хосте: /home/dock/stacks/<id>. */
  dir: string;
  /** Значения инпутов без секретов — секреты отдаются маскированными. */
  values: StackValues;
  /** Ключи, значения которых скрыты. */
  secrets: string[];
  manifest: StackManifest;
  installedAt: string;
}
