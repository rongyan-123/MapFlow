import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IdentityProvider } from '../identity/IdentityContext';
import TavernPage from './TavernPage';
import { conversationRun } from '../../domains/conversations/legacyRun';
import { character, conversation, detail } from '../../test/conversations';
import type { Conversation, ConversationDetail, ConversationScene } from '../../domains/conversations/types';

vi.mock('../../api/identityClient', async original => ({
  ...await original<typeof import('../../api/identityClient')>(),
  fetchCurrentSession: async () => ({ account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' }),
  fetchCapabilities: async () => ({ identity: { registrationEnabled: true }, generation: { enabled: false } }),
}));
vi.mock('./ConversationPane', () => ({ default: ({ detail }: { detail: ConversationDetail }) => <>
  <p aria-label="当前会话名称">{detail.conversation.title}</p><textarea aria-label="消息" defaultValue="" />
</> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let histories: Conversation[];
let bootstrapState: 'never_created' | 'has_active' | 'cleared';
let deletionFails: boolean;
let replayDeleted: boolean;
let defaultOpeningCleared: boolean;
let scene: ConversationScene;
let requests: { url: string; method: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  scene = 'tavern'; bootstrapState = 'has_active'; deletionFails = false; replayDeleted = false; defaultOpeningCleared = false; requests = [];
  histories = [{ ...conversation }, { ...conversation, conversationId: 'conversation-2', title: '第二段对话' }];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body });
    if (url === '/api/me/tavern/characters') return json({ characters: [character] });
    if (url === '/api/credit/me') return json({ balance: 1, signedInToday: true, freeRemaining: 0, pricePerTree: 1 });
    if (url === '/api/me/tavern/platform-models') return json({ enabled: false, billingMode: 'trial', models: [] });
    const listUrl = scene === 'learning' ? '/api/me/learning-areas/entry-1/conversations'
      : '/api/me/tavern/conversations' + (scene === 'management' ? '?scene=management' : '');
    if (method === 'GET' && url === listUrl) return json({ conversations: histories, bootstrapState });
    if (method === 'DELETE') {
      if (deletionFails) return json({ error: { code: 'tavern.request_failed', message: 'private' } }, 500);
      histories = histories.filter(item => url !== '/api/me/tavern/conversations/' + item.conversationId);
      bootstrapState = histories.length ? 'has_active' : 'cleared';
      return new Response(null, { status: 204 });
    }
    if (method === 'POST' && (url === listUrl || url === '/api/me/tavern/management-conversations' || url === '/api/me/tavern/tree-conversations/entry-1')) {
      if (defaultOpeningCleared && !body?.clientRequestId) {
        bootstrapState = 'cleared';
        return json({ error: { code: 'tavern.history_cleared', message: 'private' } }, 409);
      }
      if (replayDeleted) return json({ error: { code: 'tavern.creation_target_deleted', message: 'private' } }, 410);
      const created = { ...histories[0] ?? conversation, conversationId: 'conversation-new', title: '主动新建的会话',
        scene, learningAreaId: scene === 'learning' ? 'entry-1' : null, libraryEntryId: scene === 'learning' ? 'entry-1' : null };
      histories = [created]; bootstrapState = 'has_active';
      return json(scene === 'tavern' ? created : { ...detail, conversation: created });
    }
    const opened = histories.find(item => url === '/api/me/tavern/conversations/' + item.conversationId);
    if (opened) return json({ ...detail, conversation: opened });
    if (method === 'POST') throw new Error('Unexpected automatic creation: ' + url);
    throw new Error('Unexpected endpoint: ' + url);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(sceneName: ConversationScene = 'tavern', client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  scene = sceneName;
  histories = histories.map(item => ({ ...item, scene, learningAreaId: scene === 'learning' ? 'entry-1' : null,
    libraryEntryId: scene === 'learning' ? 'entry-1' : null }));
  const selectionKey = 'mapflow.tavern.selection.v1.player-1' + (scene === 'management' ? '.management' : scene === 'learning' ? '.tree.entry-1' : '');
  if (histories[0]) localStorage.setItem(selectionKey, histories[0].conversationId);
  return render(<QueryClientProvider client={client}><IdentityProvider><TavernPage onNavigateConsole={() => {}}
    management={scene === 'management'} treeContext={scene === 'learning' ? { libraryEntryId: 'entry-1', title: '学习地图', available: true } : undefined} />
  </IdentityProvider></QueryClientProvider>);
}
async function requestDelete(title: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '删除会话 ' + title }));
  return { user, dialog: screen.getByRole('dialog', { name: '删除会话' }) };
}

it('canceling deletion sends no mutation and retains the selected conversation', async () => {
  mount();
  await screen.findByLabelText('当前会话名称');
  const { user, dialog } = await requestDelete(conversation.title);
  expect(dialog).toHaveTextContent(conversation.title);
  await user.click(within(dialog).getByRole('button', { name: '取消' }));
  expect(requests.filter(request => request.method === 'DELETE')).toEqual([]);
  expect(screen.getByLabelText('当前会话名称')).toHaveTextContent(conversation.title);
});

it('deleting the current conversation selects another and updates remembered selection', async () => {
  mount();
  const { user, dialog } = await requestDelete(conversation.title);
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.getByLabelText('当前会话名称')).toHaveTextContent('第二段对话'));
  expect(screen.queryByRole('button', { name: '打开会话 ' + conversation.title })).not.toBeInTheDocument();
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBe('conversation-2');
});

