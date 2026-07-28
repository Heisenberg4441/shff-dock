import type {
  ChangeEventHandler,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  /** Машинная ремарка под полем: '// caddy выпишет сертификат сам'. */
  hint?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
}

export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <label className="field">
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="req"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

type InputBase = InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>;

interface InputProps extends Omit<InputBase, 'size' | 'prefix'> {
  /** Символ промпта слева от поля: '$' или '~'. */
  prompt?: string;
  invalid?: boolean;
  size?: 'lg';
  multiline?: boolean;
}

export function Input({ prompt, invalid, size, multiline, className = '', ...rest }: InputProps) {
  const cls = ['input', size === 'lg' ? 'mono-lg' : '', invalid ? 'invalid' : '', className]
    .filter(Boolean)
    .join(' ');

  const control = multiline ? (
    <textarea className={cls} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
  ) : (
    <input className={cls} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
  );

  if (!prompt) return control;
  return (
    <span className="input-prompt">
      <span className="ps">{prompt}</span>
      {control}
    </span>
  );
}

export type SelectOption = string | { value: string; label: string };

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
}

export function Select({ options = [], className = '', ...rest }: SelectProps) {
  return (
    <span className="select-wrap">
      <select className={['select', className].filter(Boolean).join(' ')} {...rest}>
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </span>
  );
}

interface CheckboxProps {
  label?: ReactNode;
  sublabel?: ReactNode;
  radio?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  name?: string;
  value?: string;
}

export function Checkbox({
  label,
  sublabel,
  radio,
  checked,
  onChange,
  disabled,
  name,
  value,
}: CheckboxProps) {
  return (
    <label className="check">
      <input
        type={radio ? 'radio' : 'checkbox'}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        name={name}
        value={value}
      />
      <span className={'box' + (radio ? ' round' : '')}>{checked ? (radio ? '●' : '✓') : ''}</span>
      <span className="ctext">
        {label}
        {sublabel && <span className="sub">{sublabel}</span>}
      </span>
    </label>
  );
}

interface SwitchProps {
  label?: ReactNode;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  /** Подпись on/off рядом с тумблером. */
  showState?: boolean;
}

export function Switch({ label, checked, onChange, disabled, showState }: SwitchProps) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="track" />
      {showState && <span className="sw-state">{checked ? 'on' : 'off'}</span>}
      {label && <span>{label}</span>}
    </label>
  );
}
