import { parse } from 'yaml';
import type { StackInput, StackManifest } from '@dock/shared';
import { STACK_API_VERSION } from '@dock/shared';
import { DriverError } from '../driver';

export class ManifestError extends DriverError {
  constructor(message: string) {
    super(`манифест стека: ${message}`, 422, 'bad_manifest');
    this.name = 'ManifestError';
  }
}

const INPUT_TYPES = ['string', 'text', 'port', 'number', 'bool', 'enum', 'secret', 'path'];
const GENERATORS = ['password', 'hex32', 'hex64', 'uuid', 'base64'];

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestError(`${where} должен быть объектом`);
  }
  return value as Record<string, unknown>;
}

function requireString(source: Record<string, unknown>, key: string, where: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ManifestError(`${where}: поле ${key} обязательно и должно быть строкой`);
  }
  return value.trim();
}

function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseInput(raw: unknown, index: number): StackInput {
  const source = asRecord(raw, `inputs[${index}]`);
  const key = requireString(source, 'key', `inputs[${index}]`);

  // ключ инпута — это имя переменной окружения, поэтому форма строгая
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new ManifestError(
      `inputs[${index}].key = ${key}: ключ должен выглядеть как имя переменной окружения (ADMIN_PASSWORD)`,
    );
  }

  const type = (optionalString(source, 'type') ?? 'string') as StackInput['type'];
  if (!INPUT_TYPES.includes(type)) {
    throw new ManifestError(`inputs[${key}].type = ${type}: допустимы ${INPUT_TYPES.join(', ')}`);
  }

  const options = Array.isArray(source.options) ? source.options.map(String) : undefined;
  if (type === 'enum' && (!options || !options.length)) {
    throw new ManifestError(`inputs[${key}]: у типа enum обязателен непустой options`);
  }

  const generate = optionalString(source, 'generate') as StackInput['generate'];
  if (generate && !GENERATORS.includes(generate)) {
    throw new ManifestError(`inputs[${key}].generate = ${generate}: допустимы ${GENERATORS.join(', ')}`);
  }

  const pattern = optionalString(source, 'pattern');
  if (pattern) {
    try {
      new RegExp(pattern);
    } catch {
      throw new ManifestError(`inputs[${key}].pattern не компилируется как регулярное выражение`);
    }
  }

  const input: StackInput = {
    key,
    label: optionalString(source, 'label') ?? key,
    type,
  };
  const hint = optionalString(source, 'hint');
  if (hint) input.hint = hint;
  if (source.default !== undefined) input.default = source.default as string | number | boolean;
  if (options) input.options = options;
  if (source.required === true) input.required = true;
  if (pattern) input.pattern = pattern;
  if (typeof source.min === 'number') input.min = source.min;
  if (typeof source.max === 'number') input.max = source.max;
  if (generate) input.generate = generate;
  if (source.hostPort === true) input.hostPort = true;
  if (source.hidden === true) input.hidden = true;
  return input;
}

/**
 * Разбор и проверка `stack.yaml`. Манифест может приехать из чужого
 * репозитория, поэтому проверяется он строго и ругается по-человечески:
 * автор стека должен понять, что именно поправить, не читая исходники панели.
 */
