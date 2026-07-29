import type {
  BootstrapResponse,
  CatalogResponse,
  ConsoleResult,
  HostStats,
  Job,
  LogEntry,
  Service,
  Settings,
  StackFormResponse,
  StackPostInfo,
  StackValues,
} from '@dock/shared';
import { API_PREFIX, routes, withParams } from '@dock/shared';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_PREFIX + path, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* тело не json — оставляем статус */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/** Тонкая обёртка над ядром: ни одного зашитого URL за пределами этого файла. */
export const api = {
  bootstrap: () => request<BootstrapResponse>(routes.bootstrap),
  host: () => request<HostStats>(routes.host),

  services: () => request<{ services: Service[] }>(routes.services),
  service: (id: string) => request<Service>(withParams(routes.service, { id })),

  start: (id: string) => post<{ job: Job }>(withParams(routes.serviceStart, { id })),
  stop: (id: string) => post<{ job: Job }>(withParams(routes.serviceStop, { id })),
  restart: (id: string) => post<{ job: Job }>(withParams(routes.serviceRestart, { id })),
  pull: (id: string) => post<{ job: Job }>(withParams(routes.servicePull, { id })),
  pullAll: () => post<{ job: Job }>(routes.pullAll),

  /** Форма вкладки «конфиг»: манифест стека и текущие значения. */
  stackForm: (id: string) => request<StackFormResponse>(withParams(routes.serviceStack, { id })),

  saveValues: (id: string, values: StackValues) =>
    request<{ job: Job }>(withParams(routes.service, { id }), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    }),

  remove: (id: string, purge = false) =>
    request<{ job: Job }>(`${withParams(routes.service, { id })}${purge ? '?purge=1' : ''}`, {
      method: 'DELETE',
    }),

  catalog: () => request<CatalogResponse>(routes.catalog),
  refreshCatalog: () => post<CatalogResponse>(routes.catalogRefresh),
  /** Манифест и значения по умолчанию для формы установки. */
  catalogForm: (id: string) => request<StackFormResponse>(withParams(routes.catalogStack, { id })),
  catalogCompose: (id: string) =>
    request<{ compose: string }>(withParams(routes.catalogCompose, { id })),
  serviceCompose: (id: string) =>
    request<{ compose: string }>(withParams(routes.serviceCompose, { id })),
  servicePost: (id: string) =>
    request<{ post: StackPostInfo | null }>(withParams(routes.servicePost, { id })),

  install: (stackId: string, values: StackValues) =>
    post<{ job: Job }>(routes.install, { stackId, values }),

  logs: (svc?: string, limit = 200) =>
    request<{ logs: LogEntry[] }>(
      `${routes.logs}?limit=${limit}${svc && svc !== 'all' ? `&svc=${encodeURIComponent(svc)}` : ''}`,
    ),
  clearLogs: () => request<void>(routes.logs, { method: 'DELETE' }),

  settings: () => request<Settings>(routes.settings),
  saveSettings: (patch: Partial<Settings>) =>
    request<Settings>(routes.settings, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  resetSettings: () => post<Settings>(routes.settingsReset),

  runBackup: () => post<{ job: Job }>(routes.backupRun),
  restartDaemon: () => post<{ ok: boolean }>(routes.daemonRestart),

  console: (cmd: string) => post<ConsoleResult>(routes.console, { cmd }),
};
