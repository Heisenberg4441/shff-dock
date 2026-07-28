import { useMemo, useState } from 'react';
import { Badge, Button, Chip, Input, PageHead, Panel } from '@dock/ui';
import { go } from '../hooks/useHashRoute';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

export function CatalogPage() {
  const { catalog, catalogSource, services, actions } = useDock();
  const ui = useUi();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

  const categories = useMemo(
    () => ['all', ...[...new Set(catalog.map((c) => c.category))].sort()],
    [catalog],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (c) =>
        (cat === 'all' || c.category === cat) &&
        (!q || c.name.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)),
    );
  }, [catalog, cat, query]);

  return (
    <div>
      <PageHead
        kicker="$ dock search"
        title="Каталог"
        lede="Готовые стеки: сервис приезжает уже настроенным, вместе с конфигами соседей. Ставится одной кнопкой, данные остаются у тебя."
      />

      {catalogSource ? (
        <div className="dock-note" style={{ paddingBottom: 14 }}>
          {catalogSource.kind === 'remote'
            ? `// реестр: ${catalogSource.url}${catalogSource.error ? ` · ${catalogSource.error}` : ''}`
            : '// реестр из образа панели · свой репозиторий подключается через DOCK_REGISTRY_URL'}
        </div>
      ) : null}

      <div
        style={{ display: 'flex', gap: 14, alignItems: 'center', paddingBottom: 16, flexWrap: 'wrap' }}
      >
        <div style={{ minWidth: 280, flex: 1, maxWidth: 380 }}>
          <Input
            prompt="$"
            placeholder="искать стек…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'все' : c}
            </Chip>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="dock-note">{`// найдено ${list.length} из ${catalog.length}`}</span>
          <Button size="sm" onClick={() => void actions.refreshCatalog()}>
            обновить реестр
          </Button>
        </div>
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
                  <Badge tone="note">{item.category}</Badge>
                </div>
                <span className="cat-desc">{item.summary}</span>
                <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                  {`${item.meta ?? ''}${item.meta ? ' · ' : '// '}v${item.version}`}
                </span>
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
