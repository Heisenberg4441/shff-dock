import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Breadcrumbs,
  Button,
  Caret,
  Field,
  Input,
  PageHead,
  Panel,
  ProgressBar,
  Select,
  SpecCard,
  Switch,
  Tabs,
  TerminalWindow,
} from '@dock/ui';
import type { RestartPolicy, Service, ServiceConfig } from '@dock/shared';
import { RESTART_POLICIES } from '@dock/shared';
import { go } from '../hooks/useHashRoute';
import { LEVEL_COLOR, STATUS_TONE } from '../lib/tone';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

const TABS = [
  { id: 'overview', label: 'обзор' },
  { id: 'config', label: 'конфиг' },
  { id: 'logs', label: 'журнал' },
];

/** Приводит сервис к редактируемой форме конфига. */
function draftOf(svc: Service): ServiceConfig {
  return {
    port: svc.port.replace(':', '').replace('—', ''),
    domain: svc.domain,
    volume: svc.volume,
    restart: svc.restart,
    env: svc.env,
    autostart: svc.autostart,
    backup: svc.backup,
  };
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <ProgressBar value={pct} />
    </div>
  );
}

export function ServiceDetailPage({ id }: { id: string }) {
  const { services, settings, logs, actions, jobFor } = useDock();
  const ui = useUi();
  const [tab, setTab] = useState('overview');

  const svc = services.find((s) => s.id === id);
  const [draft, setDraft] = useState<ServiceConfig | null>(null);

  // при переходе на другой сервис форма конфига начинается заново
  useEffect(() => {
    setDraft(null);
    setTab('overview');
  }, [id]);

  const cfg = useMemo(() => (svc ? (draft ?? draftOf(svc)) : null), [svc, draft]);
  const job = jobFor(id);

  const serviceLogs = useMemo(
    () => logs.filter((l) => l.svc === id).slice(-14),
    [logs, id],
  );

  if (!svc || !cfg) {
    return (
      <div>
        <PageHead kicker="$ dock inspect" title="Сервис не найден" lede={`// нет такого сервиса: ${id}`} />
        <Button onClick={() => go('#services')}>вернуться к сервисам</Button>
      </div>
    );
  }

  const ps1 = `${settings.operator}@${settings.hostname}:~$`;
  const patch = (part: Partial<ServiceConfig>): void => setDraft({ ...cfg, ...part });
  const busy = svc.status === 'updating' || Boolean(job);

  return (
    <div>
      <PageHead
        kicker={`$ dock inspect ${svc.id}`}
        title={svc.name}
        lede={svc.desc}
        crumbs={<Breadcrumbs items={[{ href: '#services', label: '~/services' }]} current={svc.name} />}
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 18, flexWrap: 'wrap' }}>
        <Badge tone={STATUS_TONE[svc.status]} led>
          {svc.status}
        </Badge>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{`// ${svc.image}`}</span>
        {!svc.managed ? (
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>// контейнер поднят не через dock</span>
        ) : null}
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="detail-grid">
          <SpecCard
            title="// spec"
            rows={[
              { label: 'образ', value: svc.image },
              { label: 'порт', value: svc.port },
              { label: 'домен', value: svc.domain === '—' ? '—' : `${svc.domain}.${settings.domain}` },
              { label: 'том', value: `~/${svc.volume}` },
              { label: 'restart', value: svc.restart },
              { label: 'бэкап', value: svc.backup ? 'включён' : 'выключен' },
              { label: 'uptime', value: svc.uptime },
            ]}
          />

          <div className="detail-side">
            <Panel title="Ресурсы">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
                <Meter label="cpu" value={`${svc.cpu}%`} pct={svc.cpu} />
                <Meter label="память" value={`${svc.mem}%`} pct={svc.mem} />
                <Meter label="том" value={`${svc.vol}%`} pct={svc.vol} />
              </div>
            </Panel>

            <Panel title="Действия">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void actions.toggleService(svc)}
                >
                  {svc.status === 'stopped' || svc.status === 'error' ? 'запустить' : 'остановить'}
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void actions.restartService(svc)}>
                  перезапустить
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void actions.pullService(svc)}>
                  обновить образ
                </Button>
                <Button size="sm" onClick={() => ui.openCompose('service', svc.id)}>
                  compose
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    ui.ask({
                      title: `Удалить ${svc.name}?`,
                      body: `Контейнер и его маршрут в caddy будут удалены. Том ~/${svc.volume} останется на диске — данные никуда не денутся.`,
                      label: 'удалить',
                      onConfirm: () => {
                        void actions.removeService(svc);
                        go('#services');
                      },
                    })
                  }
                >
                  удалить
                </Button>
              </div>

              {job ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>{job.step}</span>
                  <ProgressBar value={job.pct} />
                </div>
              ) : null}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'config' ? (
        <div className="dock-form">
          <Field label="Порт на хосте" hint="// прокинется как host:container">
            <Input value={cfg.port} onChange={(e) => patch({ port: e.target.value })} />
          </Field>
          <Field label="Домен" hint="// caddy выпишет сертификат сам">
            <Input value={cfg.domain} onChange={(e) => patch({ domain: e.target.value })} />
          </Field>
          <Field label="Том с данными">
            <Input prompt="~" value={cfg.volume} onChange={(e) => patch({ volume: e.target.value })} />
          </Field>
          <Field label="Политика перезапуска">
            <Select
              options={RESTART_POLICIES}
              value={cfg.restart}
              onChange={(e) => patch({ restart: e.target.value as RestartPolicy })}
            />
          </Field>

          <div className="full">
            <Field label="Переменные окружения" hint="// одна пара KEY=value на строку">
              <Input
                multiline
                rows={5}
                value={cfg.env}
                onChange={(e) => patch({ env: e.target.value })}
              />
            </Field>
          </div>

          <div className="row" style={{ gap: 24, padding: '4px 0 6px' }}>
            <Switch
              label="автозапуск при старте хоста"
              checked={cfg.autostart}
              onChange={() => patch({ autostart: !cfg.autostart })}
              showState
            />
            <Switch
              label="включить в ночной бэкап"
              checked={cfg.backup}
              onChange={() => patch({ backup: !cfg.backup })}
              showState
            />
          </div>

          <div className="row dock-divider">
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => {
                void actions.saveConfig(svc.id, cfg);
                setDraft(null);
              }}
            >
              применить и перезапустить
            </Button>
            <Button size="sm" onClick={() => setDraft(null)}>
              сбросить
            </Button>
            <span className="dock-note">
              {draft ? '// есть несохранённые правки' : '// значения из dock.yml'}
            </span>
          </div>
        </div>
      ) : null}

      {tab === 'logs' ? (
        <div style={{ paddingTop: 22 }}>
          <TerminalWindow
            title={`${settings.operator}@${settings.hostname}: ~ (${svc.id})`}
            minHeight={320}
          >
            <div className="term-lines">
              {serviceLogs.map((l) => (
                <div className="log-line" key={l.id}>
                  <span className="ts">{l.ts}</span>
                  <span style={{ color: LEVEL_COLOR[l.level] }}>{l.text}</span>
                </div>
              ))}
              <div>
                <span style={{ color: 'var(--accent)' }}>{ps1}</span> <Caret />
              </div>
            </div>
          </TerminalWindow>
        </div>
      ) : null}
    </div>
  );
}
