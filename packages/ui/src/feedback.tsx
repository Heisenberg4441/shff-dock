import type { MouseEventHandler, ReactNode } from 'react';
import type { Tone } from './core';

interface DialogProps {
  open?: boolean;
  onClose?: MouseEventHandler<HTMLElement>;
  title?: ReactNode;
  /** Подпись в заголовке окна — обычно путь или host:~. */
  barTitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

export function Dialog({ open, onClose, title, barTitle, children, actions }: DialogProps) {
  return (
    <div className={'dlg-back' + (open ? ' open' : '')} onClick={onClose}>
      <div className="dlg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dlg-bar">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
          <span className="t">{barTitle || 'confirm'}</span>
          <button className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="dlg-body">
          {title && <h3>{title}</h3>}
          {typeof children === 'string' ? <p>{children}</p> : children}
        </div>
        {actions && <div className="dlg-foot">{actions}</div>}
      </div>
    </div>
  );
}

/** `fixed` — тонкая полоса чтения страницы; без него обычный прогресс-бар. */
export function ProgressBar({ value = 0, fixed }: { value?: number; fixed?: boolean }) {
  const style = { width: Math.max(0, Math.min(100, value)) + '%' };
  if (fixed) return <div className="progress" style={style} />;
  return (
    <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
      <div className="progress" style={{ ...style, position: 'static', boxShadow: 'var(--glow-btn)' }} />
    </div>
  );
}

interface ToastProps {
  tone?: Tone | string;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: MouseEventHandler<HTMLButtonElement>;
}

export function Toast({ tone, icon, title, children, onClose }: ToastProps) {
  return (
    <div className={['toast', tone].filter(Boolean).join(' ')}>
      <span className="ticon">{icon || '›'}</span>
      <div className="tbody">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
      {onClose && (
        <button className="tx" onClick={onClose} aria-label="dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function ToastStack({ children }: { children?: ReactNode }) {
  return <div className="toast-stack">{children}</div>;
}

export function Tooltip({ label, children }: { label?: ReactNode; children?: ReactNode }) {
  return (
    <span className="tip-wrap" tabIndex={0}>
      {children}
      <span className="tip-bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
}
