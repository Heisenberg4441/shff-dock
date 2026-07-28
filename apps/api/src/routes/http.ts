import type { FastifyInstance } from 'fastify';
import type { ConsoleRequest, InstallRequest, ServiceConfig, Settings } from '@dock/shared';
import { routes } from '@dock/shared';
import type { DockEngine } from '../core/engine';
import { DriverError } from '../core/driver';

interface IdParams {
  id: string;
}

/** REST-поверхность ядра. Ровно то, что перечислено в routes из @dock/shared. */
export async function registerHttpRoutes(app: FastifyInstance, engine: DockEngine): Promise<void> {
  app.get(routes.health, async () => ({ ok: true }));

  app.get(routes.bootstrap, async () => engine.bootstrap());

  app.get(routes.host, async () => engine.getHost());

  app.get(routes.services, async () => ({ services: engine.getServices() }));

  app.get<{ Params: IdParams }>(routes.service, async (req) => engine.getService(req.params.id));

  app.post<{ Params: IdParams }>(routes.serviceStart, async (req) => {
    await engine.startService(req.params.id);
    return engine.getService(req.params.id);
  });

  app.post<{ Params: IdParams }>(routes.serviceStop, async (req) => {
    await engine.stopService(req.params.id);
    return engine.getService(req.params.id);
  });

  app.post<{ Params: IdParams }>(routes.serviceRestart, async (req) => ({
    job: await engine.restartService(req.params.id),
  }));

  app.post<{ Params: IdParams }>(routes.servicePull, async (req) => ({
    job: await engine.pullService(req.params.id),
  }));

  app.post(routes.pullAll, async () => ({ job: await engine.pullAll() }));

  app.patch<{ Params: IdParams; Body: Partial<ServiceConfig> }>(routes.service, async (req) => ({
    job: await engine.updateConfig(req.params.id, req.body ?? {}),
  }));

  app.delete<{ Params: IdParams }>(routes.service, async (req, reply) => {
    await engine.removeService(req.params.id);
    reply.code(204);
    return null;
  });

  app.post<{ Body: InstallRequest }>(routes.install, async (req, reply) => {
    if (!req.body?.catalogId) throw new DriverError('не указан catalogId', 400, 'bad_request');
    reply.code(202);
    return { job: await engine.install(req.body) };
  });

  app.get(routes.catalog, async () => engine.getCatalog());

  app.get<{ Params: IdParams }>(routes.catalogCompose, async (req) => ({
    compose: engine.catalogCompose(req.params.id),
  }));

  app.get<{ Params: IdParams }>(routes.serviceCompose, async (req) => ({
    compose: engine.serviceCompose(req.params.id),
  }));

  app.get<{ Querystring: { svc?: string; limit?: string } }>(routes.logs, async (req) => {
    const limit = Number(req.query.limit) || 200;
    return { logs: engine.logs.tail(limit, req.query.svc) };
  });

  app.delete(routes.logs, async (_req, reply) => {
    engine.logs.clear();
    engine.logs.push('dock', 'буфер журнала очищен · файл на диске цел', 'dim');
    reply.code(204);
    return null;
  });

  app.get(routes.settings, async () => engine.getSettings());

  app.put<{ Body: Partial<Settings> }>(routes.settings, async (req) =>
    engine.saveSettings(req.body ?? {}),
  );

  app.post(routes.settingsReset, async () => engine.resetSettings());

  app.post(routes.backupRun, async () => ({ job: await engine.runBackup() }));

  app.post(routes.daemonRestart, async () => {
    await engine.restartDaemon();
    return { ok: true };
  });

  app.post<{ Body: ConsoleRequest }>(routes.console, async (req) =>
    engine.console(req.body?.cmd ?? ''),
  );
}
