import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityProvider } from '../identity/IdentityContext';
import TavernPage from './TavernPage';
import { character, completion, conversation, detail, sseResponse, turn } from './testFixtures';
import type { Character, Conversation, ConversationDetail, GenerationAction } from './types';

vi.mock('../identity/identityClient', async importOriginal => ({
  ...await importOriginal<typeof import('../identity/identityClient')>(),
  fetchCurrentSession: () => Promise.resolve({ account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' }),
  fetchCapabilities: () => Promise.resolve({ identity: { registrationEnabled: true }, generation: { enabled: true, platformFundedEnabled: true, models: [], thinkingModes: [], reasoningEfforts: [] } }),
}));

let characters: Character[];
let conversations: Conversation[];
let savedDetail: ConversationDetail;
  let attempts: { clientActionId: string; expectedRevision: number; action: GenerationAction }[];
let failFirstTurn: boolean;
let modelUnavailable: boolean;
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  characters = [structuredClone(character)]; conversations = []; savedDetail = structuredClone(detail);
  attempts = []; failFirstTurn = false; modelUnavailable = false;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/credit/me') return json({ balance: 10, signedInToday: true, freeRemaining: 0, pricePerTree: 1 });
    if (url === '/api/model-catalog/byok') return json([{ id: 'gemini-3.8-flash', provider: 'AnyAI',
      contextWindow: 1048576, baseUrl: 'https://anyai.token6688.com/v1',
      settings: [{ name: 'enable_thinking', kind: 'switch', options: [] }] }]);
    if (url === '/api/me/tavern/characters' && init?.method === 'POST') {
      const body = init.body as FormData;
      const imported = { ...character, characterId: 'imported-1', card: JSON.parse(body.get('normalized_card') as string) };
      characters = [...characters, imported]; return json(imported);
    }
    if (url === '/api/me/tavern/characters') return json({ characters });
    if (url === '/api/me/tavern/characters/character-1' && init?.method === 'DELETE') {
      characters = characters.filter(item => item.characterId !== 'character-1');
      return new Response(null, { status: 204 });
    }
    if (url === '/api/me/tavern/conversations' && init?.method === 'POST') {
      const input = JSON.parse(init.body as string);
      const created = { ...conversation, userName: input.userName, persona: input.persona ?? '', vocabulary: input.vocabulary ?? null,
        openingMessage: input.greetingIndex === 1 ? `夜深了，${input.userName}。` : `你好，${input.userName}！` };
      const opening = { messageId: 'message-opening-created', parentMessageId: null, role: 'assistant' as const,
        origin: 'opening' as const, characterId: character.characterId, content: created.openingMessage };
      const graph = { revision: 0, activeBranchId: 'branch-main-created', activePath: [opening.messageId], messages: [opening],
        branches: [{ branchId: 'branch-main-created', name: 'Main', kind: 'main' as const, leafMessageId: opening.messageId }] };
      conversations = [created]; savedDetail = { character, conversation: created, turns: [], generations: [], graph }; return json(created);
    }
    if (url === '/api/me/tavern/conversations') return json({ conversations });
    if (url === '/api/me/tavern/conversations/conversation-1/profile' && init?.method === 'PATCH') {
      const { expectedRevision, userName, persona, vocabulary } = JSON.parse(init.body as string);
      if (expectedRevision !== savedDetail.graph.revision) return new Response(JSON.stringify({ error: { code: 'tavern.turn_conflict', message: '会话已变化' } }), { status: 409 });
      savedDetail = { ...savedDetail, conversation: { ...savedDetail.conversation, userName, persona, vocabulary: vocabulary ?? null },
        graph: { ...savedDetail.graph, revision: expectedRevision + 1 } };
      return json(savedDetail);
    }
    if (url === '/api/me/tavern/conversations/conversation-1/settings' && init?.method === 'PATCH') {
      const { expectedSettingsVersion, settings: generationSettings } = JSON.parse(init.body as string);
      if (expectedSettingsVersion !== savedDetail.conversation.generationSettingsVersion) {
        return new Response(JSON.stringify({ error: { code: 'tavern.turn_conflict', message: '设置已变化，请刷新后重试。' } }), { status: 409 });
      }
      savedDetail = { ...savedDetail, conversation: { ...savedDetail.conversation, generationSettings,
        generationSettingsVersion: savedDetail.conversation.generationSettingsVersion + 1 } };
      return json({ generationSettings, generationSettingsVersion: savedDetail.conversation.generationSettingsVersion });
    }
    if (url === '/api/me/tavern/conversations/conversation-1/actions' && init?.method === 'POST') {
      const input = JSON.parse(init.body as string);
      if (input.expectedRevision !== savedDetail.graph.revision) return json({});
      const nextRevision = savedDetail.graph.revision + 1;
      let graph = savedDetail.graph;
      if (input.action.type === 'edit') {
        const original = graph.messages.find(message => message.messageId === input.action.messageId)!;
        const replacement = { ...original, messageId: `edited-${nextRevision}`, origin: 'edit' as const,
          content: input.action.replacementContent };
        const position = graph.activePath.indexOf(original.messageId);
        graph = { ...graph, activePath: [...graph.activePath.slice(0, position), replacement.messageId],
          messages: [...graph.messages, replacement], branches: graph.branches.map(branch => branch.branchId === graph.activeBranchId
            ? { ...branch, leafMessageId: replacement.messageId } : branch) };
      } else if (input.action.type === 'select_alternative') {
        graph = setActiveLeaf(graph, input.action.assistantMessageId);
      } else if (input.action.type === 'create_branch' || input.action.type === 'create_checkpoint') {
        const kind = input.action.type === 'create_checkpoint' ? 'checkpoint' as const : 'branch' as const;
        const branch = { branchId: `${kind}-${nextRevision}`, name: input.action.name, kind, leafMessageId: input.action.anchorMessageId };
        graph = { ...graph, branches: [...graph.branches, branch] };
        if (input.action.type === 'create_branch' && input.action.activate) graph = setActiveLeaf({ ...graph, activeBranchId: branch.branchId }, branch.leafMessageId);
      } else if (input.action.type === 'select_branch') {
        const branch = graph.branches.find(item => item.branchId === input.action.branchId)!;
        graph = setActiveLeaf({ ...graph, activeBranchId: branch.branchId }, branch.leafMessageId);
      }
      graph = { ...graph, revision: nextRevision };
      savedDetail = { ...savedDetail, graph }; return json(graph);
    }
    if (url === '/api/me/tavern/conversations/conversation-1') return json(savedDetail);
    if (url === '/api/me/tavern/conversations/conversation-1/turns' && init?.method === 'POST') {
      const request = JSON.parse(init.body as string);
      const input = { clientActionId: request.clientActionId as string,
        expectedRevision: request.expectedRevision as number, action: request.action as GenerationAction };
      attempts.push(input);
      if (modelUnavailable) return sseResponse([{ event: 'error', payload: { code: 'tavern.runtime_unavailable', message: '酒馆模型暂时不可用，请稍后重试。' } }]);
      if (failFirstTurn && attempts.length === 1) return sseResponse([{ event: 'delta', payload: { delta: '未完成草稿' } }]);
      const action = input.action;
      const target = action.type === 'reply' ? null : savedDetail.graph.messages.find(message => message.messageId === action.assistantMessageId)!;
      const assistantText = action.type === 'reply' ? '新回复 🌙' : action.type === 'regenerate' ? '重新斟茶。' : '夜色更深。';
      const userText = action.type === 'reply' ? action.message
        : action.type === 'regenerate' ? savedDetail.graph.messages.find(message => message.messageId === target?.parentMessageId)?.content ?? ''
          : '[继续]';
      const savedTurn = { ...turn, turnId: `turn-${input.clientActionId}`, clientTurnId: input.clientActionId,
        userMessage: userText, assistantMessage: assistantText };
      let graph = savedDetail.graph;
      if (action.type === 'reply') {
        const previousLeaf = graph.activePath[graph.activePath.length - 1] ?? null;
        const userMessage = { messageId: `message-user-${input.clientActionId}`, parentMessageId: previousLeaf,
          role: 'user' as const, origin: 'user' as const, characterId: null, content: action.message };
        const assistantMessage = { messageId: `message-assistant-${input.clientActionId}`, parentMessageId: userMessage.messageId,
          role: 'assistant' as const, origin: 'model' as const, characterId: character.characterId, content: assistantText };
        graph = { ...graph, activePath: [...graph.activePath, userMessage.messageId, assistantMessage.messageId],
          messages: [...graph.messages, userMessage, assistantMessage], branches: graph.branches.map(branch => branch.branchId === graph.activeBranchId
            ? { ...branch, leafMessageId: assistantMessage.messageId } : branch) };
      } else {
        const assistantMessage = { messageId: `message-assistant-${input.clientActionId}`,
          parentMessageId: action.type === 'regenerate' ? target!.parentMessageId : target!.messageId,
          role: 'assistant' as const, origin: action.type === 'continue' ? 'continue' as const : 'model' as const,
          characterId: character.characterId, content: assistantText };
        graph = setActiveLeaf({ ...graph, messages: [...graph.messages, assistantMessage] }, assistantMessage.messageId);
      }
      graph = { ...graph, revision: graph.revision + 1 };
      const outputMessageId = graph.activePath[graph.activePath.length - 1];
      const generation = { generationId: savedTurn.turnId, branchId: graph.activeBranchId, clientActionId: input.clientActionId,
        intent: action.type, anchorMessageId: action.type === 'reply' ? graph.activePath[graph.activePath.length - 3] ?? null : action.assistantMessageId,
        inputMessageId: action.type === 'continue' ? null : action.type === 'reply' ? graph.activePath[graph.activePath.length - 2] ?? null : target?.parentMessageId ?? null,
        outputMessageId, promptFingerprint: 'b'.repeat(64), settingsSnapshot: conversation.generationSettings,
        modelId: 'deepseek-v4-flash', usage: savedTurn.usage, chargedCreditUnits: savedTurn.chargedCreditUnits, createdAt: savedTurn.createdAt };
      savedDetail = { ...savedDetail, turns: [...savedDetail.turns.filter(item => item.clientTurnId !== input.clientActionId), savedTurn],
        generations: [...savedDetail.generations.filter(item => item.clientActionId !== input.clientActionId), generation], graph };
      return sseResponse([{ event: 'delta', payload: { delta: assistantText } }, { event: 'completed', payload: { ...completion, turn: savedTurn, graph } }]);
    }
    throw new Error(`Unexpected endpoint: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}><IdentityProvider><TavernPage onNavigateConsole={() => {}} /></IdentityProvider></QueryClientProvider>);
  return { ...rendered, client };
}
function restoreConversation() {
  conversations = [conversation];
  window.localStorage.setItem('mapflow.tavern.selection.v1.player-1', conversation.conversationId);
}

function setActiveLeaf(graph: ConversationDetail['graph'], leafMessageId: string | null): ConversationDetail['graph'] {
  const byId = new Map(graph.messages.map(message => [message.messageId, message]));
  const reversed: string[] = [];
  let current = leafMessageId;
  while (current) { reversed.push(current); current = byId.get(current)?.parentMessageId ?? null; }
  return { ...graph, activePath: reversed.reverse(), branches: graph.branches.map(branch => branch.branchId === graph.activeBranchId
    ? { ...branch, leafMessageId } : branch) };
}

describe('Tavern page', () => {
  it('opens a character with defaults in one click and does not create again on repeated clicks', async () => {
    const user = userEvent.setup(); renderPage();
    await user.dblClick(await screen.findByRole('button', { name: '选择角色 旅人' }));
    expect(await screen.findByText('你好，小明！')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择角色 旅人' }));
    expect(screen.getByText('你好，小明！')).toBeInTheDocument();
    const creates = fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/conversations') && init?.method === 'POST');
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0][1]!.body as string)).toEqual({ characterId: 'character-1', userName: '小明', greetingIndex: 0 });
    expect(screen.queryByRole('button', { name: '新建会话' })).not.toBeInTheDocument();
  });

  it('restores an existing character conversation without clearing history or creating another', async () => {
    conversations = [conversation];
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '选择角色 旅人' }));
    expect(await screen.findByText('请用茶。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择角色 旅人' }));
    expect(screen.getByText('请用茶。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('sends with Enter but preserves Shift+Enter and IME composition', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    const input = await screen.findByLabelText('消息');
    await user.type(input, '你好');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(attempts).toHaveLength(0);
    await user.keyboard('{Shift>}{Enter}{/Shift}世界');
    expect(input).toHaveValue('你好\n世界');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('新回复 🌙')).toBeInTheDocument();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].action).toEqual({ type: 'reply', message: '你好\n世界' });
  });

  it('renders roleplay Markdown safely and keeps history controls inside configuration', async () => {
    restoreConversation();
    savedDetail.graph.messages[2].content = '*轻轻放下茶杯*\n\n**欢迎**\n下一行\n\n<img src=x onerror=alert(1)>';
    const user = userEvent.setup(); renderPage();
    const log = await screen.findByRole('log');
    await within(log).findByText('轻轻放下茶杯');
    expect(log.querySelector('em')).toHaveTextContent('轻轻放下茶杯');
    expect(log.querySelector('strong')).toHaveTextContent('欢迎');
    expect(log.querySelector('img[src="x"]')).toBeNull();
    expect(screen.queryByLabelText('当前分支')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '配置' }));
    expect(await screen.findByLabelText('当前分支')).toBeInTheDocument();
  });

  it('previews imports locally, renders card markup as text, reports ignored scripts and uploads the original only after confirmation', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '导入角色卡' }));
    const file = new File([JSON.stringify({ name: '新角色', description: '<img src=x onerror=alert(1)>', first_mes: '你好', extensions: { regex_scripts: ['evil()'] } })], 'new.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('选择 PNG 或 JSON 角色卡'), file);
    const preview = await screen.findByRole('region', { name: '导入预览' });
    expect(within(preview).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(within(preview).getByText(/regex_scripts/)).toBeInTheDocument();
    expect(preview.querySelector('img')).toBeNull();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '确认导入' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '导入角色卡' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '选择角色 新角色' })).toBeInTheDocument();
    const upload = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/characters') && init?.method === 'POST')?.[1];
    expect((upload?.body as FormData).get('source_file')).toBe(file);
  });

  it('groups community discovery and the official catalog inside one import entry', async () => {
    const officialIndex = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json';
    const originalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url === officialIndex
      ? json([{ type: 'character', id: 'default_Example.png', name: 'Example', description: 'A sample role',
        url: 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/assets/character/default_Example.png', highlight: true }])
      : originalFetch(url, init));
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '导入角色卡' }));
    const dialog = await screen.findByRole('dialog', { name: '导入角色卡' });
    expect(screen.queryByRole('button', { name: '浏览酒馆精选卡' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '从社区找角色卡' })).toBeInTheDocument();
    const formatHint = within(dialog).getByRole('note', { name: '下载格式提醒' });
    expect(formatHint).toHaveTextContent('Download for SillyTavern');
    expect(formatHint).toHaveTextContent('不要选 Download for Rin Chat');
    const communityLinks = within(dialog).getAllByRole('link').filter(link => link.closest('section')?.querySelector('h3')?.textContent === '从社区找角色卡');
    expect(communityLinks.map(link => link.textContent?.trim())).toEqual([
      'B 站 · 酒馆角色卡 ↗', '抖音 · 酒馆角色卡 ↗', 'SillyTavern 吧 ↗',
      'Chub ↗', 'AI Character Cards ↗', 'RisuRealm ↗',
    ]);
    expect(within(dialog).getByRole('link', { name: /B 站 · 酒馆角色卡/ })).toHaveAttribute('href', 'https://search.bilibili.com/all?keyword=%E9%85%92%E9%A6%86%E8%A7%92%E8%89%B2%E5%8D%A1');
    expect(within(dialog).getByRole('link', { name: /抖音 · 酒馆角色卡/ })).toHaveAttribute('href', 'https://www.douyin.com/search/%E9%85%92%E9%A6%86%E8%A7%92%E8%89%B2%E5%8D%A1');
    expect(within(dialog).getByRole('link', { name: /SillyTavern 吧/ })).toHaveAttribute('href', 'https://tieba.baidu.com/f?kw=sillytavern');
    expect(within(dialog).getByRole('link', { name: /Chub/ })).toHaveAttribute('href', 'https://chub.ai/');
    expect(within(dialog).getByRole('link', { name: /AI Character Cards/ })).toHaveAttribute('href', 'https://aicharactercards.com/');
    expect(within(dialog).getByRole('link', { name: /RisuRealm/ })).toHaveAttribute('href', 'https://realm.risuai.net/');
    await user.click(within(dialog).getByRole('button', { name: '酒馆官方精选' }));
    expect(await within(dialog).findByText('Example')).toBeInTheDocument();
    expect(within(dialog).getByText('A sample role')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '下载并预览 Example' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('previews a dropped card through the local import path and uploads only after confirmation', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '导入角色卡' }));
    const dialog = screen.getByRole('dialog', { name: '导入角色卡' });
    const dropZone = within(dialog).getByLabelText('拖放角色卡');
    const file = new File([JSON.stringify({ name: '拖入角色', first_mes: '你好' })], 'dropped.json', { type: 'application/json' });
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    expect(await within(dialog).findByRole('region', { name: '导入预览' })).toHaveTextContent('拖入角色');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '确认导入' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '导入角色卡' })).not.toBeInTheDocument());
    const upload = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/characters') && init?.method === 'POST')?.[1];
    expect((upload?.body as FormData).get('source_file')).toBe(file);
  });

  it('rejects multiple dropped cards without restoring an earlier pending preview', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '导入角色卡' }));
    const dialog = screen.getByRole('dialog', { name: '导入角色卡' });
    const dropZone = within(dialog).getByLabelText('拖放角色卡');
    const first = new File([JSON.stringify({ name: '不应出现' })], 'first.json', { type: 'application/json' });
    const second = new File(['{}'], 'second.json', { type: 'application/json' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [first] } });
    fireEvent.drop(dropZone, { dataTransfer: { files: [first, second] } });
    expect(await within(dialog).findByText(/一次只能导入一张角色卡/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('不应出现')).not.toBeInTheDocument());
    expect(within(dialog).queryByRole('region', { name: '导入预览' })).not.toBeInTheDocument();
  });

  it('creates ordinary conversations without a setup dialog or a mandatory vocabulary', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '选择角色 旅人' }));
    expect(await screen.findByText('你好，小明！')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '继续' })).not.toBeInTheDocument();
    const create = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/conversations') && init?.method === 'POST')?.[1];
    expect(JSON.parse(create?.body as string)).toEqual({ characterId: 'character-1', userName: '小明', greetingIndex: 0 });
    expect(screen.queryByLabelText('用户称呼')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBe('conversation-1');
    expect(attempts).toHaveLength(0);
  });

  it('retains an imported character when a previous library read resolves late', async () => {
    const user = userEvent.setup(); const { client } = renderPage();
    await user.click(await screen.findByRole('button', { name: '导入角色卡' }));
    await user.upload(screen.getByLabelText('选择 PNG 或 JSON 角色卡'), new File(['{"name":"新角色"}'], 'new.json', { type: 'application/json' }));
    await screen.findByRole('region', { name: '导入预览' });
    let resolveList!: (response: Response) => void;
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/me/tavern/characters');
      return new Promise<Response>(resolve => { resolveList = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'tavern', 'characters'] }); });
    await user.click(screen.getByRole('button', { name: '确认导入' }));
    await screen.findByRole('button', { name: '选择角色 新角色' });
    await act(async () => { resolveList(json({ characters: [character] })); await refresh; });
    expect(client.getQueryData<Character[]>(['me', 'player-1', 'tavern', 'characters'])).toHaveLength(2);
  });

  it('does not resurrect a removed character on a late library read and preserves its conversation history', async () => {
    restoreConversation(); const user = userEvent.setup(); const { client } = renderPage();
    await user.click(await screen.findByRole('button', { name: '移出角色库' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    let resolveList!: (response: Response) => void;
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/me/tavern/characters');
      return new Promise<Response>(resolve => { resolveList = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'tavern', 'characters'] }); });
    await user.click(screen.getByRole('button', { name: '确认移除' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '选择角色 旅人' })).not.toBeInTheDocument());
    await act(async () => { resolveList(json({ characters: [character] })); await refresh; });
    expect(client.getQueryData<Character[]>(['me', 'player-1', 'tavern', 'characters'])).toHaveLength(0);
    expect(screen.getByText('请用茶。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建会话' })).not.toBeInTheDocument();
  });

  it('updates optional vocabulary and persona after creation without replacing history', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '会话设定' }));
    await user.clear(screen.getByLabelText('Persona（可选）'));
    await user.type(screen.getByLabelText('Persona（可选）'), '旅行者');
    fireEvent.change(screen.getByLabelText('学习词表（可选）'), { target: { value: 'tea\t茶\nquiet — 安静' } });
    await user.click(screen.getByRole('button', { name: '保存会话设定' }));
    await screen.findByText('会话设定已保存');
    expect(savedDetail.conversation.vocabulary).toEqual([{ term: 'tea', meaning: '茶' }, { term: 'quiet', meaning: '安静' }]);
    expect(savedDetail.conversation.persona).toBe('旅行者');
    expect(savedDetail.graph.messages.some(message => message.content === '请用茶。')).toBe(true);
  });

  it('offers alternate greetings only before dialogue starts and sends the selected index', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '选择角色 旅人' }));
    await screen.findByText('你好，小明！');
    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '会话设定' }));
    await user.selectOptions(screen.getByLabelText('开场白'), '1');
    await user.click(screen.getByRole('button', { name: '保存会话设定' }));
    await screen.findByText('会话设定已保存');
    const update = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/profile') && init?.method === 'PATCH')?.[1];
    expect(JSON.parse(update?.body as string).greetingIndex).toBe(1);
  });

  it('edits real DSH generation parameters inside the existing conversation details panel', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '生成参数' }));
    const summary = await screen.findByRole('dialog', { name: '配置' });
    await within(summary).findByText('旅人');
    const temperature = within(summary).getByLabelText('温度');
    await user.type(temperature, '0.7');
    const maximum = within(summary).getByLabelText('最大输出 Token');
    await user.clear(maximum); await user.type(maximum, '1024');
    await user.type(within(summary).getByLabelText('停止词（每行一个）'), 'END');
    await user.click(within(summary).getByRole('button', { name: '保存生成参数' }));
    expect(await within(summary).findByText('参数已保存 · 版本 2')).toBeInTheDocument();
    const update = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/settings') && init?.method === 'PATCH')?.[1];
    expect(JSON.parse(update?.body as string)).toEqual({ expectedSettingsVersion: 1,
      settings: { temperature: 0.7, maxOutputTokens: 1024, stopSequences: ['END'] } });
  });

  it('shows one configuration category at a time in a left navigation', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    const dialog = await screen.findByRole('dialog', { name: '配置' });
    const navigation = within(dialog).getByRole('navigation', { name: '配置分类' });
    expect(within(dialog).getByLabelText('选择会话')).toBeVisible();
    expect(within(dialog).getByLabelText('Persona（可选）')).not.toBeVisible();
    await user.click(within(navigation).getByRole('button', { name: '模型接入' }));
    expect(within(dialog).getByLabelText('模型线路')).toBeVisible();
    expect(within(dialog).getByLabelText('选择会话')).not.toBeVisible();
    await user.click(within(navigation).getByRole('button', { name: '会话设定' }));
    expect(within(dialog).getByLabelText('Persona（可选）')).toBeVisible();
  });

  it('sends the selected user model from the model category without persisting its key', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    const dialog = screen.getByRole('dialog', { name: '配置' });
    await user.click(within(dialog).getByRole('button', { name: '模型接入' }));
    await user.selectOptions(within(dialog).getByLabelText('模型线路'), 'anyai');
    await within(dialog).findByRole('option', { name: 'gemini-3.8-flash' });
    await user.type(within(dialog).getByLabelText('API Key'), 'test-key');
    await user.click(within(dialog).getByLabelText('深度思考'));
    await user.selectOptions(within(dialog).getByLabelText('发送的历史上下文'), '8192');
    await user.click(within(dialog).getByRole('button', { name: '关闭配置' }));
    await user.type(screen.getByRole('textbox', { name: '消息' }), '你好');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/turns'))).toBe(true));
    const sent = fetchMock.mock.calls.find(([url]) => url.endsWith('/turns'))?.[1];
    expect(JSON.parse(String(sent?.body))).toMatchObject({
      modelAccess: { apiKey: 'test-key', model: 'gemini-3.8-flash', baseUrl: 'https://anyai.token6688.com/v1',
        settings: { enable_thinking: true } }, historyBytes: 8192,
    });
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      expect(window.sessionStorage.getItem(window.sessionStorage.key(index)!)).not.toContain('test-key');
    }
  });

  it('retains unsaved profile fields when generation parameters are saved', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '会话设定' }));
    const persona = screen.getByLabelText('Persona（可选）');
    await user.clear(persona); await user.type(persona, '尚未保存的身份');
    const vocabulary = screen.getByLabelText('学习词表（可选）');
    await user.type(vocabulary, 'harbor');
    await user.click(screen.getByRole('button', { name: '生成参数' }));
    await user.click(screen.getByRole('button', { name: '保存生成参数' }));
    await screen.findByText('参数已保存 · 版本 2');
    await user.click(screen.getByRole('button', { name: '会话设定' }));
    expect(persona).toHaveValue('尚未保存的身份');
    expect(vocabulary).toHaveValue('harbor');
  });

  it('limits configuration history to the current character across session and character switches', async () => {
    restoreConversation();
    const otherCharacter = { ...character, characterId: 'character-2', card: { ...character.card, name: '灯塔守卫' } };
    const secondSession = { ...conversation, conversationId: 'conversation-2', title: '旅人的第二夜' };
    const otherSession = { ...conversation, conversationId: 'conversation-3', characterId: 'character-2', title: '灯塔之夜' };
    characters = [character, otherCharacter];
    conversations = [conversation, secondSession, otherSession];
    const originalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/me/tavern/conversations/conversation-2') return json({ ...detail, conversation: secondSession });
      if (url === '/api/me/tavern/conversations/conversation-3') return json({ ...detail, character: otherCharacter, conversation: otherSession });
      return originalFetch(url, init);
    });
    const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '配置' }));
    const history = screen.getByLabelText('选择会话');
    expect(within(history).queryByRole('option', { name: '灯塔之夜 · 小明' })).not.toBeInTheDocument();
    expect(within(history).getByRole('option', { name: '旅人的茶馆 · 小明' })).toBeInTheDocument();
    await user.selectOptions(history, 'conversation-2');
    await waitFor(() => expect(screen.getByLabelText('选择会话')).toHaveValue('conversation-2'));
    await user.click(screen.getByRole('button', { name: '关闭配置' }));
    await user.click(screen.getByRole('button', { name: '选择角色 灯塔守卫' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '选择角色 灯塔守卫' })).toHaveAttribute('aria-pressed', 'true'));
    await user.click(screen.getByRole('button', { name: '配置' }));
    expect(within(screen.getByLabelText('选择会话')).getAllByRole('option').map(option => option.textContent))
      .toEqual(['选择历史会话', '灯塔之夜 · 小明']);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('can restore preserved history with an empty character library and no local selection', async () => {
    characters = []; conversations = [conversation];
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    await user.selectOptions(await screen.findByLabelText('选择会话'), 'conversation-1');
    expect(await screen.findByText('请用茶。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('reloads the latest settings after a stale tab receives a version conflict', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '生成参数' }));
    const summary = await screen.findByRole('dialog', { name: '配置' });
    await within(summary).findByText('旅人');
    savedDetail = { ...savedDetail, conversation: { ...savedDetail.conversation,
      generationSettings: { temperature: 1.2, maxOutputTokens: 512, stopSequences: [] }, generationSettingsVersion: 2 } };
    await user.click(within(summary).getByRole('button', { name: '保存生成参数' }));
    expect(await within(summary).findByRole('alert')).toHaveTextContent('设置已变化');
    await waitFor(() => expect(within(summary).getByLabelText('最大输出 Token')).toHaveValue(512));
  });

  it('offers an account-scoped original card download only when source bytes exist', async () => {
    characters = [{ ...character, sourceHash: 'a'.repeat(64) }];
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '配置' }));
    const summary = await screen.findByRole('dialog', { name: '配置' });
    const link = await within(summary).findByRole('link', { name: '下载原始角色卡' });
    expect(link).toHaveAttribute('href', '/api/me/tavern/characters/character-1/source');
  });

  it('edits the active message through the revisioned graph without deleting old history', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '编辑当前消息' }));
    const editor = screen.getByLabelText('编辑消息内容');
    await user.clear(editor); await user.type(editor, '茶已经凉了。');
    await user.click(screen.getByRole('button', { name: '保存编辑' }));
    expect(await screen.findByText('茶已经凉了。')).toBeInTheDocument();
    expect(screen.queryByText('请用茶。')).not.toBeInTheDocument();
    expect(savedDetail.graph.messages.some(message => message.content === '请用茶。')).toBe(true);
    const action = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/actions') && init?.method === 'POST')?.[1];
    expect(JSON.parse(action?.body as string)).toMatchObject({ expectedRevision: 1,
      action: { type: 'edit', messageId: 'message-assistant-1', replacementContent: '茶已经凉了。' } });
  });

  it('uses the same revisioned graph endpoint for swipe, branches and checkpoints', async () => {
    savedDetail.graph.messages.push({ ...savedDetail.graph.messages[2], messageId: 'message-assistant-2', content: '另一杯茶。' });
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '下一个回复' }));
    expect(await screen.findByText('另一杯茶。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '历史与分支' }));
    await user.type(screen.getByLabelText('分支或检查点名称'), '茶馆岔路');
    await user.click(screen.getByRole('button', { name: '创建分支' }));
    expect(await screen.findByRole('option', { name: '茶馆岔路' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('分支或检查点名称'));
    await user.type(screen.getByLabelText('分支或检查点名称'), '喝茶前');
    await user.click(screen.getByRole('button', { name: '保存检查点' }));
    expect(await screen.findByText('喝茶前')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '从喝茶前回档' }));
    expect(await screen.findByRole('option', { name: '喝茶前 · 回档' })).toBeInTheDocument();
    const actionCalls = fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/actions') && init?.method === 'POST');
    expect(actionCalls.map(([, init]) => JSON.parse(init?.body as string).action.type))
      .toEqual(['select_alternative', 'create_branch', 'create_checkpoint', 'create_branch']);
  });

  it('creates a branch from a selected assistant ancestor instead of forcing the current leaf', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '历史与分支' }));
    await user.selectOptions(screen.getByLabelText('分支起点'), 'message-opening');
    await user.type(screen.getByLabelText('分支或检查点名称'), '从开场分叉');
    await user.click(screen.getByRole('button', { name: '创建分支' }));

    const actionCalls = fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/actions') && init?.method === 'POST');
    expect(JSON.parse(actionCalls[actionCalls.length - 1]?.[1]?.body as string)).toMatchObject({
      expectedRevision: 1,
      action: { type: 'create_branch', anchorMessageId: 'message-opening', name: '从开场分叉', activate: true },
    });
    expect(await screen.findByText('你好，小明！')).toBeInTheDocument();
    expect(screen.queryByText('请用茶。')).not.toBeInTheDocument();
  });

  it('retains a newly created conversation when a previous list read resolves late', async () => {
    const user = userEvent.setup(); const { client } = renderPage();
    await screen.findByRole('button', { name: '选择角色 旅人' });
    let resolveList!: (response: Response) => void;
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/me/tavern/conversations');
      return new Promise<Response>(resolve => { resolveList = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'tavern', 'conversations'] }); });
    await user.click(screen.getByRole('button', { name: '选择角色 旅人' }));
    await screen.findByLabelText('消息');
    await act(async () => { resolveList(json({ conversations: [] })); await refresh; });
    expect(client.getQueryData<Conversation[]>(['me', 'player-1', 'tavern', 'conversations'])).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '配置' }));
    expect(screen.getByRole('option', { name: '旅人的茶馆 · 小明' })).toBeInTheDocument();
  });

  it('restores the selected persisted conversation and completed history without regenerating its greeting', async () => {
    restoreConversation(); renderPage();
    const log = await screen.findByRole('log', { name: '对话消息' });
    expect(await within(log).findByText('你好，小明！')).toBeInTheDocument();
    expect(within(log).getByText('来杯茶')).toBeInTheDocument();
    expect(within(log).getByText('请用茶。')).toBeInTheDocument();
    expect(attempts).toHaveLength(0);
  });

  it('regenerates and continues through the same generation stream', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    const log = await screen.findByRole('log', { name: '对话消息' });
    await within(log).findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '重新生成' }));
    expect(await screen.findByText('重新斟茶。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续' }));
    await waitFor(() => expect(attempts).toHaveLength(2));
    const articles = within(log).getAllByRole('article');
    expect(articles).toHaveLength(3);
    expect(articles[2]).toHaveTextContent('重新斟茶。 夜色更深。');
    expect(attempts.map(attempt => attempt.action.type)).toEqual(['regenerate', 'continue']);
    expect(attempts.map(attempt => attempt.expectedRevision)).toEqual([1, 2]);
    expect(screen.getByRole('button', { name: '重新生成' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '编辑当前消息' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '继续' })).toBeEnabled();
    const generationUrls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
      .map(([url]) => url).filter(url => url.endsWith('/turns'));
    expect(generationUrls).toEqual([
      '/api/me/tavern/conversations/conversation-1/turns',
      '/api/me/tavern/conversations/conversation-1/turns',
    ]);
  });

  it('orders swipe candidates by generation history instead of graph UUID order', async () => {
    restoreConversation();
    const original = savedDetail.graph.messages.find(item => item.messageId === 'message-assistant-1')!;
    const alternative = { ...original, messageId: '00000000-newer-alternative', content: '较新的回复。' };
    savedDetail = {
      ...savedDetail,
      generations: [...savedDetail.generations, {
        ...savedDetail.generations[0], generationId: 'turn-2', clientActionId: 'regenerate-2',
        intent: 'regenerate', outputMessageId: alternative.messageId, createdAt: '2026-09-22T00:02:00Z',
      }],
      graph: {
        ...savedDetail.graph,
        revision: 2,
        activePath: ['message-opening', 'message-user-1', alternative.messageId],
        messages: [alternative, ...savedDetail.graph.messages],
        branches: savedDetail.graph.branches.map(branch => ({ ...branch, leafMessageId: alternative.messageId })),
      },
    };

    renderPage();

    expect(await screen.findByText('较新的回复。')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一个回复' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下一个回复' })).toBeDisabled();
  });

  it('can discard an interrupted regenerate instead of trapping the conversation in retry mode', async () => {
    restoreConversation(); failFirstTurn = true; const user = userEvent.setup(); renderPage();
    await screen.findByText('请用茶。');
    await user.click(screen.getByRole('button', { name: '重新生成' }));
    expect(await screen.findByRole('button', { name: '重试这条消息' })).toBeInTheDocument();
    expect(screen.getByLabelText('消息')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '取消本次重试' }));

    expect(screen.queryByRole('button', { name: '重试这条消息' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('消息')).toBeEnabled();
    expect(window.sessionStorage.getItem('mapflow.tavern.pending.v1.player-1.conversation-1')).toBeNull();
  });

  it('keeps a stable clientTurnId across a failed stream and retry, replaces the draft and refreshes balance', async () => {
    restoreConversation(); failFirstTurn = true; const user = userEvent.setup(); const { client } = renderPage();
    await user.type(await screen.findByLabelText('消息'), '新的问题');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('button', { name: '重试这条消息' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('尚未确认保存');
    await user.click(screen.getByRole('button', { name: '重试这条消息' }));
    expect(await screen.findByText('新回复 🌙')).toBeInTheDocument();
    expect(screen.queryByText('未完成草稿')).not.toBeInTheDocument();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(client.getQueryData(['me', 'player-1', 'credit'])).toMatchObject({ balance: 9.9998 });
  });

  it('explains a model outage, preserves the retry identity and can return the failed input to editing', async () => {
    restoreConversation(); modelUnavailable = true; const user = userEvent.setup(); const { client } = renderPage();
    await user.type(await screen.findByLabelText('消息'), '保留这条消息');
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/模型连接暂不可用/)).toBeInTheDocument();
    expect(savedDetail.turns).toHaveLength(1);
    expect(client.getQueryData(['me', 'player-1', 'credit'])).toMatchObject({ balance: 10 });
    await user.click(screen.getByRole('button', { name: '重试这条消息' }));
    await waitFor(() => expect(attempts).toHaveLength(2));
    expect(attempts[1].clientActionId).toBe(attempts[0].clientActionId);
    await user.click(await screen.findByRole('button', { name: '取消本次重试' }));
    expect(screen.getByLabelText('消息')).toHaveValue('保留这条消息');
    expect(screen.getByLabelText('消息')).toBeEnabled();
  });

  it('restores an unconfirmed turn after remount and retains its retry identifier', async () => {
    restoreConversation(); failFirstTurn = true; const user = userEvent.setup(); const first = renderPage();
    await user.type(await screen.findByLabelText('消息'), '恢复后重试');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByRole('button', { name: '重试这条消息' });
    first.unmount(); renderPage();
    await user.click(await screen.findByRole('button', { name: '重试这条消息' }));
    expect(await screen.findByText('新回复 🌙')).toBeInTheDocument();
    expect(attempts[1].clientActionId).toBe(attempts[0].clientActionId);
  });

  it('uses generation audit records rather than compatibility turns to clear recovered pending actions', async () => {
    restoreConversation(); savedDetail = { ...savedDetail, turns: [] };
    window.sessionStorage.setItem('mapflow.tavern.pending.v1.player-1.conversation-1', JSON.stringify({
      clientActionId: 'client-turn-1', action: { type: 'reply', message: '来杯茶' },
    }));
    renderPage();
    await screen.findByText('请用茶。');
    expect(screen.queryByRole('button', { name: '重试这条消息' })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('mapflow.tavern.pending.v1.player-1.conversation-1')).toBeNull();
  });

  it('keeps a committed reply when an older background history read arrives after completed', async () => {
    restoreConversation(); const user = userEvent.setup(); const { client } = renderPage();
    await screen.findByLabelText('消息');
    let resolveHistory!: (response: Response) => void;
    const oldHistory = structuredClone(savedDetail);
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/me/tavern/conversations/conversation-1');
      return new Promise<Response>(resolve => { resolveHistory = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'tavern', 'conversation', 'conversation-1'] }); });
    await user.type(screen.getByLabelText('消息'), '刚保存的问题');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByText('新回复 🌙');
    await act(async () => { resolveHistory(json(oldHistory)); await refresh; });
    expect(client.getQueryData<ConversationDetail>(['me', 'player-1', 'tavern', 'conversation', 'conversation-1'])?.turns).toHaveLength(2);
    expect(screen.getByText('新回复 🌙')).toBeInTheDocument();
    expect(screen.getByText('刚保存的问题')).toBeInTheDocument();
  });

  it('keeps the committed balance when an older credit refresh finishes after completed', async () => {
    restoreConversation(); const user = userEvent.setup(); const { client } = renderPage();
    await screen.findByLabelText('消息');
    await waitFor(() => expect(client.getQueryData(['me', 'player-1', 'credit'])).toMatchObject({ balance: 10 }));
    let resolveCredit!: (response: Response) => void;
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/credit/me');
      return new Promise<Response>(resolve => { resolveCredit = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'credit'] }); });
    await user.type(screen.getByLabelText('消息'), '更新余额');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByText('新回复 🌙');
    await act(async () => { resolveCredit(json({ balance: 10, signedInToday: true, freeRemaining: 0, pricePerTree: 1 })); await refresh; });
    expect(client.getQueryData(['me', 'player-1', 'credit'])).toMatchObject({ balance: 9.9998 });
  });

  it('allows mobile drawers to switch between library and immutable details, and reuses theme switching', async () => {
    restoreConversation(); const user = userEvent.setup(); renderPage();
    await screen.findByLabelText('消息');
    await user.click(screen.getByRole('button', { name: '打开角色列表' }));
    let drawer = screen.getByRole('dialog', { name: '功能菜单' });
    expect(within(drawer).getByRole('button', { name: '选择角色 旅人' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '配置' }));
    drawer = screen.getByRole('dialog', { name: '配置' });
    expect(within(drawer).getByLabelText('Persona（可选）')).toHaveValue('旅行者');
    await user.keyboard('{Escape}');
    await user.selectOptions(screen.getByLabelText('选择主题'), 'ivory');
    expect(document.documentElement.dataset.mapflowTheme).toBe('ivory');
  });

  it('shows recoverable library failures and does not discard the saved selection when a read fails', async () => {
    restoreConversation();
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { code: 'tavern.runtime_unavailable', message: '暂时不可用' } }), { status: 503 }));
    renderPage();
    await screen.findByRole('alert');
    expect(window.localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBe('conversation-1');
  });
});
