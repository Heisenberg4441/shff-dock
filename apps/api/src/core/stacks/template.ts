import type { StackValues } from '@dock/shared';

/**
 * Подстановка `${VAR}` — весь шаблонизатор целиком.
 *
 * Условий, циклов и выражений здесь нет намеренно. Файл стека должен читаться
 * как файл, а не как программа: если конфиг зависит от переключателя, в реестр
 * кладутся два файла с `when`/`whenNot`, а не один с ветвлением внутри.
 *
 * Синтаксис нарочно тот же, что у docker compose, — включая экранирование:
 * `$$` даёт литеральный `$`. Это нужно тем конфигам, где `${1}` значит своё,
 * например prometheus relabel: пишем `$${1}`, получаем `${1}`.
 */
export function renderTemplate(source: string, values: StackValues): string {
  const missing = new Set<string>();

  const rendered = source.replace(/\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key?: string) => {
    if (match === '$$') return '$';
    const name = key as string;
    const value = values[name];
    if (value === undefined) {
      missing.add(name);
      return match;
    }
    return String(value);
  });

  if (missing.size) {
    throw new Error(`в шаблоне нет значений для: ${[...missing].join(', ')}`);
  }
  return rendered;
}

/**
 * Значение для строки .env. Docker compose интерполирует `$` и внутри значений,
 * поэтому доллар удваивается, а всё, что можно спутать с синтаксисом, берётся
 * в двойные кавычки.
 */
export function envLine(key: string, raw: string | number | boolean): string {
  const value = String(raw).replace(/\$/g, '$$$$');
  const needsQuotes = /[\s#'"=]|^$/.test(value);
  if (!needsQuotes) return `${key}=${value}`;
  return `${key}="${value.replace(/(["\\])/g, '\\$1')}"`;
}

/** Файл .env целиком — его читает и docker compose, и панель при правке конфига. */
export function renderEnvFile(values: StackValues, header: string): string {
  const lines = [header, ''];
  for (const [key, value] of Object.entries(values)) {
    lines.push(envLine(key, value));
  }
  return lines.join('\n') + '\n';
}

/** Обратный разбор .env — им панель восстанавливает форму конфига стека. */
export function parseEnvFile(source: string): StackValues {
  const values: StackValues = {};
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
    }
    values[key] = value.replace(/\$\$/g, '$');
  }
  return values;
}
