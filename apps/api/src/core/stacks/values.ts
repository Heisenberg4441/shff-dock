import { randomBytes, randomUUID } from 'node:crypto';
import type { StackInput, StackManifest, StackValues } from '@dock/shared';
import { DriverError } from '../driver';

/** Переменные, которые ядро подставляет само — их нельзя объявить инпутом. */
export interface StackContext {
  DOCK_STACK_ID: string;
  /** /home/dock/stacks/<id> — им compose собирает пути bind-монтирований. */
  DOCK_STACK_DIR: string;
  /** /home/dock/stacks/<id>/data */
  DOCK_DATA_DIR: string;
  DOCK_NETWORK: string;
  DOCK_TZ: string;
  /** Базовый домен из настроек панели: home.lan. */
  DOCK_DOMAIN: string;
  DOCK_HOSTNAME: string;
  DOCK_PUID: string;
  DOCK_PGID: string;
}

export function contextKeys(): string[] {
  return [
    'DOCK_STACK_ID',
    'DOCK_STACK_DIR',
    'DOCK_DATA_DIR',
    'DOCK_NETWORK',
    'DOCK_TZ',
    'DOCK_DOMAIN',
    'DOCK_HOSTNAME',
    'DOCK_PUID',
    'DOCK_PGID',
  ];
}

/**
 * Символы без тех, что легко спутать глазом (0/O, 1/l/I), и без всего, что
 * что-нибудь значит в .env, yaml или шелле. Пароль всё равно копируют руками.
 */
const PASSWORD_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generate(kind: NonNullable<StackInput['generate']>): string {
  switch (kind) {
    case 'uuid':
      return randomUUID();
    case 'hex32':
      return randomBytes(16).toString('hex');
    case 'hex64':
      return randomBytes(32).toString('hex');
    case 'base64':
      return randomBytes(24).toString('base64url');
    case 'password':
    default: {
      const bytes = randomBytes(24);
      let out = '';
      for (const byte of bytes) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      return out;
    }
  }
}

function fail(message: string): never {
  throw new DriverError(message, 400, 'bad_values');
}

function coerce(input: StackInput, raw: unknown): string | number | boolean {
  switch (input.type) {
    case 'bool': {
      if (typeof raw === 'boolean') return raw;
      const text = String(raw).toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(text)) return true;
      if (['false', '0', 'no', 'off', ''].includes(text)) return false;
      return fail(`${input.label}: ожидается да или нет`);
    }
    case 'port': {
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return fail(`${input.label}: порт должен быть числом от 1 до 65535`);
      }
      return port;
    }
    case 'number': {
      const num = Number(raw);
      if (!Number.isFinite(num)) return fail(`${input.label}: ожидается число`);
      if (input.min !== undefined && num < input.min) {
        return fail(`${input.label}: не меньше ${input.min}`);
      }
      if (input.max !== undefined && num > input.max) {
        return fail(`${input.label}: не больше ${input.max}`);
      }
      return num;
    }
    case 'enum': {
      const text = String(raw);
      if (!input.options?.includes(text)) {
        return fail(`${input.label}: допустимо ${input.options?.join(', ')}`);
      }
      return text;
    }
    default: {
      const text = String(raw);
      if (input.pattern && !new RegExp(`^(?:${input.pattern})$`).test(text)) {
        return fail(`${input.label}: значение не подходит под ${input.pattern}`);
      }
      return text;
    }
  }
}

/** Значения по умолчанию — то, что панель показывает в форме установки. */
export function defaultValues(manifest: StackManifest, ctx: StackContext): StackValues {
  const values: StackValues = { ...(ctx as unknown as StackValues) };
  for (const input of manifest.inputs ?? []) {
    if (input.default !== undefined) {
      values[input.key] = input.default;
    } else if (input.type === 'bool') {
      values[input.key] = false;
    } else if (input.generate) {
      // в форме секрет показывать нечем: он родится при установке
      values[input.key] = '';
    } else {
      values[input.key] = '';
    }
  }
  return values;
}

/**
 * Приводит введённое к типам манифеста, дозаполняет пустые секреты и
 * подмешивает контекст ядра. Всё, что вернулось, уедет в `.env` как есть.
 */
export function resolveValues(
  manifest: StackManifest,
  provided: StackValues,
  ctx: StackContext,
): StackValues {
  const values: StackValues = {};

  for (const input of manifest.inputs ?? []) {
    const raw = provided[input.key];
    const empty = raw === undefined || raw === '';

    if (empty && input.generate) {
      values[input.key] = generate(input.generate);
      continue;
    }
    if (empty && input.default !== undefined) {
      values[input.key] = coerce(input, input.default);
      continue;
    }
    if (empty) {
      if (input.required) fail(`${input.label}: обязательное поле`);
      values[input.key] = input.type === 'bool' ? false : '';
      continue;
    }
    values[input.key] = coerce(input, raw);
  }

  // контекст добавляется последним: перекрыть его инпутом нельзя
  return { ...values, ...(ctx as unknown as StackValues) };
}

export function secretKeys(manifest: StackManifest): string[] {
  return (manifest.inputs ?? []).filter((i) => i.type === 'secret').map((i) => i.key);
}

/** Секреты наружу не отдаются: в форму конфига приезжает заглушка. */
export function maskSecrets(values: StackValues, secrets: string[]): StackValues {
  const masked: StackValues = { ...values };
  for (const key of secrets) {
    if (masked[key] !== undefined && masked[key] !== '') masked[key] = '••••••••';
  }
  return masked;
}

/** Значение-заглушка означает «оставить как было». */
export function isMasked(value: unknown): boolean {
  return typeof value === 'string' && /^•+$/.test(value);
}

/** Профили compose, включённые булевыми инпутами. */
export function activeProfiles(manifest: StackManifest, values: StackValues): string[] {
  return (manifest.profiles ?? []).filter((p) => values[p.when] === true).map((p) => p.name);
}
