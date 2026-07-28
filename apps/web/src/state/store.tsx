import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  BackupInfo,
  ConsoleResult,
  DriverInfo,
  HostStats,
  Job,
  LogEntry,
  RegistryEntry,
  RegistrySource,
  ServerEvent,
  Service,
  Settings,
  StackValues,
} from '@dock/shared';
import type { Tone } from '@dock/ui';
import { api, ApiError } from '../api/client';
import { connectStream } from '../api/stream';

export interface ToastItem {
  id: string;
  title: string;
  text: string;
  tone: Tone;
}

const EMPTY_HOST: HostStats = {
  cpu: '—',
  cpuPct: 0,
  cpuCores: 0,
  ram: '—',
  ramPct: 0,
  disk: '—',
  diskPct: 0,
  uptime: '—',
  uptimeSeconds: 0,
  truthful: true,
};

const EMPTY_SETTINGS: Settings = {
  hostname: 'homelab',
  domain: 'home.lan',
  tz: 'UTC',
  root: 'dock',
  autoUpdate: true,
  crt: true,
  proxy: 'caddy',
  panelPort: '7788',
  tls: true,
  lanOnly: false,
  cron: '0 3 * * *',
  keep: '14 копий',
  backupPath: 'srv/backup',
  operator: 'operator',
  totp: false,
  audit: true,
};

interface State {
  ready: boolean;
  connected: boolean;
  driver: DriverInfo | null;
  services: Service[];
  host: HostStats;
  catalog: RegistryEntry[];
  catalogSource: RegistrySource | null;
  logs: LogEntry[];
  /** Черновик настроек: то, что сейчас в полях формы. */
  settings: Settings;
  /** Последнее сохранённое ядром состояние — база для отката. */
  saved: Settings;
  backup: BackupInfo;
  toasts: ToastItem[];
  jobs: Job[];
  /** Выключенный «поток» замораживает журнал, не разрывая сокет. */
  streaming: boolean;
}

type Action =
  | { type: 'connected'; connected: boolean }
  | { type: 'server'; event: ServerEvent }
  | { type: 'draft'; patch: Partial<Settings> }
  | { type: 'revert' }
  | { type: 'toast'; toast: ToastItem }
  | { type: 'untoast'; id: string }
  | { type: 'streaming'; on: boolean }
  | { type: 'logs'; logs: LogEntry[] };

const LOG_LIMIT = 400;

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: action.connected };

    case 'server': {
      const event = action.event;
      switch (event.type) {
        case 'hello':
          return { ...state, driver: event.driver };
        case 'services':
          return { ...state, services: event.services, ready: true };
        case 'host':
          return { ...state, host: event.host };
        case 'backup':
          return { ...state, backup: event.backup };
        case 'catalog':
          return { ...state, catalog: event.catalog, catalogSource: event.source };
        case 'settings': {
          // правки пользователя не затираем: обновляем только базу отката
          const dirty = JSON.stringify(state.settings) !== JSON.stringify(state.saved);
          return {
            ...state,
            saved: event.settings,
            settings: dirty ? state.settings : event.settings,
          };
        }
        case 'log': {
          if (!state.streaming) return state;
          if (state.logs.some((l) => l.id === event.entry.id)) return state;
          return { ...state, logs: [...state.logs, event.entry].slice(-LOG_LIMIT) };
        }
        case 'job': {
          // задача заменяется целиком: последнее событие и есть её состояние
          const rest = state.jobs.filter((j) => j.id !== event.job.id);
          return { ...state, jobs: [...rest, event.job].slice(-20) };
        }
        default:
          return state;
      }
    }

    case 'draft':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'revert':
      return { ...state, settings: state.saved };

    case 'toast':
      return { ...state, toasts: [...state.toasts, action.toast] };

    case 'untoast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case 'streaming':
      return { ...state, streaming: action.on };

    case 'logs':
      return { ...state, logs: action.logs };

    default:
      return state;
  }
}

const INITIAL: State = {
  ready: false,
  connected: false,
  driver: null,
  services: [],
  host: EMPTY_HOST,
  catalog: [],
  catalogSource: null,
  logs: [],
  settings: EMPTY_SETTINGS,
  saved: EMPTY_SETTINGS,
  backup: { label: '// бэкапов ещё не было', at: null, size: null },
  toasts: [],
  jobs: [],
  streaming: true,
};

export interface DockActions {
  toast(title: string, text: string, tone?: Tone): void;
  dismissToast(id: string): void;
  setStreaming(on: boolean): void;

  toggleService(svc: Service): Promise<void>;
  restartService(svc: Service): Promise<void>;
  pullService(svc: Service): Promise<void>;
  removeService(svc: Service, purge: boolean): Promise<void>;
  saveValues(id: string, values: StackValues): Promise<void>;
  install(stackId: string, values: StackValues): Promise<Job | null>;
  pullAll(): Promise<void>;
  refreshCatalog(): Promise<void>;

  clearLogs(): Promise<void>;

  editSettings(patch: Partial<Settings>): void;
  saveSettings(): Promise<void>;
  revertSettings(): void;
  resetSettings(): Promise<void>;
  runBackup(): Promise<void>;
  restartDaemon(): Promise<void>;

