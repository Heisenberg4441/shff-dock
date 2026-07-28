import { Button, Dialog } from '@dock/ui';
import { useUi } from '../state/ui';

/** Одно окно подтверждения на всю панель — запрос кладут через ui.ask(). */
export function ConfirmDialog() {
  const ui = useUi();
  const request = ui.confirm;

  return (
    <Dialog
      open={Boolean(request)}
      onClose={ui.closeConfirm}
      barTitle="confirm"
      title={request?.title}
      actions={
        <>
          <Button size="sm" onClick={ui.closeConfirm}>
            отмена
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const fn = request?.onConfirm;
              ui.closeConfirm();
              fn?.();
            }}
          >
            {request?.label ?? 'ок'}
          </Button>
        </>
      }
    >
      {request?.body ?? ''}
    </Dialog>
  );
}
