import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityProvider } from '../identity/IdentityContext';
import TavernPage from './TavernPage';
import { character, completion, conversation, detail, sseResponse, turn } from './testFixtures';
import type { Character, Conversation, ConversationDetail } from './types';

vi.mock('../identity/identityClient', async importOriginal => ({
  ...await importOriginal<typeof import('../identity/identityClient')>(),
  fetchCurrentSession: () => Promise.resolve({ account: { playerId: 'player-1', username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' }),
  fetchCapabilities: () => Promise.resolve({ identity: { registrationEnabled: true }, generation: { enabled: true, platformFundedEnabled: true, models: [], thinkingModes: [], reasoningEfforts: [] } }),
}));

let characters: Character[];
let conversations: Conversation[];
let savedDetail: ConversationDetail;
let attempts: { clientTurnId: string; message: string }[];
let failFirstTurn: boolean;
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown) => new Response(JSON.stringify(body));

beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  characters = [structuredClone(character)]; conversations = []; savedDetail = structuredClone(detail);
  attempts = []; failFirstTurn = false;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/credit/me') return json({ balance: 10, signedInToday: true, freeRemaining: 0, pricePerTree: 1 });
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
      conversations = [created]; savedDetail = { character, conversation: created, turns: [] }; return json(created);
    }
    if (url === '/api/me/tavern/conversations') return json({ conversations });
    if (url === '/api/me/tavern/conversations/conversation-1') return json(savedDetail);
    if (url === '/api/me/tavern/conversations/conversation-1/turns' && init?.method === 'POST') {
      const input = JSON.parse(init.body as string); attempts.push(input);
      if (failFirstTurn && attempts.length === 1) return sseResponse([{ event: 'delta', payload: { delta: '未完成草稿' } }]);
      const savedTurn = { ...turn, turnId: `turn-${input.clientTurnId}`, clientTurnId: input.clientTurnId, userMessage: input.message, assistantMessage: '新回复 🌙' };
      savedDetail = { ...savedDetail, turns: [...savedDetail.turns.filter(item => item.clientTurnId !== input.clientTurnId), savedTurn] };
      return sseResponse([{ event: 'delta', payload: { delta: '新回复' } }, { event: 'completed', payload: { ...completion, turn: savedTurn } }]);
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

describe('Tavern page', () => {
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

  it('creates ordinary conversations with optional persona/vocabulary omitted and an alternate greeting', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '新建会话' }));
    expect(screen.getByLabelText('用户称呼')).toHaveValue('小明');
    await user.selectOptions(screen.getByLabelText('开场白'), '1');
    await user.click(screen.getByRole('button', { name: '开始对话' }));
    expect(await screen.findByText('夜深了，小明。')).toBeInTheDocument();
    const create = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/conversations') && init?.method === 'POST')?.[1];
    expect(JSON.parse(create?.body as string)).toEqual({ characterId: 'character-1', userName: '小明', greetingIndex: 1 });
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
    expect(screen.getByRole('button', { name: '新建会话' })).toBeDisabled();
  });

  it('binds learning vocabulary and persona once and exposes immutable conversation details', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: '新建会话' }));
    await user.type(screen.getByLabelText('Persona（可选）'), '旅行者');
    fireEvent.change(screen.getByLabelText('学习词表（可选）'), { target: { value: 'tea\t茶\nquiet — 安静' } });
    await user.click(screen.getByRole('button', { name: '开始对话' }));
    const summary = await screen.findByRole('complementary', { name: '会话详情' });
    expect(within(summary).getByText('旅行者')).toBeInTheDocument();
    expect(within(summary).getByText(/tea/)).toBeInTheDocument();
    expect(within(summary).queryByRole('textbox')).toBeNull();
    expect(savedDetail.conversation.vocabulary).toEqual([{ term: 'tea', meaning: '茶' }, { term: 'quiet', meaning: '安静' }]);
  });

  it('retains a newly created conversation when a previous list read resolves late', async () => {
    const user = userEvent.setup(); const { client } = renderPage();
    await user.click(await screen.findByRole('button', { name: '新建会话' }));
    let resolveList!: (response: Response) => void;
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe('/api/me/tavern/conversations');
      return new Promise<Response>(resolve => { resolveList = resolve; });
    });
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['me', 'player-1', 'tavern', 'conversations'] }); });
    await user.click(screen.getByRole('button', { name: '开始对话' }));
    await screen.findByLabelText('消息');
    await act(async () => { resolveList(json({ conversations: [] })); await refresh; });
    expect(client.getQueryData<Conversation[]>(['me', 'player-1', 'tavern', 'conversations'])).toHaveLength(1);
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

  it('restores an unconfirmed turn after remount and retains its retry identifier', async () => {
    restoreConversation(); failFirstTurn = true; const user = userEvent.setup(); const first = renderPage();
    await user.type(await screen.findByLabelText('消息'), '恢复后重试');
    await user.click(screen.getByRole('button', { name: '发送' }));
    await screen.findByRole('button', { name: '重试这条消息' });
    first.unmount(); renderPage();
    await user.click(await screen.findByRole('button', { name: '重试这条消息' }));
    expect(await screen.findByText('新回复 🌙')).toBeInTheDocument();
    expect(attempts[1].clientTurnId).toBe(attempts[0].clientTurnId);
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
    await user.click(screen.getByRole('button', { name: '打开会话详情' }));
    drawer = screen.getByRole('dialog', { name: '功能菜单' });
    expect(within(drawer).getByText('旅行者')).toBeInTheDocument();
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
