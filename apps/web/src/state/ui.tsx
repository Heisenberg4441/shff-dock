import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CatalogItem } from '@dock/shared';

export interface ConfirmRequest {
  title: string;
  body: string;
  /** Подпись разрушительной кнопки: 'удалить', 'сбросить'. */
  label: string;
  onConfirm: () => void;
}

interface UiState {
  confirm: ConfirmRequest | null;
  installItem: CatalogItem | null;
  composeId: { kind: 'catalog' | 'service'; id: string } | null;
  ptyOpen: boolean;
}

interface UiValue extends UiState {
  ask(request: ConfirmRequest): void;
  closeConfirm(): void;
  openInstall(item: CatalogItem): void;
  closeInstall(): void;
  openCompose(kind: 'catalog' | 'service', id: string): void;
  closeCompose(): void;
  setPty(open: boolean): void;
  togglePty(): void;
  closeOverlays(): void;
}

const UiContext = createContext<UiValue | null>(null);

/** Оверлеи панели: подтверждения, установка, compose и консоль. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UiState>({
    confirm: null,
    installItem: null,
    composeId: null,
    ptyOpen: false,
  });

  const patch = useCallback((next: Partial<UiState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo<UiValue>(
    () => ({
      ...state,
      ask: (confirm) => patch({ confirm }),
      closeConfirm: () => patch({ confirm: null }),
      openInstall: (installItem) => patch({ installItem }),
      closeInstall: () => patch({ installItem: null }),
      openCompose: (kind, id) => patch({ composeId: { kind, id } }),
      closeCompose: () => patch({ composeId: null }),
      setPty: (ptyOpen) => patch({ ptyOpen }),
      togglePty: () => setState((prev) => ({ ...prev, ptyOpen: !prev.ptyOpen })),
      closeOverlays: () => patch({ confirm: null, composeId: null, ptyOpen: false }),
    }),
    [state, patch],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi вызван вне UiProvider');
  return value;
}
