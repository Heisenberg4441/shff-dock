import { useEffect, useRef, useState } from 'react';
import type { FormEvent, HTMLAttributes, MouseEventHandler, ReactNode } from 'react';

/** Мигающий курсор терминала. */
export function Caret({ className = '', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={['cursor', className].filter(Boolean).join(' ')} {...rest} />;
}

// title рисуется в шапке окна, поэтому html-атрибут перекрывается
interface TerminalWindowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  children?: ReactNode;
  minHeight?: number;
}

export function TerminalWindow({
  title = 'mikhail@homelab: ~',
  children,
  minHeight,
  className = '',
  ...rest
}: TerminalWindowProps) {
  return (
    <div className={['term', className].filter(Boolean).join(' ')} {...rest}>
      <div className="term-bar">
        <span className="dot r" />
        <span className="dot y" />
        <span className="dot g" />
        <span className="term-title">{title}</span>
      </div>
      <div className="term-body" style={minHeight ? { minHeight } : undefined}>
        {children}
      </div>
    </div>
  );
}

export interface PtyLine {
  text: string;
  /** Эхо введённой команды рисуется ярче вывода. */
  echo?: boolean;
}

interface PtyConsoleProps {
  open?: boolean;
  onClose?: MouseEventHandler<HTMLElement>;
  lines?: PtyLine[];
  onSubmit?: (cmd: string) => void;
  ps1?: string;
  title?: string;
}

export function PtyConsole({
  open,
  onClose,
  lines = [],
  onSubmit,
  ps1 = 'mikhail@homelab:~$',
  title = 'mikhail@homelab: ~ (ctrl+~ переключает)',
}: PtyConsoleProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);

  // консоль вызывают горячей клавишей — фокус должен приезжать сам
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [lines]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(value);
    setValue('');
  };

  return (
    <>
      <div className={'pty-back' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'pty' + (open ? ' open' : '')}>
        <div className="pty-bar">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
          <span className="t">{title}</span>
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="pty-out pty-scroll" ref={outRef}>
          {lines.map((l, i) => (
            <div key={i} className={l.echo ? 'echo' : undefined}>
              {l.text}
            </div>
          ))}
        </div>
        <form className="pty-input-row" onSubmit={submit}>
          <span className="ps1">{ps1}</span>
          <input
            ref={inputRef}
            className="pty-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
        </form>
      </div>
    </>
  );
}
