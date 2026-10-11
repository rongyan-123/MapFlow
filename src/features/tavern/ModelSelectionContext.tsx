import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { readModelSelection, saveModelSelection } from './modelPreferences';
import type { TavernModelSelection } from './types';

interface ModelSelectionState {
  selection: TavernModelSelection;
  change: (selection: TavernModelSelection) => void;
}
const ModelSelectionContext = createContext<ModelSelectionState | null>(null);

export function ModelSelectionProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  const [selection, setSelection] = useState(() => readModelSelection(accountId));
  const customSelection = useRef(readModelSelection(accountId, 'custom'));
  function change(next: TavernModelSelection) {
    if (next.provider === 'custom') {
      if (next.apiKey) customSelection.current = next;
      else if (selection.provider === 'platform') next = { ...customSelection.current, historyBytes: next.historyBytes };
    } else if (selection.provider === 'custom' && !next.model) {
      next = { ...readModelSelection(accountId, 'platform'), historyBytes: next.historyBytes };
    }
    saveModelSelection(accountId, next);
    setSelection(next);
  }
  return <ModelSelectionContext.Provider value={{ selection, change }}>{children}</ModelSelectionContext.Provider>;
}

export function useSharedModelSelection() { return useContext(ModelSelectionContext); }
