import type { MouseEventHandler, ReactNode } from 'react';

export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

interface TopbarProps {
  brand?: string;
  /** Правая часть марки: у Dock это operator@hostname. */
  brandSuffix?: string;
  items?: NavLink[];
  cta?: NavLink | null;
  /** href активного пункта — он подсвечивается акцентом. */
  current?: string;
  onBurger?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
}

export function Topbar({
  brand = 'SHFF',
  brandSuffix = 'self_hosted_freedom',
  items = [],
  cta,
  current,
  onBurger,
  href = 'index.html',
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="wrap">
        <a className="brand" href={href}>
          <span className="blk">{brand}</span>
          {brandSuffix && <span className="hide-sm">{brandSuffix}</span>}
        </a>
        <nav className="nav">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              style={it.href === current ? { color: 'var(--accent)' } : undefined}
            >
              {it.label}
            </a>
          ))}
          {cta && (
            <a className="tg" href={cta.href} target="_blank" rel="noopener">
              {cta.label}
            </a>
          )}
        </nav>
        <button className="burger" onClick={onBurger} aria-label="menu">
          ≡
        </button>
      </div>
    </header>
  );
}

export function MobileMenu({ items = [], open }: { items?: NavLink[]; open?: boolean }) {
  return (
    <nav className={'mobile-menu' + (open ? ' open' : '')}>
      {items.map((it) => (
        <a key={it.href} href={it.href}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

interface TabsProps {
  items?: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
  boxed?: boolean;
}

export function Tabs({ items = [], value, onChange, boxed }: TabsProps) {
  return (
    <div className={'tabs' + (boxed ? ' boxed' : '')} role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          className={'tab' + (value === it.id ? ' active' : '')}
          onClick={() => onChange?.(it.id)}
        >
          {it.label}
          {it.count != null && <span className="tcount">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items = [], current }: { items?: NavLink[]; current?: ReactNode }) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <span key={it.href + i}>
          <a href={it.href}>{it.label}</a>
          <span className="sep">/</span>
        </span>
      ))}
      {current && <span className="cur">{current}</span>}
    </div>
  );
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

interface FooterProps {
  blurb?: ReactNode;
  columns?: FooterColumn[];
  signature?: string;
  meta?: ReactNode;
  brand?: string;
}

export function Footer({
  blurb,
  columns = [],
  signature = 'Freedom can only live at home.',
  meta,
  brand = 'SHFF',
}: FooterProps) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-col foot-brand">
            <span className="brand">
              <span className="blk">{brand}</span>
            </span>
            {blurb && <p>{blurb}</p>}
          </div>
          {columns.map((col) => (
            <div className="foot-col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) => (
                <a
                  key={l.href + l.label}
                  href={l.href}
                  target={l.external ? '_blank' : undefined}
                  rel={l.external ? 'noopener' : undefined}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span className="foot-sig">{signature}</span>
          {meta && <span className="foot-meta">{meta}</span>}
        </div>
      </div>
    </footer>
  );
}
