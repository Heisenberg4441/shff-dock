import { useState } from 'react';
import type { ReactNode } from 'react';

interface CalloutProps {
  tone?: 'warn' | 'tip' | 'note';
  label?: ReactNode;
  children?: ReactNode;
}

export function Callout({ tone = 'note', label, children }: CalloutProps) {
  const fallback = { warn: 'ВНИМАНИЕ', tip: 'СОВЕТ', note: 'ЗАМЕТКА' }[tone];
  return (
    <div className={'callout ' + tone}>
      <span className="ct">{label || fallback}</span>
      <p>{children}</p>
    </div>
  );
}

interface CodeBlockProps {
  lang?: string;
  code?: string;
  children?: ReactNode;
}

export function CodeBlock({ lang = 'bash', code, children }: CodeBlockProps) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    const text = code || (typeof children === 'string' ? children : '');
    void navigator.clipboard?.writeText(text);
    setOk(true);
    setTimeout(() => setOk(false), 1400);
  };
  return (
    <div className="codeblock">
      <div className="cb-bar">
        <span className="lang">{lang}</span>
        <button className={'copy' + (ok ? ' ok' : '')} onClick={copy}>
          {ok ? 'copied' : 'copy'}
        </button>
      </div>
      <pre>{children || code}</pre>
    </div>
  );
}

interface CtaStripProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function CtaStrip({ title, description, action }: CtaStripProps) {
  return (
    <div className="cta-strip">
      <div className="ct-txt">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

interface FeedItemProps {
  date?: ReactNode;
  title?: ReactNode;
  excerpt?: ReactNode;
  tag?: string;
  href?: string;
  hidden?: boolean;
}

export function FeedItem({ date, title, excerpt, tag, href, hidden }: FeedItemProps) {
  return (
    <a className={'feed-item' + (hidden ? ' hidden' : '')} href={href} data-tag={tag}>
      <span className="feed-date">{date}</span>
      <div className="feed-main">
        <h3>{title}</h3>
        {excerpt && <p>{excerpt}</p>}
      </div>
      {tag && <span className="feed-tag">{tag}</span>}
    </a>
  );
}

interface GuideRowProps {
  index?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  href?: string;
}

export function GuideRow({ index, title, description, href }: GuideRowProps) {
  return (
    <a className="guide-row" href={href}>
      {index && <span className="gnum">{index}</span>}
      <div className="gmain">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <span className="garr">→</span>
    </a>
  );
}

interface MapCardProps {
  emoji?: string;
  title?: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  href?: string;
}

export function MapCard({ emoji, title, description, count, href }: MapCardProps) {
  return (
    <a className="map-card" href={href}>
      {emoji && <span className="emoji">{emoji}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {count && (
        <span className="count">
          {count}
          <span className="arr">→</span>
        </span>
      )}
    </a>
  );
}

interface PageHeadProps {
  /** Шелл-команда над заголовком: '$ dock ps'. */
  kicker?: ReactNode;
  title?: ReactNode;
  lede?: ReactNode;
  crumbs?: ReactNode;
  children?: ReactNode;
}

export function PageHead({ kicker, title, lede, crumbs, children }: PageHeadProps) {
  return (
    <div className="page-head">
      {crumbs}
      {kicker && <span className="kick">{kicker}</span>}
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </div>
  );
}

interface SectionHeadProps {
  kicker?: ReactNode;
  title?: ReactNode;
  note?: ReactNode;
}

export function SectionHead({ kicker, title, note }: SectionHeadProps) {
  return (
    <div className="sec-head">
      {kicker && <span className="sec-kicker">{kicker}</span>}
      <h2 className="sec-title">{title}</h2>
      {note && <span className="sec-note">{note}</span>}
    </div>
  );
}

export interface SpecRow {
  label: string;
  value: ReactNode;
}

export function SpecCard({ title = '// spec', rows = [] }: { title?: ReactNode; rows?: SpecRow[] }) {
  return (
    <div className="spec-card">
      <h3>{title}</h3>
      {rows.map((r) => (
        <div className="spec-row" key={r.label}>
          <span className="k">{r.label}</span>
          <span className="v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

interface WhyCardProps {
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  consequence?: ReactNode;
}

export function WhyCard({ icon, title, children, consequence }: WhyCardProps) {
  return (
    <div className="why-card">
      {icon && <div className="ic">{icon}</div>}
      <h3>{title}</h3>
      <p>{children}</p>
      {consequence && <div className="conseq">{consequence}</div>}
    </div>
  );
}
