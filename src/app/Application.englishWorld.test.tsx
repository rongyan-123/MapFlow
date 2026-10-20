import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { ewIds, ewWorldList } from '../domains/englishWorld/testFixtures';
import Application from './Application';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); });
function open(address: string, authenticated: boolean) {
  window.history.replaceState({}, '', address);
  const requests: string[] = [];
  const model = { profileId: ewIds.version, profileVersion: 1, modelId: 'real-model', displayName: '真实目录', contextWindow: 128000, maxOutputTokens: 8000 };
  vi.stubGlobal('fetch', async (path: string) => {
    requests.push(String(path));
    if (path === '/api/me/agent-models') return Response.json({ cash: [model], defaultCash: model, points: null });
    if (path === '/api/me/english-world/worlds') return Response.json(ewWorldList);
    if (path === '/api/auth/me') return Response.json({ account: null }, { status: 401 });
    return Response.json({}, { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, authenticated ? { account: { playerId: 'a', username: '玩家', status: 'active', isAdmin: false }, csrfToken: 'csrf' } : null);
  render(<QueryClientProvider client={client}><IdentityProvider><Application /></IdentityProvider></QueryClientProvider>);
  return requests;
}
it('keeps the English World deep link behind the existing login boundary', () => {
  const requests = open(`/english-world/play/${ewIds.play}?branch=${ewIds.branch}`, false);
  expect(screen.getByRole('textbox', { name: '用户名' })).toBeVisible();
  expect(requests.some(path => path.includes('/english-world'))).toBe(false);
});
it('mounts the independent page under the shared frame and marks its navigation active', async () => {
  vi.stubEnv('VITE_ENGLISH_WORLD_ENABLED', 'true');
  open('/english-world', true);
  await screen.findByRole('heading', { name: '博物馆之夜' }, { timeout: 5000 });
  const navigation = within(screen.getByRole('navigation', { name: '业务导航' }));
  expect(navigation.getByRole('link', { name: '英语世界' })).toHaveAttribute('aria-current', 'page');
});
it('keeps the withdrawn feature unavailable by default without fetching its data', async () => {
  vi.stubEnv('VITE_ENGLISH_WORLD_ENABLED', 'false');
  const requests = open('/english-world', true);
  await screen.findByRole('heading', { name: '英语世界暂未开放' });
  expect(screen.queryByRole('link', { name: '英语世界' })).not.toBeInTheDocument();
  expect(requests.some(path => path.includes('/english-world'))).toBe(false);
});
