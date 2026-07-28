import { useEffect, useState } from 'react';
import { Button, Checkbox, Dialog, Field, Input, ProgressBar } from '@dock/ui';
import { go } from '../hooks/useHashRoute';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

interface Form {
  port: string;
  domain: string;
  volume: string;
  autostart: boolean;
}

/** Диалог установки из каталога: форма → задача в ядре → прогресс по вебсокету. */
export function InstallDialog() {
  const { settings, jobs, actions } = useDock();
  const ui = useUi();
  const item = ui.installItem;

  const [form, setForm] = useState<Form>({ port: '', domain: '', volume: '', autostart: true });
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      setJobId(null);
      return;
    }
    setForm({ port: item.port, domain: item.id, volume: item.vol, autostart: true });
    setJobId(null);
  }, [item]);

  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const installing = job?.status === 'running';

  // задача досчитала до конца — закрываем диалог и уходим на карточку сервиса
  useEffect(() => {
    if (!item || !job || job.status !== 'done') return;
    ui.closeInstall();
    actions.toast('установлено', `${item.name} поднят на порту ${form.port}`, 'ok');
    go(`#service/${job.target}`);
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <Dialog open={false} />;

  const start = async (): Promise<void> => {
    const created = await actions.install({
      catalogId: item.id,
      port: form.port,
      domain: form.domain,
      volume: form.volume,
      autostart: form.autostart,
    });
    if (created) setJobId(created.id);
  };

  return (
    <Dialog
      open
      onClose={installing ? undefined : ui.closeInstall}
      barTitle={`${settings.operator}@${settings.hostname}: ~`}
      title={`Установить ${item.name}`}
      actions={
        <>
          <Button size="sm" disabled={installing} onClick={ui.closeInstall}>
            отмена
          </Button>
          <Button variant="primary" size="sm" disabled={installing} onClick={() => void start()}>
            {installing ? 'ставлю…' : 'установить'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
          {`${item.desc} Один compose-файл, одна команда. Данные останутся на твоём диске.`}
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Порт">
            <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          </Field>
          <Field label="Поддомен">
            <Input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Том с данными">
          <Input
            prompt="~"
            value={form.volume}
            onChange={(e) => setForm({ ...form, volume: e.target.value })}
          />
        </Field>

        <Checkbox
          label="запускать автоматически"
          sublabel="restart: unless-stopped"
          checked={form.autostart}
          onChange={() => setForm({ ...form, autostart: !form.autostart })}
        />

        {job ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{ fontSize: 11.5, color: job.status === 'error' ? 'var(--danger)' : 'var(--accent)' }}
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
