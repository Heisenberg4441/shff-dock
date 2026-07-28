import { Badge, Button, PageHead, Panel, ProgressBar } from '@dock/ui';
import type { Service } from '@dock/shared';
import { go } from '../hooks/useHashRoute';
import { STATUS_TONE } from '../lib/tone';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

function Stat({ label, value, pct, note }: { label: string; value: string; pct?: number; note?: string }) {
  return (
    <Panel>
      <div className="dock-stat">
        <span className="k">{label}</span>
        <span className="v">{value}</span>
        {pct != null ? <ProgressBar value={pct} /> : null}
        {note ? <span className="dock-note">{note}</span> : null}
      </div>
    </Panel>
  );
}

function ServiceCard({ svc }: { svc: Service }) {
  const { actions, jobFor } = useDock();
  const job = jobFor(svc.id);
  const busy = svc.status === 'updating' || Boolean(job);

  return (
    <Panel interactive>
      <div className="svc">
        <div className="svc-top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <a className="svc-name" href={`#service/${svc.id}`}>
              {svc.name}
            </a>
            <span className="svc-desc">{svc.desc}</span>
          </div>
          <Badge tone={STATUS_TONE[svc.status]} led>
            {svc.status}
          </Badge>
        </div>

        <div className="svc-meta">
          <div>
            <div className="k">ПОРТ</div>
            <div className="v">{svc.port}</div>
          </div>
          <div>
            <div className="k">CPU / RAM</div>
            <div className="v">{svc.usage}</div>
          </div>
          <div>
            <div className="k">UPTIME</div>
            <div className="v">{svc.uptime}</div>
          </div>
        </div>

        {job ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>{job.step}</span>
            <ProgressBar value={job.pct} />
          </div>
        ) : null}

        <div className="svc-buttons">
          <Button size="sm" disabled={busy} onClick={() => void actions.toggleService(svc)}>
            {svc.status === 'stopped' || svc.status === 'error' ? 'запустить' : 'остановить'}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void actions.restartService(svc)}>
            перезапустить
          </Button>
          <Button size="sm" href={`#logs/${svc.id}`}>
            журнал
          </Button>
          <Button size="sm" href={`#service/${svc.id}`}>
            детали
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function ServicesPage() {
  const { services, host, actions } = useDock();
  const ui = useUi();

  const running = services.filter((s) => s.status === 'running').length;
  const working = services.filter((s) => s.status === 'updating').length;

  return (
    <div>
      <PageHead
        kicker="$ dock ps"
        title="Сервисы"
        lede="Всё, что крутится на твоём железе. Один compose-файл на каждый контейнер."
      />

      <div className="dock-stats">
        <Stat label="CPU" value={host.cpu} pct={host.cpuPct} />
        <Stat label="RAM" value={host.ram} pct={host.ramPct} />
        <Stat label="ДИСК" value={host.disk} pct={host.diskPct} />
        <Stat label="UPTIME" value={host.uptime} note="// с последней перезагрузки" />
      </div>

      <div className="dock-actions">
        <Button variant="primary" onClick={() => go('#catalog')}>
          Установить сервис
        </Button>
        <Button size="sm" onClick={() => void actions.pullAll()}>
          обновить всё
        </Button>
        <Button size="sm" onClick={() => ui.setPty(true)}>
          консоль
        </Button>
        <span className="dock-note">
          {`// ${running} запущено · ${working} в работе · ${services.length} всего`}
        </span>
      </div>

      <div className="dock-grid-2">
        {services.map((svc) => (
          <ServiceCard key={svc.id} svc={svc} />
        ))}
      </div>

      {services.length === 0 ? (
        <div className="dock-empty">// на хосте пока ни одного контейнера</div>
      ) : null}
    </div>
  );
}
