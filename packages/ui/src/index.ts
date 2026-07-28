/**
 * SHFF Design System в виде React-компонентов.
 *
 * Разметка и имена классов перенесены один-в-один из бандла дизайн-системы
 * (`_ds/shff-design-system-…/_ds_bundle.js`), стили берутся оттуда же —
 * поэтому пересборка дизайн-системы не требует правок здесь.
 */
import '@ds/styles.css';

export { Badge, Button, Chip, Kbd, Panel } from './core';
export type { ButtonVariant, Tone } from './core';

export {
  Callout,
  CodeBlock,
  CtaStrip,
  FeedItem,
  GuideRow,
  MapCard,
  PageHead,
  SectionHead,
  SpecCard,
  WhyCard,
} from './content';
export type { SpecRow } from './content';

export { Dialog, ProgressBar, Toast, ToastStack, Tooltip } from './feedback';

export { Checkbox, Field, Input, Select, Switch } from './forms';
export type { SelectOption } from './forms';

export { Breadcrumbs, Footer, MobileMenu, Tabs, Topbar } from './navigation';
export type { FooterColumn, NavLink, TabItem } from './navigation';

export { Caret, PtyConsole, TerminalWindow } from './terminal';
export type { PtyLine } from './terminal';
