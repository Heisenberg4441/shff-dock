/** Форматирование значений в том виде, в каком их ждёт панель. */

/** Русский выбор формы: 1 день / 2 дня / 5 дней. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function humanBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const digits = value >= 10 || i === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

/** '12 дней', '6 часов', '0 минут' — как в прототипе. */
export function humanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days} ${plural(days, 'день', 'дня', 'дней')}`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} ${plural(minutes, 'минута', 'минуты', 'минут')}`;
}

/** HH:MM:SS локального времени хоста — метка строки журнала. */
export function clock(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Подпись «18% / 1.4 GB» под карточкой сервиса. */
export function usageLabel(cpuPct: number, memBytes: number): string {
  if (cpuPct <= 0 && memBytes <= 0) return '— / —';
  return `${Math.round(cpuPct)}% / ${humanBytes(memBytes)}`;
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 'KEY=value' построчно → объект. Пустые строки и комментарии игнорируются. */
export function parseEnv(env: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of env.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Обратное преобразование: докеровский ['K=v'] → текст для textarea. */
export function stringifyEnv(pairs: string[] | null | undefined): string {
  if (!pairs || !pairs.length) return '';
  return pairs.join('\n');
}

/** Слаг для id сервиса и имени контейнера. */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