export function parseManifest(source: string): StackManifest {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (err) {
    throw new ManifestError(`не разбирается как yaml: ${(err as Error).message}`);
  }

  const doc = asRecord(raw, 'stack.yaml');

  const apiVersion = requireString(doc, 'apiVersion', 'stack.yaml');
  if (apiVersion !== STACK_API_VERSION) {
    throw new ManifestError(`apiVersion = ${apiVersion}, панель понимает ${STACK_API_VERSION}`);
  }
  if (doc.kind !== 'Stack') {
    throw new ManifestError(`kind = ${String(doc.kind)}, ожидается Stack`);
  }

  const id = requireString(doc, 'id', 'stack.yaml');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
    throw new ManifestError(`id = ${id}: допустимы строчные буквы, цифры, дефис и подчёркивание`);
  }

  const compose = doc.compose;
  if (typeof compose !== 'string' && (!compose || typeof compose !== 'object')) {
    throw new ManifestError('compose: нужен либо путь к файлу, либо compose-документ прямо здесь');
  }

  const inputs = Array.isArray(doc.inputs) ? doc.inputs.map(parseInput) : [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.key)) throw new ManifestError(`inputs: ключ ${input.key} повторяется`);
    seen.add(input.key);
  }

  const files = Array.isArray(doc.files)
    ? doc.files.map((file, i) => {
        const entry = asRecord(file, `files[${i}]`);
        const filePath = requireString(entry, 'path', `files[${i}]`);
        const template = optionalString(entry, 'template');
        const content = typeof entry.content === 'string' ? entry.content : undefined;
        if (!template && content === undefined) {
          throw new ManifestError(`files[${filePath}]: нужен template или content`);
        }
        return {
          path: filePath,
          ...(template ? { template } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(optionalString(entry, 'when') ? { when: optionalString(entry, 'when') as string } : {}),
          ...(optionalString(entry, 'whenNot')
            ? { whenNot: optionalString(entry, 'whenNot') as string }
            : {}),
          ...(optionalString(entry, 'mode') ? { mode: optionalString(entry, 'mode') as string } : {}),
        };
      })
    : [];

  const volumes = Array.isArray(doc.volumes)
    ? doc.volumes.map((vol, i) => {
        const entry = asRecord(vol, `volumes[${i}]`);
        const volPath = requireString(entry, 'path', `volumes[${i}]`);
        const owner = optionalString(entry, 'owner');
        if (owner && !/^\d+:\d+$/.test(owner)) {
          throw new ManifestError(`volumes[${volPath}].owner = ${owner}: ожидается uid:gid`);
        }
        return {
          path: volPath,
          ...(owner ? { owner } : {}),
          ...(optionalString(entry, 'mode') ? { mode: optionalString(entry, 'mode') as string } : {}),
        };
      })
    : [];

  const profiles = Array.isArray(doc.profiles)
    ? doc.profiles.map((profile, i) => {
        const entry = asRecord(profile, `profiles[${i}]`);
        const name = requireString(entry, 'name', `profiles[${i}]`);
        const when = requireString(entry, 'when', `profiles[${name}]`);
        if (!seen.has(when)) {
          throw new ManifestError(`profiles[${name}].when = ${when}: такого инпута нет`);
        }
        return { name, when };
      })
    : [];

  for (const file of files) {
    for (const key of [file.when, file.whenNot]) {
      if (key && !seen.has(key)) {
        throw new ManifestError(`files[${file.path}]: условие ссылается на несуществующий инпут ${key}`);
      }
    }
  }

  const manifest: StackManifest = {
    apiVersion,
    kind: 'Stack',
    id,
    name: optionalString(doc, 'name') ?? id,
    version: optionalString(doc, 'version') ?? '0.0.0',
    category: optionalString(doc, 'category') ?? 'разное',
    summary: optionalString(doc, 'summary') ?? '',
    compose: compose as StackManifest['compose'],
  };

  const description = optionalString(doc, 'description');
  if (description) manifest.description = description;
  const homepage = optionalString(doc, 'homepage');
  if (homepage) manifest.homepage = homepage;
  const maintainer = optionalString(doc, 'maintainer');
  if (maintainer) manifest.maintainer = maintainer;
  const meta = optionalString(doc, 'meta');
  if (meta) manifest.meta = meta;
  const primary = optionalString(doc, 'primary');
  if (primary) manifest.primary = primary;
  if (doc.requires) manifest.requires = doc.requires as StackManifest['requires'];
  if (doc.post) manifest.post = doc.post as StackManifest['post'];
  if (inputs.length) manifest.inputs = inputs;
  if (files.length) manifest.files = files;
  if (volumes.length) manifest.volumes = volumes;
  if (profiles.length) manifest.profiles = profiles;

  return manifest;
}
