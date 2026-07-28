import { spawn } from 'node:child_process';
import type { LogLevel } from '@dock/shared';
import { DriverError } from '../driver';

export interface ComposeTarget {
  /** id стека, он же имя compose-проекта. */
  id: string;
  /** /home/dock/stacks/<id> */
  dir: string;
  file: string;
  profiles: string[];
}

export interface ComposeRunOptions {
  /** Каждая строка вывода compose — и в журнал, и в шаг задачи. */
  onLine?: (line: string, stream: 'out' | 'err') => void;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Обёртка над `docker compose`.
 *
 * Compose не переписывается на dockerode сознательно: зависимости, профили,
 * healthcheck'и, порядок запуска и пересоздание изменившихся контейнеров — это
 * ровно то, что compose уже умеет и что пришлось бы повторять по кусочкам.
 * Панель дёргает бинарник и разбирает его вывод; dockerode остаётся для
 * инспекта, метрик и журналов.
 */
export class ComposeRunner {
  constructor(
    private readonly socketPath: string,
    private readonly timeoutMs: number,
    private readonly log: (text: string, level?: LogLevel) => void,
  ) {}

  /** Версия плагина compose; null — плагина в образе нет. */
  async version(): Promise<string | null> {
    try {
      const res = await this.exec(['compose', 'version', '--short'], process.cwd());
      return res.code === 0 ? res.stdout.trim() : null;
    } catch {
      return null;
    }
  }

  async up(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['up', '-d', '--remove-orphans'], options);
  }

  async pull(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['pull'], options);
  }

  async start(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['start'], options);
  }

  async stop(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['stop'], options);
  }

  async restart(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['restart'], options);
  }

  /** Снимает контейнеры и сеть. Тома-каталоги остаются на диске. */
  async down(target: ComposeTarget, options?: ComposeRunOptions): Promise<void> {
    await this.compose(target, ['down', '--remove-orphans'], options);
  }

  /** Проверка compose-файла без запуска — используется после правки конфига. */
  async config(target: ComposeTarget): Promise<string> {
    const res = await this.compose(target, ['config'], undefined, true);
    return res.stdout;
  }

  private async compose(
    target: ComposeTarget,
    args: string[],
    options?: ComposeRunOptions,
    quiet = false,
  ): Promise<RunResult> {
    const flags = ['compose', '--project-name', target.id, '--project-directory', target.dir, '-f', target.file];
    for (const profile of target.profiles) flags.push('--profile', profile);

    const result = await this.exec([...flags, ...args], target.dir, options);
    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim().split('\n').slice(-4).join(' · ');
      throw new DriverError(
        `docker compose ${args[0]} для ${target.id} завершился с кодом ${result.code}: ${detail}`,
        500,
        'compose_error',
      );
    }
    if (!quiet) this.log(`compose ${args[0]} · ${target.id} · готово`, 'ok');
    return result;
  }

  /**
   * Окружение для docker compose собирается с нуля, а не наследуется.
   *
   * Compose ставит переменные окружения выше `.env`, поэтому унаследованное
   * окружение панели молча перебивает значения стека: собственный `PORT=7788`
   * панели сажал контейнер на 7788 вместо того порта, который выбрал
   * пользователь. Всё, что нужно стеку, ядро уже записало в `.env` — значит
   * процессу compose не нужно ничего, кроме пути к бинарникам и сокета.
   */
  private cleanEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      HOME: process.env.HOME ?? '/root',
      DOCKER_HOST: `unix://${this.socketPath}`,
    };
    if (process.env.DOCKER_CONFIG) env.DOCKER_CONFIG = process.env.DOCKER_CONFIG;
    return env;
  }

  private exec(args: string[], cwd: string, options?: ComposeRunOptions): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd, env: this.cleanEnv() });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new DriverError(`docker ${args.join(' ')} не уложился в отведённое время`, 504));
      }, this.timeoutMs);

      const feed = (chunk: Buffer, stream: 'out' | 'err'): void => {
        const text = chunk.toString('utf8');
        if (stream === 'out') stdout += text;
        else stderr += text;
        if (!options?.onLine) return;
        for (const raw of text.split('\n')) {
          const line = raw.replace(/\r/g, '').trim();
          if (line) options.onLine(line, stream);
        }
      };

      child.stdout.on('data', (chunk: Buffer) => feed(chunk, 'out'));
      child.stderr.on('data', (chunk: Buffer) => feed(chunk, 'err'));

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          new DriverError(
            `не запустить docker: ${err.message} — в образе панели нет docker cli или не примонтирован сокет`,
            500,
            'no_docker_cli',
          ),
        );
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  }
}

/**
 * Превращает болтовню compose в человеческий шаг задачи.
 * Compose пишет «Container grafana Started» и «grafana Pulling» — панели
 * достаточно знать, что происходит и сколько уже сделано.
 */
export class ComposeProgress {
  private done = new Set<string>();

  constructor(
    private readonly expected: number,
    private readonly report: (pct: number, step: string) => void,
    private readonly from = 0,
    private readonly to = 100,
  ) {}

  line(text: string): void {
    const clean = text.replace(/\s+/g, ' ').trim();

    const finished = clean.match(/^(?:Container )?(\S+)\s+(Pulled|Started|Running|Healthy|Removed)$/i);
    if (finished) {
      this.done.add(`${finished[1]}:${finished[2]}`);
    }

    const step = this.describe(clean);
    if (!step) return;

    const ratio = this.expected > 0 ? Math.min(1, this.done.size / (this.expected * 2)) : 0;
    this.report(this.from + (this.to - this.from) * ratio, step);
  }

  private describe(line: string): string | null {
    if (/Pulling|Downloading|Extracting/i.test(line)) return 'тяну образы …';
    if (/Creating volume|Creating network/i.test(line)) return 'создаю сеть и тома …';
    if (/Creating|Created/i.test(line)) return 'создаю контейнеры …';
    if (/Starting|Started|Running/i.test(line)) return 'поднимаю контейнеры …';
    if (/Waiting|Healthy/i.test(line)) return 'жду, пока сервис оживёт …';
    if (/Stopping|Stopped/i.test(line)) return 'останавливаю контейнеры …';
    if (/Removing|Removed/i.test(line)) return 'снимаю контейнеры …';
    return null;
  }
}
