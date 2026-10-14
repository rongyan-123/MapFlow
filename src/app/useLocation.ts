import { useCallback, useEffect, useState } from 'react';
import { resolveRoute, type LegacyView } from './routes';

export type Navigate = (address: string, replace?: boolean) => void;

export function useLocation(legacyView?: LegacyView) {
  const [address, setAddress] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const update = () => setAddress(window.location.pathname + window.location.search);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate: Navigate = useCallback((destination, replace = false) => {
    const url = new URL(destination, window.location.origin);
    if (url.origin !== window.location.origin) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
    setAddress(url.pathname + url.search);
  }, []);
  return { route: resolveRoute(address, legacyView), navigate };
}
