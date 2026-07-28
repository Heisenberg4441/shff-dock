import { Toast, ToastStack } from '@dock/ui';
import { useDock } from '../state/store';

export function Toasts() {
  const { toasts, actions } = useDock();
  return (
    <ToastStack>
      {toasts.map((t) => (
        <Toast key={t.id} tone={t.tone} title={t.title} onClose={() => actions.dismissToast(t.id)}>
          {t.text}
        </Toast>
      ))}
    </ToastStack>
  );
}
