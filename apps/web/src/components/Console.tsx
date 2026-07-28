import { useState } from 'react';
import { PtyConsole } from '@dock/ui';
import type { PtyLine } from '@dock/ui';
import { go } from '../hooks/useHashRoute';
import { useDock } from '../state/store';
import { useUi } from '../state/ui';

const GREETING: PtyLine[] = [{ text: 'dock 0.9.2 · введи help, чтобы увидеть команды' }];

/**
 * Консоль по ctrl+~. Команды выполняет ядро, панель только рисует вывод —
 * поэтому `dock up jellyfin` из консоли и кнопка в карточке делают одно и то же.
 */
export function Console() {
  const { settings, actions } = useDock();
  const ui = useUi();
  const [lines, setLines] = useState<PtyLine[]>(GREETING);

  const ps1 = `${settings.operator}@${settings.hostname}:~$`;

  const submit = async (cmd: string): Promise<void> => {
    const result = await actions.runCommand(cmd);
    if (!result) return;

    if (result.clear) {
      setLines([]);
      return;
    }

    setLines((prev) =>
      [
        ...prev,
        ...result.lines.map((text, i) => ({ text, echo: i === 0 })),
      ].slice(-60),
    );

    if (result.navigate) {
      ui.setPty(false);
      go(result.navigate);
    }
  };

  return (
    <PtyConsole
      open={ui.ptyOpen}
      onClose={() => ui.setPty(false)}
      lines={lines}
      onSubmit={(cmd) => void submit(cmd)}
      ps1={ps1}
      title={`${settings.operator}@${settings.hostname}: ~ (ctrl+~ переключает)`}
    />
  );
}
