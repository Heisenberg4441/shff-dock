import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { API_PREFIX } from '@dock/shared';
import { config } from './config';
import { DockEngine } from './core/engine';
import { DriverError } from './core/driver';
import { registerHttpRoutes } from './routes/http';
import { registerStream } from './routes/stream';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: config.logLevel },
    // панель может отдавать длинные env-блоки и compose-файлы
    bodyLimit: 1024 * 1024,
  });

  const engine = new DockEngine(config);
  await engine.start();

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof DriverError) {
      reply.code(err.statusCode).send({ error: err.code, message: err.message });
      return;
    }
    req.log.error({ err }, 'необработанная ошибка');
    const fail = err as { statusCode?: number; message?: string };
    reply.code(fail.statusCode ?? 500).send({
      error: 'internal',
      message: fail.message || 'что-то пошло не так',
    });
  });

  // start/stop/pull дёргаются без тела — такой POST не обязан нести content-type
  app.addContentTypeParser('*', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch {
      done(null, body);
    }
  });

  await app.register(websocket);
  await app.register(async (scope) => {
    await registerHttpRoutes(scope, engine);
    await registerStream(scope, engine);
  }, { prefix: API_PREFIX });

  // Собранная панель раздаётся тем же процессом: один порт, один контейнер.
  const hasWeb = config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, { root: config.webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith(`${API_PREFIX}/`)) {
        reply.code(404).send({ error: 'not_found', message: `нет такой ручки: ${req.url}` });
        return;
      }
      reply.sendFile('index.html');
    });
  } else {
    app.log.warn(`сборка панели не найдена в ${config.webDist} — отдаю только API`);
  }

  const close = async (signal: string): Promise<void> => {
    app.log.info(`${signal} — гашу панель`);
    await app.close();
    await engine.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void close('SIGTERM'));
  process.on('SIGINT', () => void close('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    `драйвер: ${config.driver} · раскладка: ${config.paths.root} · метрики: ${
      config.metrics.hostMounted ? 'хостовые' : 'только контейнер'
    }`,
  );
}

main().catch((err) => {
  console.error('панель не поднялась:', err);
  process.exit(1);
});
