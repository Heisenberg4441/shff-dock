import { useEffect, useState } from 'react';
import { Button, Callout, Dialog, ProgressBar } from '@dock/ui';
import type { StackManifest, StackValues } from '@dock/shared';
import { api } from '../api/client';
import { go } from '../hooks/useHashRoute';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';
import { StackForm } from './StackForm';

/**
 * Диалог установки стека.
 *
 * Форма не зашита: панель спрашивает у ядра манифест и рисует ровно те поля,
 * что объявил автор стека. Прогресс приезжает по вебсокету, поэтому диалог
 * показывает настоящие шаги compose, а не выдуманный таймер.
 */
export function InstallDialog() {
  const { settings, jobs, actions } = useDock();
  const ui = useUi();
  const entry = ui.installItem;

  const [manifest, setManifest] = useState<StackManifest | null>(null);
  const [values, setValues] = useState<StackValues>({});
  const [busyPorts, setBusyPorts] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setManifest(null);
      setJobId(null);
      setError(null);
      return;
    }
    let alive = true;
    setManifest(null);
    setError(null);
    setJobId(null);
    void api
      .catalogForm(entry.id)
      .then((form) => {
        if (!alive) return;
        setManifest(form.manifest);
        setValues(form.values);
        setBusyPorts(form.busyPorts);
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const installing = job?.status === 'running';

  // задача досчитала до конца — закрываем диалог и уходим на карточку стека
  useEffect(() => {
    if (!entry || !job || job.status !== 'done') return;
    ui.closeInstall();
    actions.toast('установлено', `${entry.name} поднят`, 'ok');
    go(`#service/${job.target}`);
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return <Dialog open={false} />;

  const start = async (): Promise<void> => {
    const created = await actions.install(entry.id, values);
    if (created) setJobId(created.id);
  };

  return (
    <Dialog
      open
      onClose={installing ? undefined : ui.closeInstall}
      barTitle={`${settings.operator}@${settings.hostname}: ~`}
      title={`Установить ${entry.name}`}
      actions={
        <>
          <Button size="sm" disabled={installing} onClick={ui.closeInstall}>
            отмена
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={installing || !manifest}
            onClick={() => void start()}
          >
            {installing ? 'ставлю…' : 'установить'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
          {manifest?.description ?? entry.summary}
        </span>

        {error ? <Callout tone="warn">{error}</Callout> : null}

        {manifest ? (
          <div className="dock-form" style={{ paddingTop: 0, maxWidth: 'none' }}>
            <StackForm
              manifest={manifest}
              values={values}
              busyPorts={busyPorts}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />
          </div>
        ) : !error ? (
          <span className="dock-note">// читаю манифест …</span>
        ) : null}

        {job ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: 11.5,
                color: job.status === 'error' ? 'var(--danger)' : 'var(--accent)',
              }}
            >
              {job.status === 'error' ? job.error : job.step}
            </span>
            <ProgressBar value={job.pct} />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