it('deleting another conversation retains the current input draft', async () => {
  mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('消息'), '保留我的草稿');
  const { dialog } = await requestDelete('第二段对话');
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '打开会话 第二段对话' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('消息')).toHaveValue('保留我的草稿');
});

it('blocks deletion of a background legacy generation until that target really stops', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const background = conversationRun(client, { accountId: 'player-1', scene: 'tavern', areaId: null, conversationId: 'conversation-2' }, () => null);
  background.set({ busy: true });
  mount('tavern', client);
  const { user, dialog } = await requestDelete('第二段对话');
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('生成');
  expect(requests.filter(request => request.method === 'DELETE')).toEqual([]);
  act(() => background.set({ busy: false }));
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '打开会话 第二段对话' })).not.toBeInTheDocument());
  expect(requests.filter(request => request.method === 'DELETE')).toHaveLength(1);
});

it.each(['learning', 'management'] as const)('clearing %s remains empty after remount and permits explicit new creation', async selectedScene => {
  histories = [histories[0]];
  const mounted = mount(selectedScene);
  const { user, dialog } = await requestDelete(conversation.title);
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  await screen.findByText('暂无会话');
  mounted.unmount(); mount(selectedScene);
  await screen.findByText('暂无会话');
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);
  await user.click(screen.getAllByRole('button', { name: '新建会话' }).slice(-1)[0]);
  await waitFor(() => expect(screen.getByLabelText('当前会话名称')).toHaveTextContent('主动新建的会话'));
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(1);
});

it('failed deletion preserves both the history and current draft', async () => {
  deletionFails = true; mount(); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('消息'), '请求失败也要保留');
  const { dialog } = await requestDelete(conversation.title);
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
  expect(await within(dialog).findByRole('alert')).not.toHaveTextContent('private');
  expect(screen.getByLabelText('消息')).toHaveValue('请求失败也要保留');
  expect(screen.getByRole('button', { name: '打开会话 ' + conversation.title })).toBeInTheDocument();
});

it('ignores cached default conversations for a cleared learning area and terminates a deleted creation replay', async () => {
  histories = []; bootstrapState = 'cleared'; replayDeleted = true;
  const key = 'mapflow.tavern.creation.v1.player-1.learning.entry-1';
  const oldRequestId = '55555555-5555-4555-8555-555555555555';
  localStorage.setItem(key, JSON.stringify({ clientRequestId: oldRequestId, characterId: character.characterId, userName: '小明' }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(['me', 'player-1', 'tavern', 'tree-conversation', 'entry-1'],
    { ...detail, conversation: { ...conversation, scene: 'learning', learningAreaId: 'entry-1', libraryEntryId: 'entry-1' } });
  mount('learning', client);
  await screen.findByText('暂无会话');
  expect(screen.queryByLabelText('当前会话名称')).not.toBeInTheDocument();
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('button', { name: '重试新建会话' }).slice(-1)[0]);
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  replayDeleted = false;
  await user.click(screen.getAllByRole('button', { name: '新建会话' }).slice(-1)[0]);
  await screen.findByLabelText('当前会话名称');
  const creations = requests.filter(request => request.method === 'POST');
  expect(creations[0].body?.clientRequestId).toBe(oldRequestId);
  expect(creations[1].body?.clientRequestId).not.toBe(oldRequestId);
});

it.each(['learning', 'management'] as const)('recovers %s when another tab clears history between list and default opening', async selectedScene => {
  histories = []; bootstrapState = 'never_created'; defaultOpeningCleared = true;
  mount(selectedScene);
  await screen.findByText('暂无会话');
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(1);
  expect(requests.filter(request => request.method === 'GET' && request.url.includes('conversations')).length).toBeGreaterThan(1);
  expect(screen.queryByRole('button', { name: '重新加载' })).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('button', { name: '新建会话' }).slice(-1)[0]);
  await screen.findByLabelText('当前会话名称');
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(2);
  expect(requests.filter(request => request.method === 'POST')[1].body?.clientRequestId).toBeTruthy();
});

it('reconciles a mounted learning tab cleared elsewhere and permits explicit creation', async () => {
  histories = [histories[0]];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount('learning', client);
  await screen.findByLabelText('当前会话名称');
  histories = []; bootstrapState = 'cleared';
  await act(() => client.refetchQueries({ queryKey: ['me', 'player-1', 'learning', 'entry-1', 'conversations'], exact: true }));
  await screen.findByText('暂无会话');
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1.tree.entry-1')).toBeNull();
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);
  await userEvent.setup().click(screen.getAllByRole('button', { name: '新建会话' }).slice(-1)[0]);
  await screen.findByLabelText('当前会话名称');
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(1);
});

it.each(['learning', 'management', 'tavern'] as const)('selects remaining %s history when the current conversation is deleted elsewhere', async selectedScene => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount(selectedScene, client);
  await screen.findByLabelText('当前会话名称');
  histories = histories.slice(1);
  const key = selectedScene === 'learning' ? ['me', 'player-1', 'learning', 'entry-1', 'conversations']
    : ['me', 'player-1', selectedScene, 'conversations'];
  await act(() => client.refetchQueries({ queryKey: key, exact: true }));
  await waitFor(() => expect(screen.getByLabelText('当前会话名称')).toHaveTextContent('第二段对话'));
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);
});
