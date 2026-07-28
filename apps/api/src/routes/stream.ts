import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ServerEvent } from '@dock/shared';
import { WS_ROUTE } from '@dock/shared';
import type { DockEngine } from '../core/engine';

/** ws.OPEN — единственное состояние, в котором сокету можно писать. */
const OPEN = 1;

/**
 * Единственный вебсокет панели. При подключении сразу отдаём снимок
 * состояния, дальше — только дельты: строки журнала, обновления сервисов,
 * метрики хоста и прогресс задач.
 */
export async function registerStream(app: FastifyInstance, engine: DockEngine): Promise<void> {
  // маршрут регистрируется внутри префикса /api, поэтому путь здесь относительный
  app.get(WS_ROUTE, { websocket: true }, (socket: WebSocket) => {
    const send = (event: ServerEvent): void => {
      if (socket.readyState === OPEN) socket.send(JSON.stringify(event));
    };

    void engine.bootstrap().then((snapshot) => {
      send({ type: 'hello', driver: snapshot.driver });
      send({ type: 'services', services: snapshot.services });
      send({ type: 'host', host: snapshot.host });
      send({ type: 'settings', settings: snapshot.settings });
      send({ type: 'backup', backup: snapshot.backup });
      for (const entry of snapshot.logs) send({ type: 'log', entry });
    });

    const unsubscribe = engine.subscribe(send);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
      } catch {
        /* мусор в сокете игнорируем */
      }
    });

    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);
  });
}
