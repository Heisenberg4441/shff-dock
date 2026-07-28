import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/** Тон статуса: тот же словарь, что у бэйджей, тостов и callout'ов. */
export type Tone = 'ok' | 'warn' | 'note' | 'danger';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>, 'type'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'lg';
  block?: boolean;
  href?: string;
  /** Квадратные скобки вокруг подписи — фирменный приём системы. */
  brackets?: boolean;
  arrow?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  variant = 'ghost',
  size,
  block,
  disabled,
  href,
  onClick,
  type = 'button',
  brackets = true,
  arrow,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = ['btn', variant, size, block ? 'block' : '', className].filter(Boolean).join(' ');
  const label = brackets ? (
    <>
      [&nbsp;{children}
      {arrow ? ' ' + arrow : ''}&nbsp;]
    </>
  ) : (
    <>
      {children}
      {arrow ? ' ' + arrow : ''}
    </>
  );

  if (href && !disabled) {
    return (
      <a className={cls} href={href} {...rest}>
        {label}
      </a>
    );
  }
  return (
    <button className={cls} type={type} disabled={disabled} onClick={onClick} {...rest}>
      {label}
    </button>
  );
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  tone?: Tone | string;
  solid?: boolean;
  square?: boolean;
  /** Светящийся кружок состояния слева от подписи. */
  led?: boolean;
}

export function Badge({ children, tone, solid, square, led, className = '', ...rest }: BadgeProps) {
  const cls = ['badge', tone, solid ? 'solid' : '', square ? 'square' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {led && <span className="led" />}
      {children}
    </span>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  active?: boolean;
}

export function Chip({ children, active, onClick, className = '', ...rest }: ChipProps) {
  return (
    <button
      className={['chip', active ? 'active' : '', className].filter(Boolean).join(' ')}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd className={['kbd', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </kbd>
  );
}

// title здесь — заголовок панели, а не всплывающая подсказка html
interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  title?: ReactNode;
  variant?: string;
  /** Карточка приподнимается при наведении — для кликабельных панелей. */
  interactive?: boolean;
}

export function Panel({ children, title, variant, interactive, className = '', ...rest }: PanelProps) {
  const cls = ['panel', variant, interactive ? 'interactive' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {title && (
        <div className="panel-h">
          <h3>{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}
