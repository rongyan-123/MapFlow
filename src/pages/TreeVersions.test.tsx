import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import LibraryPage from './LibraryPage';
import MapsPage from './MapsPage';

const legacy = { id: 'old', title: '原来的地图', topic: '测试', description: null, difficulty_level: 'beginner', total_nodes: 4 };
afterEach(() => vi.unstubAllGlobals());
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'user', username: '学习者', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  return render(<QueryClientProvider client={client}><IdentityProvider>{element}</IdentityProvider></QueryClientProvider>);
}
function json(value: unknown) { return new Response(JSON.stringify(value)); }

it('opens an empty new public collection and switches to old maps without using its cursor', async () => {
  const requests: URL[] = [];
  vi.stubGlobal('fetch', async (path: string) => {
    const url = new URL(path, 'https://mapflow.test'); requests.push(url);
    return json(url.searchParams.get('version') === '2' ? { trees: [], next_cursor: null } : { trees: [legacy], next_cursor: 'v1.page2' });
  });
  const navigate = vi.fn(); mount(<LibraryPage navigate={navigate} />);
  expect(await screen.findByText('新版本书库还没有地图。')).toBeVisible();
  expect(screen.getByRole('tab', { name: '新版本树（高质量）' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('tab', { name: '旧版本树（低质量）' }));
  expect(await screen.findByRole('heading', { name: legacy.title })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '加载更多地图' }));
  await waitFor(() => expect(requests.some(url => url.searchParams.get('cursor') === 'v1.page2')).toBe(true));
  fireEvent.click(screen.getByRole('tab', { name: '新版本树（高质量）' }));
  expect(await screen.findByText('新版本书库还没有地图。')).toBeVisible();
  expect(requests.filter(url => url.searchParams.get('version') === '2').every(url => !url.searchParams.has('cursor'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '查看旧版本树' }));
  fireEvent.click(await screen.findByRole('button', { name: `查看地图 ${legacy.title}` }));
  expect(navigate).toHaveBeenCalledWith('/library?tree=old');
});

it('keeps old personal maps and their progress in the old collection', async () => {
  vi.stubGlobal('fetch', async () => json({ entries: [{ library_entry_id: 'entry-old', tree: legacy, completed_nodes: 1, progress_percent: 35 }] }));
  const navigate = vi.fn(); mount(<MapsPage navigate={navigate} />);
  expect(await screen.findByText('你还没有新版本地图。')).toBeVisible();
  expect(screen.queryByRole('heading', { name: legacy.title })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '旧版本树（低质量）' }));
  expect(await screen.findByRole('heading', { name: legacy.title })).toBeVisible();
  expect(screen.getByText('35%')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: `查看地图 ${legacy.title}` }));
  expect(navigate).toHaveBeenCalledWith('/maps?entry=entry-old');
});
