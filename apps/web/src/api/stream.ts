import type { ServerEvent } from '@dock/shared';
import { WS_PATH } from '@dock/shared';

type StatusHandler = (connected: boolean) => void;

/**
 * Вебсокет к ядру с переподключением. Пока сокет живой, панель не опрашивает
 * сервер вообще: снимок приезжает при подключении, дальше только дельты.
 */
export function connectStream(onEvent: (event: ServerEvent) => void, onStatus: StatusHandler): () => void {
  let socket: WebSocket | null = null;
  let retry: number | null = null;
  let attempt = 0;
  let closed = false;

  const open = (): void => {
    if (closed) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}${WS_PATH}`);

    socket.onopen = () => {
      attempt = 0;
      onStatus(true);
    };

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data as string) as ServerEvent;
        if (event && typeof event.type === 'string') onEvent(event);
      } catch {
        /* мусор игнорируем */
      }
    };

    socket.onclose = () => {
      onStatus(false);
      if (closed) return;
      // 1с, 2с, 4с … но не дольше 15с между попытками
      const delay = Math.min(15000, 1000 * 2 ** attempt);
      attempt += 1;
      retry = window.setTimeout(open, delay);
    };

    socket.onerror = () => socket?.close();
  };

  open();

  return () => {
    closed = true;
    if (retry) window.clearTimeout(retry);
    socket?.close();
  };
}
