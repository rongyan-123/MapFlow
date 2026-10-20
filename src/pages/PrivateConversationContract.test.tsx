import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character, Conversation, ConversationDetail } from '../domains/conversations/types';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character, conversation, detail } from '../test/conversations';
import LearningPage from './LearningPage';
import TavernPage from './TavernPage';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => <div aria-label="绘图编辑器" />, restoreElements: (elements: unknown[]) => elements, convertToExcalidrawElements: (elements: unknown[]) => elements }));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const accountId = 'shared-chat-contract';
const areaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const roleA: Character = { ...character, characterId: '11111111-1111-4111-8111-111111111111', card: { ...character.card, name: '逻辑伙伴' } };
const roleB: Character = { ...character, characterId: '22222222-2222-4222-8222-222222222222', card: { ...character.card, name: '阅读伙伴' } };
const unusedRole: Character = { ...character, characterId: '33333333-3333-4333-8333-333333333333', card: { ...character.card, name: '尚未聊过的角色', firstMessage: '这是我们第一次对话。' } };

describe.each(['tavern', 'learning'] as const)('%s page shared conversation contract', scene => {
  const collection = scene === 'learning' ? `/api/me/learning-areas/${areaId}/conversations` : '/api/me/tavern/conversations';
  function mount({ cleared = false } = {}) {
    const roles = [roleA, roleB, unusedRole];
    const requests: Array<{ path: string; options?: RequestInit }> = [];
    function story(role: Character, id: string): Conversation {
      return { ...conversation, conversationId: id, characterId: role.characterId, scene,
        learningAreaId: scene === 'learning' ? areaId : null, libraryEntryId: scene === 'learning' ? areaId : null,
        title: `${role.card.name}的会话`, persona: `${role.card.name}的身份`, vocabulary: [{ term: `${role.card.name}的词` }] };
    }
    function saved(story: Conversation, role: Character): ConversationDetail {
      return { ...detail, conversation: story, character: role, canvas: { enabled: true, revision: 0, elements: [] },
        graph: { ...detail.graph, messages: detail.graph.messages.map(message => ({ ...message,
          ...(message.messageId === 'message-assistant-1' ? { content: `${role.card.name}的聊天内容` } : {}) })) } };
    }
    const first = story(roleA, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const second = story(roleB, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const records = new Map(cleared ? [] : [first, second].map(item => [item.conversationId, saved(item, roles.find(role => role.characterId === item.characterId)!)]));
    const profile = { profileId: '44444444-4444-4444-8444-444444444444', profileVersion: 1, modelId: 'test-model', displayName: '契约测试模型', contextWindow: 128000, maxOutputTokens: 8000 };
    vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
      requests.push({ path, options });
      if (path === '/api/me/agent-models') return Response.json({ cash: [profile], defaultCash: profile, points: null });
      if (path === '/api/me/tree-library') return Response.json({ entries: [] });
      if (path === '/api/me/learning-areas') return Response.json({ areas: [{ areaId, libraryEntryId: areaId, title: '共同规则验收学习区', available: true, createdAt: conversation.createdAt }] });
      if (path.startsWith('/api/me/tavern/characters/')) {
        const index = roles.findIndex(role => role.characterId === path.split('/').pop());
        if (index >= 0 && options?.method === 'PATCH') {
          const input = JSON.parse(String(options.body));
          roles[index] = { ...roles[index], card: input.card };
          return Response.json({ character: roles[index], conversation: null });
        }
        if (index >= 0 && options?.method === 'DELETE') {
          roles.splice(index, 1);
          return new Response(null, { status: 204 });
        }
      }
      if (path.endsWith('/characters') && options?.method === 'POST') {
        const card = JSON.parse(String((options.body as FormData).get('normalized_card')));
        const created = { ...character, characterId: '55555555-5555-4555-8555-555555555555', card };
        roles.push(created);
        return Response.json(created);
      }
      if (path.endsWith('/characters')) return Response.json({ characters: roles });
      if (path.endsWith('/executions')) return Response.json({ execution: null });
      if (path.endsWith('/canvas')) return Response.json({ enabled: true, revision: 0, elements: [] });
      if (path === collection && options?.method === 'POST') {
        const input = JSON.parse(String(options.body));
        const role = roles.find(item => item.characterId === input.characterId)!;
        const created = { ...story(role, `cccccccc-cccc-4ccc-8ccc-ccccccccccc${records.size}`), ...input,
          title: `${role.card.name}的新会话`, persona: input.persona ?? null, vocabulary: input.vocabulary ?? null, openingMessage: role.card.firstMessage };
        const opening = saved(created, role);
        const fresh = { ...opening, turns: [], generations: [], graph: { ...opening.graph, activePath: ['message-opening'],
          messages: [{ ...opening.graph.messages[0], content: created.openingMessage }], branches: [{ ...opening.graph.branches[0], leafMessageId: 'message-opening' }] } };
        records.set(created.conversationId, fresh);
        return Response.json(scene === 'learning' ? fresh : created);
      }
      if (path === collection) return Response.json({ conversations: [...records.values()].map(item => item.conversation), bootstrapState: records.size ? 'has_active' : 'cleared' });
      const record = records.get(path.split('/').pop()!);
      if (record) return Response.json(record);
      return new Response('{}', { status: 503 });
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: accountId, username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
    render(<QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId={accountId}><ModelSelectionProvider accountId={accountId}>
      {scene === 'learning' ? <LearningPage navigate={vi.fn()} areaId={areaId} /> : <TavernPage navigate={vi.fn()} />}
    </ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>);
    return { requests, writes: () => requests.filter(request => request.options?.method === 'POST'), first };
  }
  function selector() { return within(screen.getByRole('complementary')).getByRole('combobox', { name: '当前智能体' }); }
  function choose(role: Character) { fireEvent.change(selector(), { target: { value: role.characterId } }); }
  async function selected(role: Character) {
    await waitFor(() => expect(selector()).toHaveValue(role.characterId));
    await waitFor(() => expect(selector()).toBeEnabled());
  }

  it('shows the complete library even for a role without conversations', async () => {
    mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    expect(within(selector()).getByRole('option', { name: unusedRole.card.name })).toHaveValue(unusedRole.characterId);
  });

  it('restores independent messages and drafts without changing either conversation role', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '逻辑草稿' } });
    choose(roleB);
    await screen.findByText('阅读伙伴的聊天内容');
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '阅读草稿' } });
    choose(roleA);
    await screen.findByText('逻辑伙伴的聊天内容');
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('逻辑草稿');
    choose(roleB);
    await screen.findByText('阅读伙伴的聊天内容');
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('阅读草稿');
    expect(view.writes()).toEqual([]);
    expect(view.requests.some(request => request.options?.method === 'PATCH')).toBe(false);
  });

  it('creates an unused role in its own scene without copying another role profile', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    choose(unusedRole);
    await selected(unusedRole);
    expect(screen.queryByText('逻辑伙伴的聊天内容')).not.toBeInTheDocument();
    expect(view.writes()).toHaveLength(1);
    expect(view.writes()[0].path).toBe(collection);
    const input = JSON.parse(String(view.writes()[0].options?.body));
    expect(input).toMatchObject({ characterId: unusedRole.characterId, userName: '小明' });
    expect(input).not.toHaveProperty('persona');
    expect(input).not.toHaveProperty('vocabulary');
    choose(roleA);
    await screen.findByText('逻辑伙伴的聊天内容');
  });

  it('creates another conversation for the selected role with a separate draft', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '原会话草稿' } });
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '开始新对话' }));
    await waitFor(() => expect(within(screen.getByRole('complementary')).getByRole('button', { name: /^逻辑伙伴的新会话/ })).toHaveAttribute('aria-current', 'true'));
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
    expect(JSON.parse(String(view.writes()[0].options?.body))).toMatchObject({ characterId: roleA.characterId, persona: '逻辑伙伴的身份' });
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^逻辑伙伴的会话/ }));
    await screen.findByText('逻辑伙伴的聊天内容');
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('原会话草稿');
  });

  it('makes a created card immediately selectable after closing the library', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
    fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
    fireEvent.change(screen.getByRole('textbox', { name: '角色名称' }), { target: { value: '新增伙伴' } });
    fireEvent.change(screen.getByRole('textbox', { name: '角色设定（提示词）' }), { target: { value: '一起交流。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存角色卡' }));
    await screen.findByRole('heading', { name: '新增伙伴' });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(within(selector()).getByRole('option', { name: '新增伙伴' })).toBeInTheDocument();
    expect(screen.getByText('逻辑伙伴的聊天内容')).toBeVisible();
    expect(view.writes().filter(request => request.path === collection)).toEqual([]);
  });

  it('keeps a cleared scene empty until a role is explicitly chosen', async () => {
    const view = mount({ cleared: true });
    await waitFor(() => expect(selector()).toBeEnabled());
    expect(view.writes()).toEqual([]);
    choose(unusedRole);
    await selected(unusedRole);
    expect(view.writes()).toHaveLength(1);
  });

  it('renames and removes a library card while retaining the existing conversation and draft', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '保留的草稿' } });
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
    const record = screen.getByRole('heading', { name: unusedRole.card.name }).closest('article')!;
    fireEvent.click(within(record).getByRole('button', { name: '重命名' }));
    fireEvent.change(screen.getByRole('textbox', { name: '角色名称' }), { target: { value: '重命名伙伴' } });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(selector()).getByRole('option', { name: '重命名伙伴' })).toHaveValue(unusedRole.characterId);
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: '打开角色库' }));
    const renamed = screen.getByRole('heading', { name: '重命名伙伴' }).closest('article')!;
    fireEvent.click(within(renamed).getByRole('button', { name: '删除角色' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除角色' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(selector()).queryByRole('option', { name: '重命名伙伴' })).not.toBeInTheDocument();
    expect(screen.getByText('逻辑伙伴的聊天内容')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('保留的草稿');
    expect(view.requests.filter(request => request.options?.method === 'DELETE').map(request => request.path)).toEqual(['/api/me/tavern/characters/' + unusedRole.characterId]);
  });

  it('opens the model tab directly and keeps all five configuration sections on the same conversation', async () => {
    const view = mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '配置之外的草稿' } });
    fireEvent.click(screen.getByTitle('选择模型'));
    const dialog = within(screen.getByRole('dialog', { name: '配置' }));
    expect(dialog.getByRole('button', { name: '模型接入' })).toHaveAttribute('aria-selected', 'true');
    expect(dialog.queryByRole('textbox', { name: '用户称呼' })).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: '会话设定' }));
    expect(dialog.getByRole('textbox', { name: '用户称呼' })).toHaveValue('小明');
    expect(dialog.getByRole('textbox', { name: 'Persona（可选）' })).toHaveValue('逻辑伙伴的身份');
    fireEvent.click(dialog.getByRole('button', { name: '技能树与工具' }));
    expect(dialog.getByRole('button', { name: '打开教学画布' })).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: '历史与分支' }));
    expect(dialog.getByRole('combobox', { name: '当前分支' })).toBeVisible();
    fireEvent.click(dialog.getByRole('button', { name: '角色与会话' }));
    expect(dialog.getByRole('combobox', { name: '历史会话' })).toHaveValue(view.first.conversationId);
    fireEvent.click(dialog.getByRole('button', { name: '关闭' }));
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('配置之外的草稿');
    expect(view.writes()).toEqual([]);
  });

  it('opens the full role library through each scene phone entry and returns after selection', async () => {
    vi.stubGlobal('innerWidth', 390);
    mount();
    await screen.findByText('逻辑伙伴的聊天内容');
    if (scene === 'learning') expect(within(screen.getByRole('combobox', { name: '切换智能体' })).getByRole('option', { name: unusedRole.card.name })).toBeInTheDocument();
    else expect(screen.getByRole('button', { name: '智能体与会话' })).toHaveTextContent(roleA.card.name);
    fireEvent.click(screen.getByRole('button', { name: scene === 'tavern' ? '智能体与会话' : '会话历史' }));
    const drawer = screen.getByRole('dialog', { name: '会话历史' });
    expect(within(drawer).getByRole('option', { name: unusedRole.card.name })).toBeInTheDocument();
    fireEvent.change(within(drawer).getByRole('combobox', { name: '当前智能体' }), { target: { value: roleB.characterId } });
    await screen.findByText('阅读伙伴的聊天内容');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    if (scene === 'learning') expect(screen.getByRole('combobox', { name: '切换智能体' })).toHaveValue(roleB.characterId);
    else expect(screen.getByRole('button', { name: '智能体与会话' })).toHaveTextContent(roleB.card.name);
  });
});
