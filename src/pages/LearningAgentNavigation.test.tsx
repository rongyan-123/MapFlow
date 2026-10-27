import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Character, Conversation, ConversationDetail } from '../domains/conversations/types';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character, conversation, detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => <div aria-label="绘图编辑器" />, restoreElements: (elements: unknown[]) => elements, convertToExcalidrawElements: (elements: unknown[]) => elements }));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const accountId = 'learning-role-library-owner';
const areaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const agentA: Character = { ...character, characterId: '11111111-1111-4111-8111-111111111111', card: { ...character.card, name: '逻辑向导' } };
const agentB: Character = { ...character, characterId: '22222222-2222-4222-8222-222222222222', card: { ...character.card, name: '阅读伙伴', firstMessage: '开始阅读吧。' } };
const storyA: Conversation = { ...conversation, conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', characterId: agentA.characterId, title: '逻辑练习', scene: 'learning', libraryEntryId: areaId, learningAreaId: areaId, persona: '逻辑身份', vocabulary: [{ term: '推理专属词' }] };
const storyB: Conversation = { ...storyA, conversationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', characterId: agentB.characterId, title: '阅读练习', persona: '阅读身份', vocabulary: [{ term: '阅读专属词' }] };

function savedDetail(story: Conversation, agent: Character): ConversationDetail {
  return { ...detail, conversation: story, character: agent, canvas: { enabled: true, revision: 0, elements: [] }, graph: { ...detail.graph,
    messages: detail.graph.messages.map(message => ({ ...message, characterId: message.role === 'assistant' ? agent.characterId : null,
      ...(message.messageId === 'message-assistant-1' ? { content: `${agent.card.name}的学习记录` } : {}) })) } };
}
function mountLearning(stories = [storyA], agents = [agentA, agentB], options: { available?: boolean; failCharactersOnce?: boolean; withMap?: boolean; initialMapVisible?: boolean } = {}) {
  const records = new Map(stories.map(story => [story.conversationId, savedDetail(story, agents.find(agent => agent.characterId === story.characterId)!)]));
  let characterFailures = options.failCharactersOnce ? 1 : 0;
  const requests: Array<{ path: string; options?: RequestInit }> = [];
  const profile = { profileId: '33333333-3333-4333-8333-333333333333', profileVersion: 1, modelId: 'test-model', displayName: '测试模型', contextWindow: 128000, maxOutputTokens: 8000 };
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    requests.push({ path, options });
    if (path === '/api/me/agent-models') return new Response(JSON.stringify({ cash: [profile], defaultCash: profile, points: null }));
    if (path.endsWith('/characters') && options?.method === 'POST') {
      const card = JSON.parse(String((options.body as FormData).get('normalized_card')));
      const created = { ...character, characterId: '33333333-3333-4333-8333-333333333333', card };
      agents.push(created);
      return new Response(JSON.stringify(created));
    }
    if (path.endsWith('/characters')) {
      if (characterFailures-- > 0) return new Response('{}', { status: 503 });
      return new Response(JSON.stringify({ characters: agents }));
    }
    if (path.endsWith('/executions')) return new Response(JSON.stringify({ execution: null }));
    if (path.endsWith('/canvas')) return new Response(JSON.stringify({ enabled: true, revision: 0, elements: [] }));
    if (path === `/api/me/learning-areas/${areaId}/conversations` && options?.method === 'POST') {
      const input = JSON.parse(String(options.body));
      const agent = agents.find(item => item.characterId === input.characterId)!;
      const created: Conversation = { ...storyA, ...input, conversationId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${records.size}`, characterId: agent.characterId,
        title: `${agent.card.name}的新对话`, persona: input.persona ?? null, vocabulary: input.vocabulary ?? null, openingMessage: agent.card.firstMessage };
      const saved = savedDetail(created, agent);
      const fresh = { ...saved, turns: [], generations: [], graph: { ...saved.graph, activePath: ['message-opening'],
        messages: [{ ...saved.graph.messages[0], content: created.openingMessage }], branches: [{ ...saved.graph.branches[0], leafMessageId: 'message-opening' }] } };
      records.set(created.conversationId, fresh);
      return new Response(JSON.stringify(fresh), { status: 201 });
    }
    if (path === `/api/me/learning-areas/${areaId}/conversations`) return new Response(JSON.stringify({ conversations: [...records.values()].map(item => item.conversation).filter(story => story.scene === 'learning' && story.learningAreaId === areaId), bootstrapState: records.size ? 'has_active' : 'cleared' }));
    const saved = records.get(path.split('/').pop()!);
    if (saved) return new Response(JSON.stringify(saved));
    return new Response('{}', { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: accountId, username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  function LearningLayout() {
    const [mapVisible, setMapVisible] = useState(options.initialMapVisible ?? false);
    return <SceneWorkspace owner={{ accountId, csrfToken: 'csrf', userName: '小明', scene: 'learning', areaId, available: options.available ?? true }} navigate={vi.fn()}
      headerExtra={options.withMap && <button onClick={() => setMapVisible(previous => !previous)}>{mapVisible ? '返回学习聊天' : '查看学习地图'}</button>}
      mapVisible={mapVisible} mapPane={<section aria-label="学习地图">当前学习地图</section>} />;
  }
  const element = <QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId={accountId}><ModelSelectionProvider accountId={accountId}>
    <LearningLayout />
  </ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>;
  return { ...render(element), requests, records, client, element };
}

it('closes history when the learning map opens and lets the learner restore it without losing a draft', async () => {
  const { requests } = mountLearning([storyA], [agentA, agentB], { withMap: true });
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '尚未发送的学习问题' } });
  expect(screen.getByRole('complementary')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '查看学习地图' }));
  await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument());
  expect(screen.getByRole('region', { name: '学习地图' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '展开会话历史' }));
  expect(screen.getByRole('complementary')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '返回学习聊天' }));
  expect(screen.getByRole('complementary')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '查看学习地图' }));
  await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('尚未发送的学习问题');
  expect(requests.filter(request => request.options?.method === 'POST' && request.path.endsWith('/executions'))).toEqual([]);
});

it.each([false, true])('restores the map width after history closes, including initial map visibility %s', async initialMapVisible => {
  const storageKey = `mapflow.layout.canvas.${accountId}.map`;
  localStorage.setItem(storageKey, '681');
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const room = this.classList.contains('mf-chat-layout') && document.querySelector('.mf-history-sidebar') ? 936 : 1171;
    return new DOMRect(0, 0, parseFloat(this.style.getPropertyValue('--panel-width')) || room, 800);
  });
  try {
    mountLearning([storyA], [agentA, agentB], { withMap: true, initialMapVisible });
    if (!initialMapVisible) {
      await screen.findByText('逻辑向导的学习记录');
      fireEvent.click(screen.getByRole('button', { name: '查看学习地图' }));
    }
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开会话历史' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('separator', { name: '调整地图与聊天宽度' })).toHaveAttribute('aria-valuenow', '681');
    expect(localStorage.getItem(storageKey)).toBe('681');
  } finally {
    bounds.mockRestore();
  }
});

it('opens the learning map before a conversation exists without starting an execution', async () => {
  const { requests } = mountLearning([], [agentA, agentB], { withMap: true });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('还没有会话，先新建一段对话。'));
  fireEvent.click(screen.getByRole('button', { name: '查看学习地图' }));
  expect(await screen.findByRole('region', { name: '学习地图' })).toBeVisible();
  expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
  expect(requests.filter(request => request.options?.method === 'POST' && request.path.endsWith('/executions'))).toEqual([]);
});

it('lists every library role in learning chat, including a role with no conversations', async () => {
  mountLearning();
  await screen.findByText('逻辑向导的学习记录');
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  expect(within(selector).getByRole('option', { name: '逻辑向导' })).toHaveValue(agentA.characterId);
  expect(within(selector).getByRole('option', { name: '阅读伙伴' })).toHaveValue(agentB.characterId);
});

it('opens the selected learning role own conversation without replacing another conversation role', async () => {
  const view = mountLearning([storyA, storyB]);
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('阅读伙伴的学习记录');
  expect(screen.queryByText('逻辑向导的学习记录')).not.toBeInTheDocument();
  expect(view.requests.filter(request => request.options?.method === 'PATCH' || request.options?.method === 'POST')).toEqual([]);
});

it('creates an unused library role in the current learning area without copying the previous role persona or history', async () => {
  const view = mountLearning();
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByRole('heading', { name: '阅读伙伴' });
  expect(screen.queryByText('逻辑向导的学习记录')).not.toBeInTheDocument();
  const writes = view.requests.filter(request => request.options?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe(`/api/me/learning-areas/${areaId}/conversations`);
  expect(JSON.parse(String(writes[0].options?.body))).toMatchObject({ characterId: agentB.characterId, userName: '小明' });
  expect(JSON.parse(String(writes[0].options?.body))).not.toHaveProperty('persona');
  expect(JSON.parse(String(writes[0].options?.body))).not.toHaveProperty('vocabulary');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('逻辑向导的学习记录');
});

it('keeps each learning role unsent draft when switching away and back', async () => {
  mountLearning([storyA, storyB]);
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '逻辑草稿' } });
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('阅读伙伴的学习记录');
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '阅读草稿' } });
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('逻辑向导的学习记录');
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('逻辑草稿');
});

it('returns to the learning role last selected conversation rather than its newest conversation', async () => {
  const older = { ...storyA, conversationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: '更早的逻辑练习' };
  mountLearning([storyA, older, storyB]);
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^更早的逻辑练习/ }));
  await waitFor(() => expect(within(screen.getByRole('complementary')).getByRole('combobox')).not.toBeDisabled());
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('阅读伙伴的学习记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentA.characterId } });
  await screen.findByText('逻辑向导的学习记录');
  expect(within(screen.getByRole('complementary')).getByRole('button', { name: /^更早的逻辑练习/ })).toHaveAttribute('aria-current', 'true');
});

it('does not replay another role pending creation when selecting an unused role', async () => {
  const pendingKey = `mapflow.tavern.creation.v1.${accountId}.learning.${areaId}`;
  const requestId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  localStorage.setItem(pendingKey, JSON.stringify({ characterId: agentA.characterId, clientRequestId: requestId, userName: '小明' }));
  const view = mountLearning();
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByText('另一个角色的新建请求待确认，请先切回该角色重试新建。');
  expect(screen.getByText('逻辑向导的学习记录')).toBeVisible();
  expect(view.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '开始新对话' }));
  await waitFor(() => expect(localStorage.getItem(pendingKey)).toBeNull());
  expect(JSON.parse(String(view.requests.find(request => request.options?.method === 'POST')?.options?.body))).toMatchObject({ characterId: agentA.characterId, clientRequestId: requestId });
  await waitFor(() => expect(within(screen.getByRole('complementary')).getByRole('combobox')).not.toBeDisabled());
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByRole('heading', { name: '阅读伙伴' });
});

it('lists the complete library and opens the first selected role after history was cleared', async () => {
  const view = mountLearning([]);
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  await within(selector).findByRole('option', { name: '阅读伙伴' });
  await waitFor(() => expect(selector).not.toBeDisabled());
  expect(view.requests.some(request => request.options?.method === 'POST')).toBe(false);
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  await screen.findByRole('heading', { name: '阅读伙伴' });
});

it('offers every library role from the phone header and history drawer', async () => {
  vi.stubGlobal('innerWidth', 390);
  mountLearning([storyA, storyB]);
  await screen.findByText('逻辑向导的学习记录');
  const header = screen.getByRole('combobox', { name: '切换智能体' });
  expect(within(header).getByRole('option', { name: '阅读伙伴' })).toHaveValue(agentB.characterId);
  fireEvent.click(screen.getByRole('button', { name: '会话历史' }));
  const drawer = screen.getByRole('dialog', { name: '会话历史' });
  const selector = within(drawer).getByRole('combobox', { name: '当前智能体' });
  expect(within(selector).getAllByRole('option')).toHaveLength(3);
  fireEvent.change(selector, { target: { value: agentB.characterId } });
  await screen.findByText('阅读伙伴的学习记录');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '切换智能体' })).toHaveValue(agentB.characterId);
});

it('makes a newly created learning role selectable immediately after leaving the editor', async () => {
  const view = mountLearning();
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
  fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
  fireEvent.change(screen.getByRole('textbox', { name: '角色名称' }), { target: { value: '围棋伙伴' } });
  fireEvent.change(screen.getByRole('textbox', { name: '角色设定（提示词）' }), { target: { value: '陪我复盘围棋。' } });
  fireEvent.click(screen.getByRole('button', { name: '保存角色卡' }));
  await screen.findByRole('heading', { name: '围棋伙伴' });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  const added = within(selector).getByRole('option', { name: '围棋伙伴' });
  expect(view.requests.filter(request => request.options?.method === 'POST' && request.path.endsWith('/conversations'))).toHaveLength(0);
  fireEvent.change(selector, { target: { value: added.getAttribute('value') } });
  await screen.findByRole('heading', { name: '围棋伙伴' });
});

it.each(['tavern', 'another learning area'])('does not open the same role conversation from %s', async scope => {
  const outside: Conversation = scope === 'tavern' ? { ...storyB, scene: 'tavern', learningAreaId: null, libraryEntryId: null }
    : { ...storyB, learningAreaId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', libraryEntryId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };
  localStorage.setItem(`mapflow.tavern.selection.v1.${accountId}.tree.${areaId}.character.${agentB.characterId}`, outside.conversationId);
  const view = mountLearning([storyA, outside]);
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.change(within(screen.getByRole('complementary')).getByRole('combobox'), { target: { value: agentB.characterId } });
  await screen.findByRole('heading', { name: '阅读伙伴' });
  expect(view.requests.filter(request => request.path === `/api/me/tavern/conversations/${storyB.conversationId}`)).toHaveLength(0);
  expect(view.requests.filter(request => request.options?.method === 'POST')).toHaveLength(1);
});

it('keeps distinct library entries with the same name available even without conversations', async () => {
  const duplicate = { ...agentB, card: { ...agentB.card, name: agentA.card.name } };
  mountLearning([storyA], [agentA, duplicate]);
  await screen.findByText('逻辑向导的学习记录');
  const selector = within(screen.getByRole('complementary')).getByRole('combobox');
  expect(within(selector).getAllByRole('option', { name: '逻辑向导' }).map(option => option.getAttribute('value'))).toEqual([agentA.characterId, agentB.characterId]);
});

it('does not allow role selection in an unavailable learning area', async () => {
  const view = mountLearning([storyA], [agentA, agentB], { available: false });
  await screen.findByText('逻辑向导的学习记录');
  expect(within(screen.getByRole('complementary')).getByRole('combobox')).toBeDisabled();
  expect(view.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
});

it('can create another conversation for the active learning role with its own profile', async () => {
  const view = mountLearning();
  await screen.findByText('逻辑向导的学习记录');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '开始新对话' }));
  await waitFor(() => expect(view.requests.filter(request => request.options?.method === 'POST')).toHaveLength(1));
  const request = view.requests.find(request => request.options?.method === 'POST')!;
  expect(JSON.parse(String(request.options?.body))).toMatchObject({ characterId: agentA.characterId, persona: '逻辑身份', vocabulary: [{ term: '推理专属词' }] });
});

it('shows a role library loading failure and allows retry without creating a conversation', async () => {
  const view = mountLearning([storyA], [agentA, agentB], { failCharactersOnce: true });
  await screen.findByText('逻辑向导的学习记录');
  const error = await screen.findByRole('alert');
  fireEvent.click(within(error).getByRole('button', { name: '重试' }));
  await within(screen.getByRole('complementary')).findByRole('option', { name: '阅读伙伴' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(view.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
});
