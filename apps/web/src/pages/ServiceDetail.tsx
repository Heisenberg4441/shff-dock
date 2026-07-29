import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Breadcrumbs,
  Button,
  Callout,
  Caret,
  PageHead,
  Panel,
  ProgressBar,
  SpecCard,
  Tabs,
  TerminalWindow,
} from '@dock/ui';
import type { StackManifest, StackPostInfo, StackValues } from '@dock/shared';
import { api } from '../api/client';
import { PostPanel } from '../components/PostPanel';
import { StackForm } from '../components/StackForm';
import { go } from '../hooks/useHashRoute';
import { LEVEL_COLOR, STATUS_TONE } from '../lib/tone';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

const TABS = [
  { id: 'overview', label: 'обзор' },
  { id: 'access', label: 'реквизиты' },
  { id: 'config', label: 'конфиг' },
  { id: 'logs', label: 'журнал' },
];

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
  // undefined — ещё не запрашивали, null — стек реквизитов не оставил
  const [post, setPost] = useState<StackPostInfo | null | undefined>(undefined);

  const svc = services.find((s) => s.id === id);
  const job = jobFor(id);

  const [manifest, setManifest] = useState<StackManifest | null>(null);
  const [values, setValues] = useState<StackValues>({});
  const [saved, setSaved] = useState<StackValues>({});
  const [busyPorts, setBusyPorts] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setTab('overview');
    setManifest(null);
    setFormError(null);
  }, [id]);

  // реквизиты содержат пароли, поэтому запрашиваются только при открытии вкладки
  useEffect(() => {
    if (tab !== 'access' || !svc || svc.kind !== 'stack' || post !== undefined) return;
    let alive = true;
    void api
      .servicePost(svc.id)
      .then((res) => alive && setPost(res.post))
      .catch(() => alive && setPost(null));
    return () => {
      alive = false;
    };
  }, [tab, id, svc?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // при переходе на другой сервис реквизиты прежнего показывать нельзя
  useEffect(() => setPost(undefined), [id]);

  // форма конфига читается только когда её открыли — лишний запрос ни к чему
  useEffect(() => {
    if (tab !== 'config' || !svc || svc.kind !== 'stack' || manifest) return;
    let alive = true;
    void api
      .stackForm(id)
      .then((form) => {
        if (!alive) return;
        setManifest(form.manifest);
        setValues(form.values);
        setSaved(form.values);
        setBusyPorts(form.busyPorts);
      })
      .catch((err: Error) => alive && setFormError(err.message));
    return () => {
      alive = false;
    };
  }, [tab, id, svc?.kind, manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  const serviceLogs = useMemo(() => logs.filter((l) => l.svc === id).slice(-16), [logs, id]);
  const ownPorts = useMemo(
    () =>
      (svc?.containers ?? [])
        .map((c) => Number(c.port.replace(':', '')))
        .filter((p) => Number.isInteger(p) && p > 0),
    [svc],
  );

  if (!svc) {
    return (
      <div>
        <PageHead kicker="$ dock inspect" title="Сервис не найден" lede={`// нет такого сервиса: ${id}`} />
        <Button onClick={() => go('#services')}>вернуться к сервисам</Button>
      </div>
    );
  }

  const ps1 = `${settings.operator}@${settings.hostname}:~$`;
  const busy = svc.status === 'updating' || Boolean(job);
  const isStack = svc.kind === 'stack';
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

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
        {isStack ? (
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{`// стек v${svc.version}`}</span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>// контейнер поднят не через dock</span>
        )}
      </div>

      <Tabs
        items={isStack ? TABS : TABS.filter((t) => t.id !== 'config' && t.id !== 'access')}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <>
          <div className="detail-grid">
            <SpecCard
              title="// spec"
              rows={[
                { label: 'образ', value: svc.image },
                { label: 'порт', value: svc.port },
                { label: 'домен', value: svc.domain === '—' ? '—' : `${svc.domain}.${settings.domain}` },
                { label: isStack ? 'каталог стека' : 'том', value: svc.volume },
                { label: 'restart', value: svc.restart },
                { label: 'контейнеров', value: String(svc.containers.length) },
                { label: 'uptime', value: svc.uptime },
              ]}
            />

            <div className="detail-side">
              <Panel title="Ресурсы">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
                  <Meter label="cpu" value={`${svc.cpu}%`} pct={svc.cpu} />
                  <Meter label="память" value={`${svc.mem}%`} pct={svc.mem} />
                  <Meter label="диск под стеком" value={`${svc.vol}%`} pct={svc.vol} />
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
                  {isStack ? (
                    <Button size="sm" disabled={busy} onClick={() => void actions.pullService(svc)}>
                      обновить образы
                    </Button>
                  ) : null}
                  {isStack ? (
                    <Button size="sm" onClick={() => ui.openCompose('service', svc.id)}>
                      compose
                    </Button>
                  ) : null}
                </div>

                {job ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>{job.step}</span>
                    <ProgressBar value={job.pct} />
                  </div>
                ) : null}

                <div className="dock-divider" style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 10.5, letterSpacing: '1.4px', color: 'var(--danger)' }}>
                    ОПАСНАЯ ЗОНА
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10 }}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        ui.ask({
                          title: `Снять ${svc.name}?`,
                          body: `Контейнеры будут удалены, каталог ${svc.volume} останется на диске вместе с данными и compose-файлом. Поднять обратно можно той же кнопкой «запустить».`,
                          label: 'снять',
                          onConfirm: () => {
                            void actions.removeService(svc, false);
                            go('#services');
                          },
                        })
                      }
                    >
                      снять стек
                    </Button>
                    {isStack ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          ui.ask({
                            title: `Удалить ${svc.name} вместе с данными?`,
                            body: `Каталог ${svc.volume} будет удалён целиком: контейнеры, конфиги, базы, загруженные файлы. Это необратимо.`,
                            label: 'удалить всё',
                            onConfirm: () => {
                              void actions.removeService(svc, true);
                              go('#services');
                            },
                          })
                        }
                      >
                        удалить с данными
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Panel>
            </div>
          </div>

          {svc.containers.length ? (
            <div style={{ paddingTop: 22 }}>
              <Panel title="Контейнеры">
                <div className="containers">
                  {svc.containers.map((c) => (
                    <div className="container-row" key={c.id}>
                      <span className="svc">{c.service}</span>
                      <Badge tone={STATUS_TONE[c.status]} led>
                        {c.status}
                      </Badge>
                      <span className="img">{c.image}</span>
                      <span className="num">{c.port}</span>
                      <span className="num">{c.usage}</span>
                      <span className="num">{c.uptime}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'access' && isStack ? (
        <div style={{ paddingTop: 22, maxWidth: 720 }}>
          {post === undefined ? (
            <div className="dock-empty">// читаю реквизиты …</div>
          ) : (
            <PostPanel post={post} />
          )}
        </div>
      ) : null}

      {tab === 'config' && isStack ? (
        formError ? (
          <div style={{ paddingTop: 22 }}>
            <Callout tone="warn">{formError}</Callout>
          </div>
        ) : manifest ? (
          <div className="dock-form">
            <StackForm
              manifest={manifest}
              values={values}
              busyPorts={busyPorts}
              ownPorts={ownPorts}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />

            <div className="row dock-divider">
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !dirty}
                onClick={() => {
                  void actions.saveValues(svc.id, values);
                  setSaved(values);
                }}
              >
                применить и пересоздать
              </Button>
              <Button size="sm" onClick={() => setValues(saved)}>
                сбросить
              </Button>
              <span className="dock-note">
                {dirty
                  ? '// есть несохранённые правки'
                  : `// значения из ${svc.volume}/.env`}
              </span>
            </div>
          </div>
        ) : (
          <div className="dock-empty">// читаю конфиг стека …</div>
        )
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
