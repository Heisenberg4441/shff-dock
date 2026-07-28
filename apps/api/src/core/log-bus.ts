import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { LogEntry, LogLevel } from '@dock/shared';
import { clock } from './format';

/**
 * Кольцевой буфер журнала. Панель показывает последние строки со всех
 * контейнеров; на диск ядро ничего не дублирует — сырые логи и так лежат
 * у докера, здесь только то, что нужно отрисовать.
 */
export class LogBus extends EventEmitter {
  private buffer: LogEntry[] = [];

  constructor(private readonly limit: number) {
    super();
    this.setMaxListeners(0);
  }

  push(svc: string, text: string, level: LogLevel = 'info'): LogEntry {
    const entry: LogEntry = { id: randomUUID(), ts: clock(), svc, text, level };
    this.buffer.push(entry);
    if (this.buffer.length > this.limit) this.buffer.splice(0, this.buffer.length - this.limit);
    this.emit('log', entry);
    return entry;
  }

  tail(limit = 200, svc?: string): LogEntry[] {
    const source = svc && svc !== 'all' ? this.buffer.filter((l) => l.svc === svc) : this.buffer;
    return source.slice(-limit);
  }

  clear(): void {
    this.buffer = [];
  }
}
