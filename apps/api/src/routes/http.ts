import type { FastifyInstance } from 'fastify';
import type { ConsoleRequest, Settings, StackInstallRequest, StackValues } from '@dock/shared';
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

  app.post<{ Params: IdParams }>(routes.serviceStart, async (req) => ({
    job: await engine.startService(req.params.id),
  }));

  app.post<{ Params: IdParams }>(routes.serviceStop, async (req) => ({
    job: await engine.stopService(req.params.id),
  }));

  app.post<{ Params: IdParams }>(routes.serviceRestart, async (req) => ({
    job: await engine.restartService(req.params.id),
  }));

  app.post<{ Params: IdParams }>(routes.servicePull, async (req) => ({
    job: await engine.pullService(req.params.id),
  }));

  app.post(routes.pullAll, async () => ({ job: await engine.pullAll() }));

  /** Форма вкладки «конфиг»: манифест стека и текущие значения инпутов. */
  app.get<{ Params: IdParams }>(routes.serviceStack, async (req) =>
    engine.installedForm(req.params.id),
  );

  app.patch<{ Params: IdParams; Body: { values?: StackValues } }>(routes.service, async (req) => ({
    job: await engine.applyValues(req.params.id, req.body?.values ?? {}),
  }));

  app.delete<{ Params: IdParams; Querystring: { purge?: string } }>(
    routes.service,
    async (req, reply) => {
      const purge = req.query.purge === '1' || req.query.purge === 'true';
      reply.code(202);
      return { job: await engine.removeService(req.params.id, purge) };
    },
  );

  app.get<{ Params: IdParams }>(routes.servicePost, async (req) => ({
    post: await engine.servicePost(req.params.id),
  }));

  app.get<{ Params: IdParams }>(routes.serviceCompose, async (req) => ({
    compose: await engine.serviceCompose(req.params.id),
  }));

  app.get(routes.catalog, async () => ({
    catalog: engine.getCatalog(),
    source: engine.getCatalogSource(),
  }));

  app.post(routes.catalogRefresh, async () => ({
    catalog: await engine.refreshCatalog(),
    source: engine.getCatalogSource(),
  }));

  /** Манифест и значения по умолчанию — форма установки. */
  app.get<{ Params: IdParams }>(routes.catalogStack, async (req) => engine.stackForm(req.params.id));

  app.get<{ Params: IdParams }>(routes.catalogCompose, async (req) => ({
    compose: await engine.catalogCompose(req.params.id),
  }));

  app.post<{ Body: StackInstallRequest }>(routes.install, async (req, reply) => {
    if (!req.body?.stackId) throw new DriverError('не указан stackId', 400, 'bad_request');
    reply.code(202);
    return { job: await engine.install(req.body.stackId, req.body.values ?? {}) };
  });

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
