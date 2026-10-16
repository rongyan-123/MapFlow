import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import type { Character, Conversation, ConversationDetail } from '../domains/conversations/types';
import { character, conversation, detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const agentA: Character = { ...character, characterId: '11111111-1111-4111-8111-111111111111', card: { ...character.card, name: '观星向导' } };
const agentB: Character = { ...character, characterId: '22222222-2222-4222-8222-222222222222', card: { ...character.card, name: '故事旅行家', firstMessage: '旅行从这里开始。' } };
const storyA: Conversation = { ...conversation, conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', characterId: agentA.characterId, title: '观星的第一段', scene: 'tavern', libraryEntryId: null, learningAreaId: null, persona: '观星专属身份', vocabulary: [{ term: '观星专属词' }] };
const storyB: Conversation = { ...conversation, conversationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', characterId: agentB.characterId, title: '旅行的第一段', scene: 'tavern', libraryEntryId: null, learningAreaId: null, persona: '旅行专属身份', vocabulary: [{ term: '旅行专属词' }] };

function savedDetail(story: Conversation, agent: Character): ConversationDetail {
  return { ...detail, conversation: story, character: agent, graph: { ...detail.graph, messages: detail.graph.messages.map(message => ({ ...message, characterId: message.role === 'assistant' ? agent.characterId : null, ...(message.messageId === 'message-assistant-1' ? { content: `${agent.card.name}的独立记录` } : {}) })) } };
}

function mountTavern(stories: Conversation[] = [storyA], creationControls: { beforeCreation?: () => Promise<Response | void>; characters?: Character[] } = {}) {
  const requests: Array<{ path: string; options?: RequestInit }> = [];
  const agents = creationControls.characters ?? [agentA, agentB];
  const records = new Map(stories.map(story => [story.conversationId, savedDetail(story, [...agents, agentA, agentB].find(agent => agent.characterId === story.characterId)!)]));
  const profile = { profileId: '33333333-3333-4333-8333-333333333333', profileVersion: 1, modelId: 'live-model', displayName: '真实模型', contextWindow: 128000, maxOutputTokens: 8000 };
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    requests.push({ path, options });
    if (path === '/api/me/agent-models') return new Response(JSON.stringify({ cash: [profile], defaultCash: profile, points: null }));
    if (path.endsWith('/characters') && options?.method === 'POST') {
      const card = JSON.parse(String((options.body as FormData).get('normalized_card')));
      const created = { ...character, characterId: '33333333-3333-4333-8333-333333333333', card };
      agents.push(created);
      return new Response(JSON.stringify(created));
    }
    if (path.endsWith('/characters')) return new Response(JSON.stringify({ characters: agents }));
    if (path.endsWith('/executions')) return new Response(JSON.stringify({ execution: null }));
    if (path === '/api/me/tavern/conversations' && options?.method === 'POST') {
      const intercepted = await creationControls.beforeCreation?.();
      if (intercepted) return intercepted;
      const input = JSON.parse(String(options.body));
      const agent = agents.find(item => item.characterId === input.characterId)!;
      const created: Conversation = { ...conversation, ...input, conversationId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${records.size}`, title: `${agent.card.name}的新对话`, scene: 'tavern', libraryEntryId: null, learningAreaId: null, persona: input.persona ?? null, vocabulary: input.vocabulary ?? null, openingMessage: agent.card.firstMessage };
      const saved = savedDetail(created, agent);
      records.set(created.conversationId, { ...saved, turns: [], generations: [], graph: { ...saved.graph, activePath: ['message-opening'], messages: [{ ...saved.graph.messages[0], content: created.openingMessage }], branches: [{ ...saved.graph.branches[0], leafMessageId: 'message-opening' }] } });
      return new Response(JSON.stringify(created));
    }
    if (path === '/api/me/tavern/conversations') return new Response(JSON.stringify({ conversations: [...records.values()].map(item => item.conversation), bootstrapState: records.size ? 'has_active' : 'cleared' }));
    const saved = records.get(path.split('/').pop()!);
    if (saved) return new Response(JSON.stringify(saved));
    return new Response('{}', { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  render(<QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId="player-1"><ModelSelectionProvider accountId="player-1"><SceneWorkspace owner={{ accountId: 'player-1', csrfToken: 'csrf', userName: '小明', scene: 'tavern' }} navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>);
  return { requests, agents, records, client };
}

it('lists every library agent even when it has never had a conversation', async () => {
  mountTavern();
  await screen.findByText('观星向导的独立记录');
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  expect(within(selector).getByRole('option', { name: agentB.card.name })).toHaveValue(agentB.characterId);
});

it('opens the selected agent conversation without changing the previous conversation role', async () => {
  const { requests } = mountTavern([storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  expect(screen.queryByText('观星向导的独立记录')).not.toBeInTheDocument();
  expect(within(screen.getByRole('complementary')).queryByRole('button', { name: /观星的第一段/ })).not.toBeInTheDocument();
  expect(requests.filter(request => request.options?.method && request.options.method !== 'GET')).toEqual([]);
});

it('creates a first conversation for a new agent without copying the previous agent profile or messages', async () => {
  const { requests } = mountTavern();
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText(agentB.card.firstMessage);
  expect(screen.queryByText('观星向导的独立记录')).not.toBeInTheDocument();
  const writes = requests.filter(request => request.options?.method && request.options.method !== 'GET');
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe('/api/me/tavern/conversations');
  expect(JSON.parse(String(writes[0].options?.body))).toEqual({ characterId: agentB.characterId, userName: '小明', greetingIndex: 0 });
});

it('returns to each agent last selected conversation when that agent has several conversations', async () => {
  const earlier = { ...storyA, conversationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: '观星更早的一段' };
  mountTavern([storyA, earlier, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^观星更早的一段/ }));
  await waitFor(() => expect(within(screen.getByRole('complementary')).getByRole('button', { name: /^观星更早的一段/ })).toHaveAttribute('aria-current', 'true'));
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('观星向导的独立记录');
  expect(within(screen.getByRole('complementary')).getByRole('button', { name: /^观星更早的一段/ })).toHaveAttribute('aria-current', 'true');
});

it('keeps unsent drafts with their own conversation when switching between agents', async () => {
  mountTavern([storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '只给观星向导的草稿' } });
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '只给旅行家的草稿' } });
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('观星向导的独立记录');
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('只给观星向导的草稿');
});

it('remembers an existing saved conversation from before agent-specific navigation was available', async () => {
  const latest = { ...storyA, conversationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: '观星较新的另一段' };
  localStorage.setItem('mapflow.tavern.selection.v1.player-1', storyA.conversationId);
  mountTavern([latest, storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('观星向导的独立记录');
  expect(within(screen.getByRole('complementary')).getByRole('button', { name: /^观星的第一段/ })).toHaveAttribute('aria-current', 'true');
});

it('lets a phone user switch agents directly from the chat header', async () => {
  vi.stubGlobal('innerWidth', 390);
  mountTavern([storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  const selector = screen.getByRole('combobox', { name: '切换智能体' });
  expect(within(selector).getByRole('option', { name: agentB.card.name })).toHaveValue(agentB.characterId);
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  expect(screen.getByRole('combobox', { name: '切换智能体' })).toHaveValue(agentB.characterId);
});

it('makes a newly created character immediately available without returning to the library to use it', async () => {
  const { requests } = mountTavern();
  await screen.findByText('观星向导的独立记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
  fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
  fireEvent.change(screen.getByRole('textbox', { name: '角色名称' }), { target: { value: '围棋伙伴' } });
  fireEvent.change(screen.getByRole('textbox', { name: '角色设定（提示词）' }), { target: { value: '陪我复盘围棋。' } });
  fireEvent.change(screen.getByRole('textbox', { name: '开场白（可选）' }), { target: { value: '今天下哪一手？' } });
  fireEvent.click(screen.getByRole('button', { name: '保存角色卡' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  const added = within(selector).getByRole('option', { name: '围棋伙伴' });
  expect(screen.getByText('观星向导的独立记录')).toBeVisible();
  expect(requests.filter(request => request.options?.method === 'POST' && request.path.endsWith('/conversations'))).toHaveLength(0);
  fireEvent.change(selector, { target: { value: added.getAttribute('value') } });
  await screen.findByText('今天下哪一手？');
});

it('creates additional conversations only for the currently selected agent', async () => {
  const { requests } = mountTavern([storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '开始新对话' }));
  await screen.findByText(agentB.card.firstMessage);
  const created = requests.find(request => request.options?.method === 'POST' && request.path.endsWith('/conversations'))!;
  expect(JSON.parse(String(created.options?.body))).toMatchObject({ characterId: agentB.characterId, persona: '旅行专属身份', vocabulary: [{ term: '旅行专属词' }] });
  expect(screen.queryByText('观星向导的独立记录')).not.toBeInTheDocument();
  expect(screen.queryByText('故事旅行家的独立记录')).not.toBeInTheDocument();
});

it('locks the previous composer while opening a first agent conversation and does not create twice', async () => {
  let finishCreation: () => void = () => {};
  const pending = new Promise<void>(resolve => { finishCreation = resolve; });
  const { requests } = mountTavern([storyA], { beforeCreation: () => pending });
  await screen.findByText('观星向导的独立记录');
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  expect(selector).toBeDisabled();
  const composerDisabled = (screen.getByRole('textbox', { name: '消息' }) as HTMLTextAreaElement).disabled;
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  expect(requests.filter(request => request.options?.method === 'POST' && request.path.endsWith('/conversations'))).toHaveLength(1);
  await act(async () => finishCreation());
  await screen.findByText(agentB.card.firstMessage);
  expect(composerDisabled).toBe(true);
});

it('keeps a failed first conversation selection in the role library and allows an explicit retry', async () => {
  let fail = true;
  mountTavern([storyA], { beforeCreation: async () => fail ? new Response('{}', { status: 503 }) : undefined });
  await screen.findByText('观星向导的独立记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
  const library = screen.getByRole('dialog', { name: '角色库' });
  const agent = within(library).getByRole('heading', { name: agentB.card.name }).closest('article')!;
  fireEvent.click(within(agent).getByRole('button', { name: '使用角色' }));
  await waitFor(() => expect(within(library).getByRole('alert')).toBeVisible());
  expect(screen.getByText('观星向导的独立记录')).toBeInTheDocument();
  fail = false;
  fireEvent.click(within(agent).getByRole('button', { name: '使用角色' }));
  await screen.findByText(agentB.card.firstMessage);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('makes an imported card selectable after closing the library without using its use-role button', async () => {
  mountTavern();
  await screen.findByText('观星向导的独立记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
  fireEvent.click(screen.getByRole('button', { name: '导入角色卡' }));
  const file = new File([JSON.stringify({ name: '航海伙伴', description: '一起探索海洋。', first_mes: '船已起航。' })], 'sailor.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('选择角色卡'), { target: { files: [file] } });
  fireEvent.click(await screen.findByRole('button', { name: '确认导入' }));
  await screen.findByRole('dialog', { name: '角色库' });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  const imported = within(selector).getByRole('option', { name: '航海伙伴' });
  fireEvent.change(selector, { target: { value: imported.getAttribute('value') } });
  await screen.findByText('船已起航。');
});

it('uses the same complete agent list in the phone history drawer and closes it after selection', async () => {
  vi.stubGlobal('innerWidth', 390);
  mountTavern([storyA, storyB]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.click(screen.getByRole('button', { name: '会话历史' }));
  const drawer = screen.getByRole('dialog', { name: '会话历史' });
  fireEvent.change(within(drawer).getByRole('combobox', { name: '当前智能体' }), { target: { value: agentB.characterId } });
  await screen.findByText('故事旅行家的独立记录');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not open another scene conversation when that scene used the same character', async () => {
  const globalStory = { ...storyB, scene: 'management' as const };
  const { requests } = mountTavern([storyA, globalStory]);
  await screen.findByText('观星向导的独立记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText(agentB.card.firstMessage);
  expect(requests.some(request => request.path.endsWith('/' + globalStory.conversationId))).toBe(false);
  expect(requests.filter(request => request.options?.method === 'POST' && request.path === '/api/me/tavern/conversations')).toHaveLength(1);
});

it('opens the first explicitly selected agent with an empty draft after all conversations were cleared', async () => {
  const { requests } = mountTavern([]);
  const selector = await screen.findByRole('combobox', { name: '当前智能体' });
  await waitFor(() => expect(selector).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '还未选定角色的草稿' } });
  expect(requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  await screen.findByText(agentB.card.firstMessage);
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
});

it('can open an unused available agent from a historical conversation whose character was deleted', async () => {
  mountTavern([storyA], { characters: [agentB] });
  await screen.findByText('观星向导的独立记录');
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  await screen.findByText(agentB.card.firstMessage);
});

it('asks for an agent instead of silently creating a conversation for the first library card', async () => {
  const { requests } = mountTavern([]);
  await waitFor(() => expect(screen.getByRole('combobox', { name: '当前智能体' })).toBeEnabled());
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '开始新对话' }));
  const library = await screen.findByRole('dialog', { name: '角色库' });
  expect(within(library).queryByRole('button', { name: '当前角色' })).not.toBeInTheDocument();
  expect(requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
});
