import { Field, Input, Select, Switch } from '@dock/ui';
import type { StackInput, StackManifest, StackValues } from '@dock/shared';

interface StackFormProps {
  manifest: StackManifest;
  values: StackValues;
  /** Порты, занятые чем-то другим на хосте — поле подсветится как ошибочное. */
  busyPorts?: number[];
  /** Порты, которые занимает сам этот стек: конфликтом не считаются. */
  ownPorts?: number[];
  onChange(key: string, value: string | number | boolean): void;
}

/**
 * Форма по манифесту стека.
 *
 * Одна и та же и при установке, и при правке конфига: набор полей описан в
 * `inputs`, а не зашит в панель, поэтому новый стек в реестре получает свою
 * форму без единой строчки здесь.
 */
export function StackForm({ manifest, values, busyPorts = [], ownPorts = [], onChange }: StackFormProps) {
  const inputs = (manifest.inputs ?? []).filter((i) => !i.hidden);
  const switches = inputs.filter((i) => i.type === 'bool');
  const fields = inputs.filter((i) => i.type !== 'bool');

  const conflict = (input: StackInput): boolean => {
    if (input.type !== 'port' || !input.hostPort) return false;
    const port = Number(values[input.key]);
    return Number.isInteger(port) && busyPorts.includes(port) && !ownPorts.includes(port);
  };

  return (
    <>
      {fields.map((input) => {
        const value = values[input.key];
        const busy = conflict(input);
        const hint = busy ? undefined : input.hint;

        return (
          <div key={input.key} className={input.type === 'text' ? 'full' : undefined}>
            <Field
              label={input.label}
              required={input.required}
              hint={hint}
              error={busy ? '// порт уже занят на хосте' : undefined}
            >
              {input.type === 'enum' ? (
                <Select
                  options={input.options ?? []}
                  value={String(value ?? '')}
                  onChange={(e) => onChange(input.key, e.target.value)}
                />
              ) : input.type === 'text' ? (
                <Input
                  multiline
                  rows={4}
                  value={String(value ?? '')}
                  onChange={(e) => onChange(input.key, e.target.value)}
                />
              ) : (
                <Input
                  type={input.type === 'secret' ? 'password' : 'text'}
                  inputMode={input.type === 'port' || input.type === 'number' ? 'numeric' : undefined}
                  prompt={input.type === 'path' ? '~' : undefined}
                  invalid={busy}
                  value={String(value ?? '')}
                  onChange={(e) => onChange(input.key, e.target.value)}
                />
              )}
            </Field>
          </div>
        );
      })}

      {switches.length ? (
        <div className="switches">
          {switches.map((input) => (
            <div key={input.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Switch
                label={input.label}
                checked={values[input.key] === true || values[input.key] === 'true'}
                onChange={() =>
                  onChange(input.key, !(values[input.key] === true || values[input.key] === 'true'))
                }
                showState
              />
              {input.hint ? <span className="dock-note">{input.hint}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
