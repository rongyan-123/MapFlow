import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character, conversation, detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';

// Keep our actual canvas UI and persistence; only replace the third-party drawing engine.
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div aria-label="绘图编辑器" />,
  restoreElements: (elements: unknown[]) => elements,
  convertToExcalidrawElements: (elements: unknown[]) => elements,
}));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const areaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function mount(scene: 'learning' | 'tavern' = 'learning', enabled = false, readOnly = false, beforeSave?: () => Promise<void>, beforeRead?: () => Promise<void>) {
  const requests: Array<{ path: string; options?: RequestInit }> = [];
  const story = { ...conversation, conversationId: storyId, scene, libraryEntryId: scene === 'learning' ? areaId : null, learningAreaId: scene === 'learning' ? areaId : null };
  let canvas = { revision: 0, enabled, elements: [] };
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    requests.push({ path, options });
    if (path === '/api/me/agent-models') return new Response(JSON.stringify({ cash: [], defaultCash: null, points: null }));
    if (path.endsWith('/characters')) return new Response(JSON.stringify({ characters: [character] }));
    if (path.endsWith('/executions')) return new Response(JSON.stringify({ execution: null }));
    if (path.endsWith('/canvas')) {
      if (!options?.method) await beforeRead?.();
      if (options?.method === 'PATCH') {
        await beforeSave?.();
        const input = JSON.parse(String(options.body));
        canvas = { ...canvas, revision: canvas.revision + 1, enabled: input.enabled };
      }
      return new Response(JSON.stringify(canvas));
    }
    if (path.endsWith('/' + storyId)) return new Response(JSON.stringify({ ...detail, conversation: story, canvas }));
    if (path.endsWith('/conversations')) return new Response(JSON.stringify({ conversations: [story], bootstrapState: 'has_active' }));
    return new Response('{}', { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  const element = <QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId="player-1"><ModelSelectionProvider accountId="player-1"><SceneWorkspace owner={{ accountId: 'player-1', csrfToken: 'csrf', userName: '小明', scene, ...(scene === 'learning' ? { areaId, available: !readOnly } : {}) }} navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>;
  const view = render(element);
  return { ...view, element, requests };
}

it('opens a learning canvas and persists enabled AI drawing on entry', async () => {
  const { requests } = mount();
  const permission = await screen.findByRole('checkbox', { name: '允许 AI 绘图' });
  await waitFor(() => expect(permission).toBeChecked());
  expect(requests.filter(request => request.options?.method === 'PATCH').map(request => JSON.parse(String(request.options?.body))))
    .toEqual([{ expectedRevision: 0, enabled: true }]);
  expect(screen.getByRole('textbox', { name: '消息' })).toBeEnabled();
});

it('keeps a mobile learning canvas closed while enabling drawing, and toggles it without losing the chat draft', async () => {
  vi.stubGlobal('innerWidth', 390);
  const { requests } = mount();
  await screen.findByText('请用茶。');
  await waitFor(() => expect(requests.some(request => request.options?.method === 'PATCH')).toBe(true));
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '还没发出去的问题' } });
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  await screen.findByRole('region', { name: '教学画布' });
  expect(screen.getByRole('checkbox', { name: '允许 AI 绘图' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('还没发出去的问题');
});

it('preserves the chosen closed state when the viewport changes between phone and desktop', async () => {
  vi.stubGlobal('innerWidth', 390);
  mount('learning', true);
  await screen.findByText('请用茶。');
  const toggle=screen.getByRole('button',{name:'教学画布'});
  fireEvent.click(toggle);
  await screen.findByRole('region',{name:'教学画布'});
  fireEvent.click(toggle);
  vi.stubGlobal('innerWidth', 1440);
  fireEvent(window,new Event('resize'));
  expect(screen.queryByRole('region',{name:'教学画布'})).not.toBeInTheDocument();
  expect(toggle).toHaveAttribute('aria-expanded','false');
});

it('honors closing the canvas and revoking drawing until the learning page is entered again', async () => {
  const view = mount();
  const permission = await screen.findByRole('checkbox', { name: '允许 AI 绘图' });
  await waitFor(() => expect(permission).toBeChecked());
  fireEvent.click(permission);
  await waitFor(() => expect(permission).not.toBeChecked());
  fireEvent.click(screen.getByRole('button', { name: '收起画布' }));
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '先聊几句' } });
  await act(async () => {});
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
  expect(view.requests.filter(request => request.options?.method === 'PATCH')).toHaveLength(2);
  view.unmount();
  render(view.element);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '允许 AI 绘图' })).toBeChecked());
  expect(view.requests.filter(request => request.options?.method === 'PATCH')).toHaveLength(3);
});

it('keeps a tavern canvas closed even when AI drawing was previously enabled, and can open it manually', async () => {
  const { requests } = mount('tavern', true);
  await screen.findByText('请用茶。');
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  expect(await screen.findByRole('checkbox', { name: '允许 AI 绘图' })).toBeChecked();
  expect(requests.filter(request => request.options?.method === 'PATCH')).toHaveLength(0);
});

it('does not enable drawing or save a read-only learning history', async () => {
  const { requests } = mount('learning', false, true);
  await screen.findByText('请用茶。');
  expect(requests.filter(request => request.options?.method === 'PATCH')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  const permission = await screen.findByRole('checkbox', { name: '允许 AI 绘图' });
  expect(permission).not.toBeChecked();
  expect(permission).toBeDisabled();
});

it('waits for the default drawing permission to be persisted before a learning message can be sent', async () => {
  let finishSave!: () => void;
  const pendingSave = new Promise<void>(resolve => { finishSave = resolve; });
  const { requests } = mount('learning', false, false, () => pendingSave);
  await waitFor(() => expect(requests.some(request => request.options?.method === 'PATCH')).toBe(true));
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '用图介绍这张地图' } });
  const blockedWhileSaving = (screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled;
  await act(async () => finishSave());
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '允许 AI 绘图' })).toBeChecked());
  expect(blockedWhileSaving).toBe(true);
  expect(screen.getByRole('button', { name: '发送' })).toBeEnabled();
});

it('does not reopen a canvas the user closed while its initial document was still loading', async () => {
  let finishRead!: () => void;
  const pendingRead = new Promise<void>(resolve => { finishRead = resolve; });
  const { requests } = mount('learning', false, false, undefined, () => pendingRead);
  await screen.findByText('请用茶。');
  await waitFor(() => expect(requests.some(request => request.path.endsWith('/canvas'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  await act(async () => finishRead());
  await waitFor(() => expect(requests.some(request => request.options?.method === 'PATCH')).toBe(true));
  expect(screen.queryByRole('region', { name: '教学画布' })).not.toBeInTheDocument();
});
