import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import MapsPage from './MapsPage';

afterEach(() => vi.unstubAllGlobals());
it('starts the selected owned map directly and keeps unavailable learning history accessible', async () => {
  const navigate = vi.fn();
  const requests: Array<[string, RequestInit | undefined]> = [];
  vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
    requests.push([path, init]);
    if (path === '/api/me/tree-library') return Response.json({ entries: [{ library_entry_id: 'owned-map', tree: { id: 'tree', title: '真实地图', topic: '学习', description:null, total_nodes: 3, difficulty_level:'beginner', generation_version: 2 }, completed_nodes: 0 }] });
    if (path === '/api/me/learning-areas/owned-map' && init?.method === 'POST') return Response.json({ areaId: 'owned-map', libraryEntryId: 'owned-map', available: true, title: '真实地图', createdAt:'2026-11-18T00:00:00Z' });
    if (path.endsWith('/learning-areas')) return Response.json({ areas: [{ areaId: 'history-area', libraryEntryId: 'history-area', createdAt:'2026-11-18T00:00:00Z', title: '已移除地图的历史', available: false }] });
    return Response.json({}, { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'owner', username: '用户' }, csrfToken: 'csrf' });
  render(<QueryClientProvider client={client}><IdentityProvider><MapsPage navigate={navigate} /></IdentityProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '开始学习' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/learning?area=owned-map'));
  const command = requests.find(([path, init]) => path === '/api/me/learning-areas/owned-map' && init?.method === 'POST');
  expect(command?.[1]?.headers).toMatchObject({'X-CSRF-Token':'csrf'});
  expect(screen.queryByRole('combobox', { name: '选择个人地图' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查看历史' }));
  expect(navigate).toHaveBeenLastCalledWith('/learning?area=history-area');
});
