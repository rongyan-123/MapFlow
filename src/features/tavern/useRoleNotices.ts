import { useEffect, useState } from 'react';

export default function useRoleNotices(accountId: string) {
  const storageKey = `mapflow.roles.unread.v1.${accountId}`;
  const [unread, setUnread] = useState<string[]>(() => readUnread(storageKey));
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === storageKey) setUnread(readUnread(storageKey)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);
  const save = (ids: string[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); }
    catch { /* The shared server role library works without optional browser notices. */ }
    setUnread(ids);
  };
  return { count: unread.length, added: (id: string) => save([...new Set([...readUnread(storageKey), ...unread, id])]), clear: () => save([]) };
}

function readUnread(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length <= 128))] : [];
  } catch { return []; }
}
