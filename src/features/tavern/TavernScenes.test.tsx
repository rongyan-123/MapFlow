import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IdentityProvider } from '../identity/IdentityContext';
import TavernPage from './TavernPage';
import { character, conversation, detail } from './testFixtures';
import type { ConversationDetail } from '../../domains/conversations/types';

vi.mock('../../api/identityClient', async original => ({
  ...await original<typeof import('../../api/identityClient')>(),
  fetchCurrentSession: async () => ({ account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' }),
  fetchCapabilities: async () => ({ identity: { registrationEnabled: true }, generation: { enabled: false } }),
}));
vi.mock('./ConversationPane', () => ({ default: ({ detail }: { detail: ConversationDetail }) => <p>{detail.conversation.title}</p> }));

let requests: { url: string; method: string; body?: unknown }[];
let archived: boolean;
let independentListPending: boolean;
const areaConversation = { ...conversation, scene: 'learning' as const, learningAreaId: 'entry-1', libraryEntryId: 'entry-1', treeToolsEnabled: true };
const areaDetail = { ...detail, conversation: areaConversation };
const freshDetail = { ...detail, conversation: { ...areaConversation, conversationId: 'fresh', title: '新学习会话' } };
const managerConversation = { ...conversation, scene: 'management' as const, learningAreaId: null, libraryEntryId: null, treeToolsEnabled: false, title: '管理学习地图' };
const managerDetail = { ...detail, conversation: managerConversation };
const json = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => {
  requests = []; archived = false; independentListPending = false; localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? 'GET', ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}) });
    if (url === '/api/me/tavern/characters') return json({ characters: [character] });
    if (url === '/api/credit/me') return json({ balance: 1, signedInToday: true, freeRemaining: 0, pricePerTree: 1 });
    if (url === '/api/me/tavern/conversations') return independentListPending ? new Promise<Response>(() => {}) : json({ conversations: [] });
    if (url === '/api/me/tavern/conversations?scene=management') return json({ conversations: [managerConversation] });
    if (url === '/api/me/tavern/management-conversations') return json({ ...managerDetail, conversation: { ...managerConversation, conversationId: 'manager-new', title: '新管理会话' } });
    if (url === '/api/me/tavern/conversations/manager-new') return json({ ...managerDetail, conversation: { ...managerConversation, conversationId: 'manager-new', title: '新管理会话' } });
    if (url === '/api/me/learning-areas/entry-1/conversations') return json(init?.method === 'POST'
      ? freshDetail : { conversations: [{ ...areaConversation, libraryEntryId: archived ? null : 'entry-1' }] });
    if (url === '/api/me/tavern/tree-conversations/entry-1') return json(areaDetail);
    if (url === '/api/me/tavern/conversations/conversation-1') return json(localStorage.getItem('mapflow.tavern.selection.v1.player-1.management') ? managerDetail
      : { ...areaDetail, conversation: { ...areaConversation, libraryEntryId: archived ? null : 'entry-1' } });
    if (url === '/api/me/tavern/conversations/fresh') return json(freshDetail);
    throw new Error(`Unexpected endpoint ${url}`);
  }));
});

it('restores management history separately and creates another management conversation without binding a map', async () => {
  localStorage.setItem('mapflow.tavern.selection.v1.player-1.management', 'conversation-1');
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <IdentityProvider><TavernPage management onNavigateConsole={() => {}} /></IdentityProvider>
  </QueryClientProvider>);
  await within(await screen.findByRole('region',{name:'角色对话'})).findByText('管理学习地图');
  expect(requests.some(item => item.url === '/api/me/tavern/conversations?scene=management')).toBe(true);
  expect(requests.some(item => item.url === '/api/me/tavern/conversations')).toBe(false);
  await userEvent.setup().click(screen.getByRole('button', { name: '新建会话' }));
  await within(screen.getByRole('region',{name:'角色对话'})).findByText('新管理会话');
  expect(requests.filter(item => item.method === 'POST')).toEqual([
    expect.objectContaining({ url: '/api/me/tavern/management-conversations', body: expect.objectContaining({ newConversation: true, clientRequestId: expect.any(String) }) }),
  ]);
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBeNull();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderChat(learning = true, client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) {
  return render(<QueryClientProvider client={client}>
    <IdentityProvider><TavernPage onNavigateConsole={() => {}} {...(learning ? { treeContext: { libraryEntryId: 'entry-1', title: 'Python', available: !archived } } : {})} /></IdentityProvider>
  </QueryClientProvider>);
}

it('reads the current area history and creates a learning conversation atomically', async () => {
  renderChat();
  await within(await screen.findByRole('region',{name:'角色对话'})).findByText(conversation.title);
  expect(requests.some(item => item.url === '/api/me/learning-areas/entry-1/conversations' && item.method === 'GET')).toBe(true);
  expect(requests.some(item => item.url === '/api/me/tavern/conversations')).toBe(false);
  await userEvent.setup().click(screen.getByRole('button', { name: '新建会话' }));
  await within(screen.getByRole('region',{name:'角色对话'})).findByText('新学习会话');
  expect(requests.filter(item => item.method === 'POST' && item.url.endsWith('/conversations'))).toEqual([
    expect.objectContaining({ url: '/api/me/learning-areas/entry-1/conversations', body: expect.objectContaining({ characterId: character.characterId }) }),
  ]);
  expect(requests.some(item => item.url.endsWith('/tree-connection'))).toBe(false);
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBeNull();
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1.tree.entry-1')).toBe('fresh');
});

it.each([false, true])('does not display cached learning history before the independent list is verified (mixed cache %s)', async mixedCache => {
  independentListPending = true;
  localStorage.setItem('mapflow.tavern.selection.v1.player-1', 'conversation-1');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['me', 'player-1', 'tavern', 'conversation', 'conversation-1'], areaDetail);
  if (mixedCache) client.setQueryData(['me', 'player-1', 'tavern', 'conversations'], [areaConversation]);
  renderChat(false, client);
  await screen.findByRole('button', { name: '配置' });
  expect(screen.queryByText(conversation.title)).not.toBeInTheDocument();
  expect(requests.some(item => item.url === '/api/me/tavern/conversations/conversation-1')).toBe(false);
});

it('opens archived area history without opening or creating a map conversation', async () => {
  archived = true;
  renderChat();
  await within(await screen.findByRole('region',{name:'角色对话'})).findByText(conversation.title);
  expect(screen.queryByRole('button', { name: '新建会话' })).not.toBeInTheDocument();
  expect(requests.some(item => item.method === 'POST')).toBe(false);
});

it('does not fetch an independent remembered conversation outside its scene history', async () => {
  localStorage.setItem('mapflow.tavern.selection.v1.player-1', 'conversation-1');
  renderChat(false);
  await screen.findByText(/与.*相遇/);
  await waitFor(() => expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBeNull());
  expect(requests.some(item => item.url === '/api/me/tavern/conversations/conversation-1')).toBe(false);
});
