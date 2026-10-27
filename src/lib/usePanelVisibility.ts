import { useCallback, useEffect, useState, type SetStateAction } from 'react';

function readVisibility(storageKey: string | undefined, fallback: boolean): boolean {
  if (storageKey) try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'true' || saved === 'false') return saved === 'true';
  } catch { /* UI preferences are optional; content is stored separately. */ }
  return fallback;
}

/** Only an explicit setter persists a choice; loading content never creates one. */
export function usePanelVisibility(storageKey?: string, initiallyOpen = false) {
  const [choice, setChoice] = useState(() => ({ storageKey, open: readVisibility(storageKey, initiallyOpen) }));
  useEffect(() => {
    setChoice(previous => previous.storageKey === storageKey ? previous : { storageKey, open: readVisibility(storageKey, initiallyOpen) });
  }, [storageKey, initiallyOpen]);
  // Scope changes must never render the preceding account or conversation's choice.
  const open = choice.storageKey === storageKey ? choice.open : readVisibility(storageKey, initiallyOpen);
  const setOpen = useCallback((next: SetStateAction<boolean>) => {
    setChoice(previous => {
      const current = previous.storageKey === storageKey ? previous.open : readVisibility(storageKey, initiallyOpen);
      const open = typeof next === 'function' ? next(current) : next;
      if (storageKey) try { localStorage.setItem(storageKey, String(open)); }
      catch { /* Keep the choice in memory when browser storage is unavailable. */ }
      return { storageKey, open };
    });
  }, [storageKey, initiallyOpen]);
  return [open, setOpen] as const;
}
