import type { LogLevel, ServiceStatus } from '@dock/shared';
import type { Tone } from '@dock/ui';

/** Статус контейнера → тон бэйджа дизайн-системы. */
export const STATUS_TONE: Record<ServiceStatus, Tone> = {
  running: 'ok',
  updating: 'warn',
  stopped: 'note',
  error: 'danger',
};

/** Уровень строки журнала → цвет текста в терминале. */
export const LEVEL_COLOR: Record<LogLevel, string> = {
  ok: 'var(--accent)',
  info: 'var(--text)',
  warn: 'var(--warn)',
  err: 'var(--danger)',
  dim: 'var(--muted)',
};
