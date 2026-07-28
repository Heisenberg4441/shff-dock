import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Caret, Chip, PageHead, Switch, TerminalWindow } from '@dock/ui';
import { LEVEL_COLOR } from '../lib/tone';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

export function LogsPage({ svc }: { svc: string | null }) {
  const { logs, services, settings, streaming, actions } = useDock();
  const ui = useUi();
  const [filter, setFilter] = useState(svc ?? 'all');
  const bodyRef = useRef<HTMLDivElement>(null);

  // на страницу можно прийти с карточки сервиса — фильтр приезжает из хэша
  useEffect(() => setFilter(svc ?? 'all'), [svc]);

  const visible = useMemo(
    () => logs.filter((l) => filter === 'all' || l.svc === filter).slice(-60),
    [logs, filter],
  );

  useEffect(() => {
    const el = bodyRef.current?.closest('.term-body');
    if (el && streaming) el.scrollTop = el.scrollHeight;
  }, [visible.length, streaming]);

  const ps1 = `${settings.operator}@${settings.hostname}:~$`;
  const chips = ['all', ...services.map((s) => s.id)];

  return (
    <div>
      <PageHead
        kicker="$ dock logs -f"
        title="Журнал"
        lede="Общий поток со всех контейнеров. Ничего не уходит наружу — файл лежит в ~/dock/logs."
      />

      <div
        style={{ display: 'flex', gap: 14, alignItems: 'center', paddingBottom: 16, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map((id) => (
            <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
              {id === 'all' ? 'все' : id}
            </Chip>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Switch
            label="поток"
            checked={streaming}
            onChange={() => actions.setStreaming(!streaming)}
            showState
          />
          <Button size="sm" onClick={() => void actions.clearLogs()}>
            очистить
          </Button>
          <Button size="sm" onClick={() => ui.setPty(true)}>
            консоль
          </Button>
        </div>
      </div>

      <TerminalWindow
        title={`${settings.operator}@${settings.hostname}: ~ (dock logs -f)`}
        minHeight={420}
      >
        <div className="term-lines" ref={bodyRef}>
          {visible.map((l) => (
            <div className="log-line" key={l.id}>
              <span className="ts">{l.ts}</span>
              <span className="svc">{l.svc}</span>
              <span style={{ color: LEVEL_COLOR[l.level] }}>{l.text}</span>
            </div>
          ))}
          <div>
            <span style={{ color: 'var(--accent)' }}>{ps1}</span> <Caret />
          </div>
        </div>
      </TerminalWindow>
    </div>
  );
}