  runCommand(cmd: string): Promise<ConsoleResult | null>;
}

interface DockValue extends State {
  dirty: boolean;
  actions: DockActions;
  /** Активная задача по цели (стеку), если она есть. */
  jobFor(target: string): Job | undefined;
}

const DockContext = createContext<DockValue | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const timers = useRef<number[]>([]);

  const toast = useCallback((title: string, text: string, tone: Tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'toast', toast: { id, title, text, tone } });
    const timer = window.setTimeout(() => dispatch({ type: 'untoast', id }), 4200);
    timers.current.push(timer);
  }, []);

  /** Любая ошибка ядра показывается тостом и не роняет панель. */
  const guard = useCallback(
    async (title: string, fn: () => Promise<void>): Promise<void> => {
      try {
        await fn();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err);
        toast(title, message, 'danger');
      }
    },
    [toast],
  );

  useEffect(() => {
    const disconnect = connectStream(
      (event) => dispatch({ type: 'server', event }),
      (connected) => dispatch({ type: 'connected', connected }),
    );

    return () => {
      disconnect();
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, []);

  const actions = useMemo<DockActions>(
    () => ({
      toast,
      dismissToast: (id) => dispatch({ type: 'untoast', id }),
      setStreaming: (on) => dispatch({ type: 'streaming', on }),

      toggleService: (svc) =>
        guard('не вышло', async () => {
          if (svc.status === 'stopped' || svc.status === 'error') {
            await api.start(svc.id);
            toast('запускаю', `${svc.name} поднимается`, 'ok');
          } else {
            await api.stop(svc.id);
            toast('останавливаю', `${svc.name} выключается`, 'warn');
          }
        }),

      restartService: (svc) =>
        guard('перезапуск не удался', async () => {
          await api.restart(svc.id);
          toast('перезапуск', `${svc.name} поднимается заново`, 'ok');
        }),

      pullService: (svc) =>
        guard('образы не обновились', async () => {
          await api.pull(svc.id);
          toast('обновление образов', `тяну свежие теги для ${svc.name}`, 'ok');
        }),

      removeService: (svc, purge) =>
        guard('удалить не вышло', async () => {
          await api.remove(svc.id, purge);
          toast(
            'удаляю',
            purge ? `${svc.name} снимается вместе с данными` : `${svc.name} снимается, данные остаются`,
            'warn',
          );
        }),

      saveValues: (id, values) =>
        guard('конфиг не применился', async () => {
          await api.saveValues(id, values);
          toast('конфиг применён', `${id} пересоздаётся с новыми параметрами`, 'ok');
        }),

      install: async (stackId, values) => {
        try {
          const { job } = await api.install(stackId, values);
          return job;
        } catch (err) {
          const message = err instanceof ApiError ? err.message : String(err);
          toast('установка не пошла', message, 'danger');
          return null;
        }
      },

      pullAll: () =>
        guard('обновление не пошло', async () => {
          await api.pullAll();
          toast('обновление', 'проверяю теги всех стеков', 'ok');
        }),

      refreshCatalog: () =>
        guard('реестр не обновился', async () => {
          const res = await api.refreshCatalog();
          toast('реестр обновлён', `${res.catalog.length} стеков`, 'ok');
        }),

      clearLogs: () =>
        guard('журнал не очистился', async () => {
          await api.clearLogs();
          dispatch({ type: 'logs', logs: [] });
          toast('журнал очищен', 'буфер панели пуст, файл на диске цел', 'note');
        }),

      editSettings: (patch) => dispatch({ type: 'draft', patch }),

      saveSettings: () =>
        guard('не сохранилось', async () => {
          await api.saveSettings(state.settings);
          toast('сохранено', 'конфиг записан, сервисы не трогал', 'ok');
        }),

      revertSettings: () => {
        dispatch({ type: 'revert' });
        toast('откат', 'вернул последний сохранённый конфиг', 'note');
      },

      resetSettings: () =>
        guard('сброс не удался', async () => {
          await api.resetSettings();
          toast('сброшено', 'конфиг вернулся к дефолту', 'warn');
        }),

      runBackup: () =>
        guard('бэкап не запустился', async () => {
          await api.runBackup();
          toast('бэкап', `restic пошёл по ~/${state.settings.backupPath}`, 'ok');
        }),

      restartDaemon: () =>
        guard('перезапуск не удался', async () => {
          await api.restartDaemon();
          toast('перезапуск', 'dock вернётся через несколько секунд', 'warn');
        }),

      runCommand: async (cmd) => {
        try {
          return await api.console(cmd);
        } catch (err) {
          const message = err instanceof ApiError ? err.message : String(err);
          return { lines: [message] };
        }
      },
    }),
    [guard, toast, state.settings],
  );

  const value = useMemo<DockValue>(
    () => ({
      ...state,
      dirty: JSON.stringify(state.settings) !== JSON.stringify(state.saved),
      actions,
      jobFor: (target: string) =>
        [...state.jobs].reverse().find((j) => j.target === target && j.status === 'running'),
    }),
    [state, actions],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockValue {
  const value = useContext(DockContext);
  if (!value) throw new Error('useDock вызван вне DockProvider');
  return value;
}
