import { useEffect, useState } from 'react';
import { Button, CodeBlock, Dialog } from '@dock/ui';
import { api } from '../api/client';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

/** Показывает compose.yml, который ядро сгенерирует (или уже записало) для сервиса. */
export function ComposeDialog() {
  const { catalog } = useDock();
  const ui = useUi();
  const target = ui.composeId;
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!target) return;
    let alive = true;
    setCode('# читаю compose …');
    const load = target.kind === 'catalog' ? api.catalogCompose : api.serviceCompose;
    void load(target.id)
      .then((res) => alive && setCode(res.compose))
      .catch((err: Error) => alive && setCode(`# не вышло собрать compose: ${err.message}`));
    return () => {
      alive = false;
    };
  }, [target?.kind, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = target?.kind === 'catalog' ? catalog.find((c) => c.id === target.id) : null;

  return (
    <Dialog
      open={Boolean(target)}
      onClose={ui.closeCompose}
      barTitle={target ? `~/dock/${target.id}/compose.yml` : ''}
      title="compose"
      actions={
        <>
          <Button size="sm" onClick={ui.closeCompose}>
            закрыть
          </Button>
          {item ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                ui.closeCompose();
                ui.openInstall(item);
              }}
            >
              установить
            </Button>
          ) : null}
        </>
      }
    >
      <CodeBlock lang="yaml" code={code} />
    </Dialog>
  );
}
