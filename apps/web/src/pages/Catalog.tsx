import { useMemo, useState } from 'react';
import { Badge, Button, Chip, Input, PageHead, Panel } from '@dock/ui';
import { go } from '../hooks/useHashRoute';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

const CATEGORIES = ['all', 'медиа', 'данные', 'сеть', 'код'];

export function CatalogPage() {
  const { catalog, services } = useDock();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (c) =>
        (cat === 'all' || c.cat === cat) &&
        (!q || c.name.includes(q) || c.desc.toLowerCase().includes(q)),
    );
  }, [catalog, cat, query]);

  return (
    <div>
      <PageHead
        kicker="$ dock search"
        title="Каталог"
        lede="Проверенные образы с готовым compose. Ставится одной командой, данные остаются у тебя."
      />

      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          paddingBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 280, flex: 1, maxWidth: 380 }}>
          <Input
            prompt="$"
            placeholder="искать сервис…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'все' : c}
            </Chip>
          ))}
        </div>
        <span className="dock-note">{`// найдено ${list.length} из ${catalog.length}`}</span>
      </div>

      <div className="dock-grid-3">
        {list.map((item) => {
          const installed = services.some((s) => s.id === item.id);
          return (
            <Panel interactive key={item.id}>
              <div className="cat-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-bright)' }}>
                    {item.name}
                  </span>
                  <Badge tone="note">{item.cat}</Badge>
                </div>
                <span className="cat-desc">{item.desc}</span>
                <span style={{ fontSize: 11, color: 'var(--faint)' }}>{item.meta}</span>
                <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                  <Button
                    variant={installed ? 'ghost' : 'primary'}
                    size="sm"
                    onClick={() => (installed ? go(`#service/${item.id}`) : ui.openInstall(item))}
                  >
                    {installed ? 'открыть' : 'установить'}
                  </Button>
                  <Button size="sm" onClick={() => ui.openCompose('catalog', item.id)}>
                    compose
                  </Button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {list.length === 0 ? <div className="dock-empty">// по этому запросу пока пусто</div> : null}
    </div>
  );
}
