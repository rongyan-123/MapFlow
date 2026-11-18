import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import LearningPage from './LearningPage';

vi.mock('./SceneWorkspace', () => ({ default: ({ panelTabs, panelContentActive, panelContent }: { panelTabs: ReactNode; panelContentActive: boolean; panelContent: ReactNode }) => <>{panelTabs}{panelContentActive && panelContent}</> }));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('shows a retry when map loading fails in the notes panel instead of an endless loading message', async () => {
  vi.stubGlobal('fetch', async (path: string) => {
    if (path === '/api/me/learning-areas') return Response.json({ areas: [{ areaId: 'entry', libraryEntryId: 'entry', title: '我的地图', available: true, createdAt: '2026-11-18T00:00:00Z' }] });
    if (path === '/api/me/tree-library') return Response.json({ entries: [{ library_entry_id: 'entry', tree: { id: 'tree', topic: 'Python', title: '我的地图', description: null, difficulty_level: 'beginner', total_nodes: 1 }, completed_nodes: 0 }] });
    return Response.json({}, { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'owner', username: '用户' }, csrfToken: 'csrf' });
  render(<QueryClientProvider client={client}><IdentityProvider><LearningPage navigate={vi.fn()} areaId="entry" /></IdentityProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: '笔记' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: '重试读取地图' })).toBeVisible();
  expect(screen.queryByText('正在读取地图资料…')).not.toBeInTheDocument();
});
