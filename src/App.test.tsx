import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { detail as tavernDetail, character as tavernCharacter } from './features/tavern/testFixtures';
import {
  IdentityProvider,
  SESSION_QUERY_KEY,
} from './features/identity/IdentityContext';
let savedLearningChat: typeof tavernDetail;
const nativeApi=vi.hoisted(()=>({fetchAgentModelCatalogue:vi.fn(),fetchActiveAgentExecution:vi.fn(),acceptAgentExecution:vi.fn()}));
vi.mock('./api/agentExecutionClient',async original=>({...await original<typeof import('./api/agentExecutionClient')>(),...nativeApi}));
it('enters standalone tavern through shared native cash/points/user-key controls',async()=>{
  renderApp('/tavern');expect(await screen.findByLabelText('资金通路')).toBeInTheDocument();
  expect(tavernApi.generateStream).not.toHaveBeenCalled();
});

it('desktop assistant uses one toolbar for history, new, model, canvas and configuration', async () => {
  window.innerWidth = 1440;
  renderApp('/assistant');
  await screen.findByRole('textbox', { name: '消息' });
  const toolbar = screen.getByRole('toolbar', { name: '对话操作' });
  expect(screen.getAllByRole('toolbar', { name: '对话操作' })).toHaveLength(1);
  expect(within(toolbar).getByRole('button', { name: '打开会话列表' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '新建会话' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '配置' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: /展开画布|绘图讲解/ })).toBeInTheDocument();
  expect(screen.getByLabelText('资金通路').closest('[role="toolbar"]')).toBe(toolbar);
});

it('1024 px desktop folds model controls into more while preserving the input draft', async () => {
  window.innerWidth = 1024;
  renderApp('/assistant');
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: '消息' }), '窗口变窄也保留');
  const toolbar = screen.getByRole('toolbar', { name: '对话操作' });
  expect(screen.queryByRole('combobox', { name: '资金通路' })).not.toBeInTheDocument();
  await user.click(within(toolbar).getByRole('button', { name: '更多会话操作' }));
  const menu = screen.getByRole('navigation', { name: '会话更多操作' });
  expect(within(menu).getByRole('combobox', { name: '资金通路' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('窗口变窄也保留');
});

const identityApi = vi.hoisted(() => ({
  fetchCapabilities: vi.fn(),
  fetchCurrentSession: vi.fn(),
  loginIdentity: vi.fn(),
  logoutIdentity: vi.fn(),
  registerIdentity: vi.fn(),
}));

const treeApi = vi.hoisted(() => ({
  addTreeToPersonalLibrary: vi.fn(),
  deletePersonalTree: vi.fn(),
  fetchPersonalLibrary: vi.fn(),
  fetchPersonalTree: vi.fn(),
  fetchPublicTree: vi.fn(),
  fetchPublicTrees: vi.fn(),
  renamePersonalTree: vi.fn(),
  setNodeCompletion: vi.fn(),
  setNodeProgress: vi.fn(),
}));

const generationApi = vi.hoisted(() => ({
  readPlatformGenerationEntitlements: vi.fn(),
}));

const legacyApi = vi.hoisted(() => ({ fetchLearningTree: vi.fn() }));

const walletApi = vi.hoisted(() => ({ readWallet: vi.fn(), readModelPricing: vi.fn(), readAdminTopups: vi.fn() }));
vi.mock('./api/walletClient', async importOriginal => ({ ...await importOriginal<typeof import('./api/walletClient')>(), ...walletApi }));

const tavernApi = vi.hoisted(() => ({ fetchCharacters: vi.fn(), fetchConversations: vi.fn(), fetchConversationHistory: vi.fn(), deleteConversation: vi.fn(), fetchLearningAreas: vi.fn(), createLearningArea: vi.fn(), fetchLearningAreaConversations: vi.fn(), openTreeConversation: vi.fn(), openManagementConversation:vi.fn(),fetchConversation: vi.fn(),
  generateStream: vi.fn(),fetchPlatformModels: vi.fn(),requestCashQuote:vi.fn(),resolveTavernToolApproval:vi.fn() }));
vi.mock('./api/tavernClient', () => tavernApi);

const chatApi = vi.hoisted(() => ({
  fetchKnowledgeChatHistory: vi.fn(),
  sendKnowledgeChatMessageStream: vi.fn(),
}));

const flowLifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
}));

const adminApi = vi.hoisted(() => ({
  fetchAdminDashboard: vi.fn(),
  fetchAdminAccounts: vi.fn(),
  fetchAdminInvitations: vi.fn(),
  fetchAdminAuditEvents: vi.fn(),
  fetchAdminAuditEventsPage: vi.fn(),
  suspendAdminAccount: vi.fn(),
  revokeAdminInvitation: vi.fn(),
}));

vi.mock('./api/identityClient', () => identityApi);
vi.mock('./api/treeLibraryClient', () => treeApi);
vi.mock('./api/treeGenerationClient', () => generationApi);
vi.mock('./api/adminClient', () => adminApi);
vi.mock('./lib/api', () => legacyApi);
vi.mock('./api/knowledgeChatClient', () => chatApi);

const announcementsApi = vi.hoisted(() => ({ getAnnouncements: vi.fn() }));

vi.mock('./api/announcementsClient', () => announcementsApi);
vi.mock('./features/tree-generation/TreeGenerationDialog', () => ({
  default: ({
    sessionId,
    onSessionIdChange,
    onComplete,
    onClose,
  }: {
    sessionId: string | null;
    onSessionIdChange: (sessionId: string) => void;
    onComplete: (libraryEntryId: string) => void;
    onClose: () => void;
  }) => (
    <section role="dialog" aria-label="mock tree generator">
      <span>{sessionId ?? 'new-generation-session'}</span>
      <button type="button" onClick={() => onSessionIdChange('generation-session-1')}>
        保存生成会话
      </button>
      <button
        type="button"
        data-testid="complete-generation"
        onClick={() => onComplete('33333333-3333-4333-8333-333333333333')}
      >
        完成生成
      </button>
      <button type="button" onClick={onClose}>
        关闭生成器
      </button>
    </section>
  ),
}));
vi.mock('@xyflow/react', async () => {
  const React = await import('react');

  interface FlowNode {
    id: string;
    type?: string;
    data: {
      node?: { title: string };
      progress?: { status: string } | null;
      displayMode?: string;
      name?: string;
    };
  }

  function useNodesState<Node>(initial: Node[]) {
    const [nodes, setNodes] = React.useState(initial);
    return [nodes, setNodes, () => undefined] as const;
  }

  function useEdgesState<Edge>(initial: Edge[]) {
    const [edges, setEdges] = React.useState(initial);
    return [edges, setEdges, () => undefined] as const;
  }

  function useNodesInitialized() {
    return true;
  }

  function ReactFlow({
    nodes,
    onNodeClick,
    children,
  }: {
    nodes: FlowNode[];
    onNodeClick?: (event: React.MouseEvent, node: FlowNode) => void;
    children?: React.ReactNode;
  }) {
    React.useEffect(() => {
      flowLifecycle.mounts += 1;
      return () => {
        flowLifecycle.unmounts += 1;
      };
    }, []);

    return (
      <div data-testid="react-flow-boundary">
        {nodes.map((node) =>
          node.type === 'block' ? (
            <div key={node.id} data-mapflow-block-lane="true">
              {node.data.name}
            </div>
          ) : (
            <button
              key={node.id}
              type="button"
              aria-label={`查看节点 ${node.data.node?.title ?? node.id}`}
              data-status={node.data.progress?.status ?? 'not_started'}
              data-display-mode={node.data.displayMode}
              onClick={(event) => onNodeClick?.(event, node)}
            >
              {node.data.node?.title ?? node.id}
            </button>
          ),
        )}
        {children}
      </div>
    );
  }

  return {
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    MiniMap: () => null,
    Position: { Bottom: 'bottom', Top: 'top' },
    ReactFlow,
    useEdgesState,
    useNodesInitialized,
    useNodesState,
  };
});

const authenticated = {
  account: {
    playerId: 'MF-7K3P-9D2Q-X8CW',
    username: 'firstuser',
    status: 'active' as const,
    isAdmin: false,
  },
  csrfToken: 'csrf-secret',
};

const secondAccount = {
  account: {
    playerId: 'MF-2B4N-6Q8R-T1VX',
    username: 'seconduser',
    status: 'active' as const,
    isAdmin: false,
  },
  csrfToken: 'second-csrf-secret',
};

const adminAccount = {
  account: {
    playerId: 'MF-9JX4-QK7M-W2BZ',
    username: 'adminuser',
    status: 'active' as const,
    isAdmin: true,
  },
  csrfToken: 'admin-csrf-secret',
};

beforeEach(() => {
  for(const mock of Object.values(nativeApi))mock.mockReset();
  const model={profileId:'learning-profile',profileVersion:1,modelId:'learning-model',displayName:'learning-model',contextWindow:131072,maxOutputTokens:null};
  nativeApi.fetchAgentModelCatalogue.mockResolvedValue({cash:[model],defaultCash:model,points:null});
  nativeApi.fetchActiveAgentExecution.mockResolvedValue(null);
  nativeApi.acceptAgentExecution.mockImplementation(async(conversationId:string,command:import('./api/agentExecutionClient').AgentExecutionCommand)=>{
    const user={messageId:'55555555-5555-4555-8555-555555555555',parentMessageId:'message-assistant-1',role:'user' as const,origin:'user' as const,characterId:null,content:command.action.type==='reply'?command.action.message:''};
    const assistant={messageId:'44444444-4444-4444-8444-444444444444',parentMessageId:user.messageId,role:'assistant' as const,origin:'model' as const,characterId:tavernCharacter.characterId,content:'测试回答'};
    savedLearningChat={...savedLearningChat,graph:{...tavernDetail.graph,revision:2,messages:[...tavernDetail.graph.messages,user,assistant],activePath:[...tavernDetail.graph.activePath,user.messageId,assistant.messageId]}};
    const executionId='22222222-2222-4222-8222-222222222222';
    return {replayed:false,execution:{executionId,conversationId,state:'succeeded',funding:command.funding,modelId:model.modelId,error:null,
      result:{executionId,conversationId,generationId:'33333333-3333-4333-8333-333333333333',messageId:assistant.messageId,answer:assistant.content,maps:[],usage:null,
        settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}}}};
  });
  window.innerWidth = 1024;
  for (const mock of Object.values(identityApi)) mock.mockReset();
  for (const mock of Object.values(treeApi)) mock.mockReset();
  for (const mock of Object.values(adminApi)) mock.mockReset();
  legacyApi.fetchLearningTree.mockReset();
  chatApi.fetchKnowledgeChatHistory.mockReset();
  chatApi.fetchKnowledgeChatHistory.mockResolvedValue({ messages: [] });
  chatApi.sendKnowledgeChatMessageStream.mockReset();
  chatApi.sendKnowledgeChatMessageStream.mockImplementation(
    (
      _libraryEntryId: string,
      _message: string,
      _clientTurnId: string,
      _csrfToken: string,
      onDelta: (delta: string) => void,
    ) => {
      onDelta('测试');
      return Promise.resolve({
        answer: '测试回答',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheHitInputTokens: 0,
          cacheMissInputTokens: 10,
        },
        chargedCredits: 0.2,
      });
    },
  );
  announcementsApi.getAnnouncements.mockReset();
  announcementsApi.getAnnouncements.mockResolvedValue({ items: [], unreadCount: 0 });
  flowLifecycle.mounts = 0;
  flowLifecycle.unmounts = 0;
  adminApi.fetchAdminDashboard.mockResolvedValue({
    registeredAccounts: 12,
    availableInvites: 3,
    redeemedInvites: 9,
    revokedInvites: 1,
    activeSessions: 7,
    platformConsumedUsages: 42,
    platformConsumedTokens: 123456,
    loginTrend7d: [{ date: '2026-08-19', activeAccounts: 3 }],
    currentOnline: 1,
    consecutive3dLogins: 0,
    totalActiveMinutes: 60,
    avgActiveMinutes: 60,
    dailyConsumed7d: [{ date: '2026-08-19', consumed: 1 }],
  });

  identityApi.fetchCapabilities.mockResolvedValue({
    identity: { registrationEnabled: true },
    generation: {
      enabled: true,
      platformFundedEnabled: true,
      models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      thinkingModes: ['disabled', 'enabled'],
      reasoningEfforts: ['low', 'high', 'max'],
    },
  });
  identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
  treeApi.fetchPublicTrees.mockResolvedValue({ trees: [nestjsTree, agentTree] });
  treeApi.fetchPublicTree.mockImplementation((treeId: string) =>
    Promise.resolve({
      view_mode: 'showcase',
      graph: treeId === agentTree.id ? agentGraph : nestjsGraph,
    }),
  );
  treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
  generationApi.readPlatformGenerationEntitlements.mockResolvedValue({
    totalGranted: 3,
    available: 3,
    reserved: 0,
    consumed: 0,
    activePlatformSessionId: null,
    platformModeAvailable: true,
  });
  legacyApi.fetchLearningTree.mockResolvedValue(legacySnapshot);
  walletApi.readWallet.mockResolvedValue({ balanceMicros: 3_100_000, currency: 'CNY', supportContact: '', channels: [], topups: [], ledger: [] });
  walletApi.readModelPricing.mockResolvedValue({ multiplierLabel: '0.2倍率', currency: 'CNY', updatedAt: '2026-10-01', models: [] });
  walletApi.readAdminTopups.mockResolvedValue({ topups: [], pendingCount: 0 });
  window.localStorage.clear();
  tavernApi.fetchCharacters.mockReset().mockResolvedValue([]);
  tavernApi.fetchConversations.mockReset().mockResolvedValue([]);
  tavernApi.fetchLearningAreaConversations.mockReset().mockResolvedValue([]);
  tavernApi.fetchConversationHistory.mockReset().mockImplementation(async (signal, scene, areaId) => {
    const conversations = areaId ? await tavernApi.fetchLearningAreaConversations(areaId, signal) : await tavernApi.fetchConversations(signal, scene);
    return { conversations, bootstrapState: conversations.length ? 'has_active' : 'never_created' };
  });
  savedLearningChat = structuredClone(tavernDetail);
  tavernApi.fetchLearningAreas.mockReset().mockResolvedValue([]);
  tavernApi.createLearningArea.mockReset().mockImplementation(async (entry: string) => ({ areaId: entry, libraryEntryId: entry,
    title: personalEntry.tree.title, available: true, createdAt: '2026-10-11T00:00:00Z' }));
  tavernApi.openTreeConversation.mockReset().mockImplementation(async (entry: string) => ({ ...savedLearningChat,
    conversation: { ...savedLearningChat.conversation, scene: 'learning', learningAreaId: entry, libraryEntryId: entry, treeToolsEnabled: true } }));
  const managementId='77777777-7777-4777-8777-777777777777';
  const managementChat={...savedLearningChat,conversation:{...savedLearningChat.conversation,conversationId:managementId,scene:'management' as const,learningAreaId:undefined,libraryEntryId:undefined},graph:{...savedLearningChat.graph,conversationId:managementId}};
  tavernApi.openManagementConversation.mockReset().mockResolvedValue(managementChat);
  tavernApi.fetchConversation.mockReset().mockImplementation(async (id:string) => id===managementId?managementChat:({ ...savedLearningChat,
    conversation: { ...savedLearningChat.conversation, scene: 'learning', learningAreaId: personalEntry.library_entry_id, libraryEntryId: personalEntry.library_entry_id, treeToolsEnabled: true } }));
  tavernApi.fetchPlatformModels.mockReset().mockResolvedValue({ enabled:true,billingMode:'trial',models:[{id:'learning-model',provider:'AnyAI',contextWindow:32768}] });
  tavernApi.requestCashQuote.mockReset(); tavernApi.resolveTavernToolApproval.mockReset();
  tavernApi.generateStream.mockReset().mockImplementation(async (_id:string, clientActionId:string,_revision:number,action:{message:string}) => {
    const user={messageId:'chat-user',parentMessageId:'message-assistant-1',role:'user' as const,origin:'user' as const,characterId:null,content:action.message};
    const assistant={messageId:'chat-answer',parentMessageId:user.messageId,role:'assistant' as const,origin:'model' as const,characterId:tavernCharacter.characterId,content:'测试回答'};
    savedLearningChat = { ...savedLearningChat, graph: { ...tavernDetail.graph, revision: 2,
      messages: [...tavernDetail.graph.messages, user, assistant], activePath: [...tavernDetail.graph.activePath, user.messageId, assistant.messageId] } };
    return { turn:{turnId:'chat-turn',clientTurnId:clientActionId,userMessage:action.message,assistantMessage:'测试回答',usage:{inputTokens:1,outputTokens:1,cacheHitInputTokens:0,cacheMissInputTokens:0},chargedCreditUnits:0,createdAt:'2026-10-07T00:00:00Z'},
      graph:{...tavernDetail.graph,revision:2,messages:[...tavernDetail.graph.messages,user,assistant],activePath:[...tavernDetail.graph.activePath,user.messageId,assistant.messageId]},creditBalance:10,chargedCredits:0,idempotencyHit:false };
  });
  window.localStorage.setItem('mapflow.guide.public.v1.seen', 'true');
  window.history.replaceState({}, '', '/console');
});

afterEach(() => {
  cleanup();
});

describe('Four canonical pages', () => {
  it('opens the exact owned map requested by a saved assistant result',async()=>{
    const other='44444444-4444-4444-8444-444444444444';
    treeApi.fetchPersonalLibrary.mockResolvedValue({entries:[personalEntry,{...personalEntry,library_entry_id:other,tree:agentTree}]});
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp(`/maps?entry=${other}`);
    await waitFor(()=>expect(treeApi.fetchPersonalTree).toHaveBeenCalledWith(other));
    expect(treeApi.fetchPersonalTree).not.toHaveBeenCalledWith(personalEntry.library_entry_id);
  });
  it('does not read an unowned target or silently open a different map from an assistant deep link',async()=>{
    treeApi.fetchPersonalLibrary.mockResolvedValue({entries:[personalEntry]});
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/maps?entry=88888888-8888-4888-8888-888888888888');
    expect(await screen.findByText('指定地图暂不可用，请从我的地图重新选择。')).toBeInTheDocument();
    expect(treeApi.fetchPersonalTree).not.toHaveBeenCalled();
  });
  it('opens the global assistant for an authenticated root without replacing explicit legacy pages', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', {name:'全局助手'})).toBeInTheDocument();
    expect(window.location.pathname).toBe('/assistant');
    expect(screen.getByRole('button', {name:'全局助手',current:'page'})).toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();
  });
  it('opens the shared global assistant from learning management without opening an old generator', async () => {
    renderApp('/learning');
    fireEvent.click(await screen.findByRole('button',{name:'打开管理助手'}));
    await waitFor(()=>expect(window.location.pathname).toBe('/assistant'));
    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
  });
  it('replays the guide on every explicit click from the shared navigation', async () => {
    const user=userEvent.setup(); renderApp('/maps');
    for (let replay=0;replay<2;replay++) {
      await user.click(await screen.findByRole('button',{name:'查看引导'}));
      expect(await screen.findByTestId('public-map-guide')).toBeInTheDocument();
      await user.click(screen.getByRole('button',{name:'关闭引导'}));
      expect(screen.queryByTestId('public-map-guide')).not.toBeInTheDocument();
    }
  });
  it('shares a left business navigation across the console and independent tavern', async () => {
    const user = userEvent.setup(); renderApp('/maps');
    const navigation = await screen.findByRole('navigation', { name: '业务导航' });
    expect(within(navigation).getAllByRole('button').map(button => button.textContent)).toEqual([
      '全局助手', '公共书库', '我的地图', '学习聊天', '独立酒馆',
    ]);
    expect(screen.getByRole('navigation', { name: '辅助功能' })).toBeInTheDocument();
    await user.click(within(navigation).getByRole('button', { name: '独立酒馆' }));
    expect(window.location.pathname).toBe('/tavern');
    expect(screen.getByRole('navigation', { name: '业务导航' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('navigation', { name: '业务导航' })).getByRole('button', { name: '公共书库' }));
    expect(await screen.findByRole('textbox', { name: '搜索公共地图' })).toBeInTheDocument();
  });
  it('keeps model configuration available without creating or sending a conversation', async () => {
    const user = userEvent.setup(); renderApp('/maps');
    await user.click(await screen.findByRole('button', { name: '模型配置' }));
    const dialog = screen.getByRole('dialog', { name: '模型配置' });
    await user.type(within(dialog).getByLabelText('API Key'), 'sk-session-only');
    await user.type(within(dialog).getByLabelText('API URL'), 'https://models.example/v1');
    await user.type(within(dialog).getByLabelText('模型', { selector: 'input' }), 'my-model');
    await user.click(within(dialog).getByRole('button', { name: '保存并使用' }));
    await user.click(within(dialog).getByRole('button', { name: '关闭模型配置' }));
    await user.click(screen.getByRole('button', { name: '独立酒馆' }));
    await user.click(screen.getByRole('button', { name: '模型配置' }));
    expect(within(screen.getByRole('dialog', { name: '模型配置' })).getByLabelText('API Key')).toHaveValue('sk-session-only');
    expect(localStorage.getItem(`mapflow.tavern.model-preferences.v1.${authenticated.account.playerId}`)).toContain('my-model');
    expect(localStorage.getItem(`mapflow.tavern.model-preferences.v1.${authenticated.account.playerId}`)).not.toContain('sk-session-only');
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
    expect(tavernApi.openTreeConversation).not.toHaveBeenCalled();
  });
  it('searches personal maps without replacing the currently opened map', async () => {
    const secondEntry = { ...personalEntry, library_entry_id: '44444444-4444-4444-8444-444444444444', tree: agentTree };
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry, secondEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    const user = userEvent.setup(); renderApp('/maps');
    await screen.findByRole('button', { name: '查看 NestJS 完整学习树' });
    const search = screen.getByRole('textbox', { name: '搜索我的地图' });
    await user.type(search, 'Python');
    expect(screen.queryByRole('button', { name: '查看 NestJS 完整学习树' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看 Python Agent 完整学习树' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看节点 基础节点' })).toBeInTheDocument();
    expect(treeApi.fetchPersonalTree).toHaveBeenCalledTimes(1);
    await user.clear(search);
    expect(screen.getByRole('button', { name: '查看 NestJS 完整学习树' })).toBeInTheDocument();
  });
  it('does not redirect a newer page when a delayed map-area join completes', async () => {
    let finish!: (value: { areaId: string; libraryEntryId: string; title: string; available: boolean; createdAt: string }) => void;
    tavernApi.createLearningArea.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    const user = userEvent.setup(); renderApp('/maps');
    await user.click(await screen.findByRole('button', { name: '查看节点 基础节点' }));
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));
    await user.click(screen.getByRole('button', { name: '公共书库' }));
    await screen.findByRole('textbox', { name: '搜索公共地图' });
    finish({ areaId: personalEntry.library_entry_id, libraryEntryId: personalEntry.library_entry_id,
      title: personalEntry.tree.title, available: true, createdAt: '2026-10-11T00:00:00Z' });
    await waitFor(() => expect(screen.queryByText('正在准备学习区…')).not.toBeInTheDocument());
    expect(window.location.pathname).toBe('/library');
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });
  it('removes a staged node from the URL as well as the visible composer', async () => {
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId: personalEntry.library_entry_id,
      libraryEntryId: personalEntry.library_entry_id, title: personalEntry.tree.title, available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    const user = userEvent.setup(); renderApp('/maps');
    await user.click(await screen.findByRole('button', { name: '查看节点 基础节点' }));
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));
    await user.click(await screen.findByRole('button', { name: '移除节点参考' }));
    expect(new URLSearchParams(window.location.search).has('node')).toBe(false);
    expect(new URLSearchParams(window.location.search).get('area')).toBe(personalEntry.library_entry_id);
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });
  it('restores the learning page through the legacy console entry', async () => {
    localStorage.setItem(`mapflow.console.state.v1.${authenticated.account.playerId}`, JSON.stringify({
      version: 1, view: 'learning', selectedPublicTreeId: null, selectedLibraryEntryId: null,
      selectedNodeId: null, layoutMode: 'relationship', mobileView: 'list', chatOpen: false,
    }));
    renderApp('/console');
    expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
    expect(treeApi.fetchPersonalTree).not.toHaveBeenCalled();
  });
  it('keeps canonical navigation consistent after returning from administration', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    const user = userEvent.setup(); renderApp('/learning');
    await screen.findByRole('region', { name: '学习区选择' });
        await user.click(screen.getByRole('button', { name: '管理面板' }));
    await screen.findByRole('heading', { name: '管理面板' });
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(window.location.pathname).toBe('/maps');
    expect(await screen.findByRole('button', { name: '我的地图' })).toHaveAttribute('aria-current', 'page');
  });
  it('opens the learning selection page without reading full maps or starting a conversation', async () => {
    renderApp('/learning');
    expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
    expect(treeApi.fetchPersonalTree).not.toHaveBeenCalled();
    expect(treeApi.fetchPublicTree).not.toHaveBeenCalled();
    expect(tavernApi.openTreeConversation).not.toHaveBeenCalled();
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });
  it('opens maps as a dedicated page and offers all four destinations', async () => {
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    const user = userEvent.setup(); renderApp('/maps');
    expect(await screen.findByRole('button', { name: '查看 NestJS 完整学习树' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的地图' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '公共书库' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学习聊天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '独立酒馆' })).toBeInTheDocument();
    expect(tavernApi.openTreeConversation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '学习聊天' }));
    expect(window.location.pathname).toBe('/learning');
    expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
  });
  it('keeps public search and filters on the canonical library page', async () => {
    renderApp('/library');
    expect(await screen.findByRole('textbox', { name: '搜索公共地图' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '来源' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '公共书库' })).toHaveAttribute('aria-current', 'page');
    expect(tavernApi.openTreeConversation).not.toHaveBeenCalled();
  });
  it('joins the selected node area before navigation and never sends its staged question', async () => {
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId: personalEntry.library_entry_id,
      libraryEntryId: personalEntry.library_entry_id, title: personalEntry.tree.title, available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    const user = userEvent.setup(); renderApp('/maps');
    await user.click(await screen.findByRole('button', { name: '查看节点 基础节点' }));
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));
    await waitFor(() => expect(tavernApi.createLearningArea).toHaveBeenCalledWith(personalEntry.library_entry_id, authenticated.csrfToken));
    expect(window.location.pathname).toBe('/learning');
    expect(await screen.findByRole('navigation', { name: '当前学习区' })).toHaveTextContent('NestJS');
    expect(await screen.findByText('节点参考：基础节点')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
    expect(chatApi.sendKnowledgeChatMessageStream).not.toHaveBeenCalled();
  });
});

describe('Cash quota and compact navigation', () => {
  it('preserves the learning origin when moving between model pricing and wallet', async () => {
    const address = `/learning?area=${personalEntry.library_entry_id}&node=node-1&title=Original`;
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId: personalEntry.library_entry_id, libraryEntryId: personalEntry.library_entry_id,
      title: 'NestJS', available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    const user = userEvent.setup(); renderApp(address);
    await screen.findByText('节点参考：Original');
        await user.click(screen.getByRole('button', { name: '模型价格' }));
    await screen.findByRole('heading', { name: '模型价格' });
    await user.click(await screen.findByRole('button', { name: /现金额度.*前往充值/ }));
    await screen.findByRole('heading', { name: '我的额度' });
    await user.click(screen.getByRole('button', { name: '模型价格' }));
    await screen.findByRole('heading', { name: '模型价格' });
    await user.click(await screen.findByRole('button', { name: /现金额度.*前往充值/ }));
    await screen.findByRole('heading', { name: '我的额度' });
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(`${window.location.pathname}${window.location.search}`).toBe(address);
    expect(await screen.findByText('节点参考：Original')).toBeInTheDocument();
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });

  it('returns from wallet and model pricing to the full learning area and staged node URL', async () => {
    const address = `/learning?area=${personalEntry.library_entry_id}&node=node-1&title=${encodeURIComponent('基础节点')}`;
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId: personalEntry.library_entry_id, libraryEntryId: personalEntry.library_entry_id,
      title: 'NestJS', available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    const user = userEvent.setup(); renderApp(address);
    await screen.findByText('节点参考：基础节点');
    await user.click(await screen.findByRole('button', { name: /现金额度.*前往充值/ }));
    await screen.findByRole('heading', { name: '我的额度' });
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(`${window.location.pathname}${window.location.search}`).toBe(address);
    await screen.findByText('节点参考：基础节点');
        await user.click(screen.getByRole('button', { name: '模型价格' }));
    await screen.findByRole('heading', { name: '模型价格' });
    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(`${window.location.pathname}${window.location.search}`).toBe(address);
    expect(await screen.findByText('节点参考：基础节点')).toBeInTheDocument();
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });

  it('updates staged node references on query-only browser navigation', async () => {
    const address = `/learning?area=${personalEntry.library_entry_id}&node=node-1&title=First`;
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId: personalEntry.library_entry_id, libraryEntryId: personalEntry.library_entry_id,
      title: 'NestJS', available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    renderApp(address);
    await screen.findByText('节点参考：First');
    window.history.pushState({}, '', `/learning?area=${personalEntry.library_entry_id}&node=node-2&title=Second`);
    fireEvent.popState(window);
    expect(await screen.findByText('节点参考：Second')).toBeInTheDocument();
    expect(screen.queryByText('节点参考：First')).not.toBeInTheDocument();
    expect(tavernApi.generateStream).not.toHaveBeenCalled();
  });

  it('keeps cash quota available and exposes auxiliary navigation in the shared left rail without losing tools', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    renderApp('/console');
    const quota = await screen.findByRole('button', { name: '现金额度 3.1，前往充值' });
    const menu = screen.getByRole('navigation', { name: '辅助功能' });
    expect(within(menu).getByRole('button', { name: '管理面板' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '如何在自己的 Agent 里连接 MapFlow' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '查看引导' })).toBeInTheDocument();
    expect(within(menu).getByLabelText('选择主题')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: '意见反馈' })).toBeInTheDocument();
    await user.click(quota);
    expect(await screen.findByRole('heading', { name: '我的额度' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/wallet');
    await user.click(screen.getByRole('button', { name: '模型价格' }));
    expect(await screen.findByRole('heading', { name: '模型价格' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/models');
    expect(screen.getByRole('button', { name: '现金额度 3.1，前往充值' })).toBeInTheDocument();
  });
});

describe('Tavern navigation', () => {
  it('keeps a direct wallet visit behind the existing login gate', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/wallet');
    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '我的额度' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/wallet');
  });
  it('gates direct /tavern visits behind the existing login and preserves the destination after login', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    identityApi.loginIdentity.mockImplementation(async () => { identityApi.fetchCurrentSession.mockResolvedValue(authenticated); return authenticated; });
    const user = userEvent.setup(); renderApp('/tavern');
    const gate = await screen.findByTestId('identity-gate');
    expect(tavernApi.fetchCharacters).not.toHaveBeenCalled();
    await user.type(within(gate).getByLabelText('用户名'), 'firstuser');
    await user.type(within(gate).getByLabelText('密码'), 'password123');
    const loginButtons = within(gate).getAllByRole('button', { name: '登录' });
    await user.click(loginButtons[loginButtons.length - 1]);
    expect(await screen.findByRole('heading', { name: '独立酒馆' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/tavern');
  });
  it('opens the standalone page from desktop navigation and restores it through popstate', async () => {
    const user = userEvent.setup(); renderApp('/console');
    await user.click(await screen.findByRole('button', { name: '独立酒馆' }));
    expect(await screen.findByRole('heading', { name: '独立酒馆' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/tavern');
    await user.click(screen.getByRole('button', { name: '公共书库' }));
    expect(window.location.pathname).toBe('/library');
    window.history.pushState({}, '', '/tavern'); fireEvent.popState(window);
    expect(await screen.findByRole('heading', { name: '独立酒馆' })).toBeInTheDocument();
  });
  it('offers Tavern in the existing mobile navigation drawer', async () => {
    window.innerWidth = 390;
    const user = userEvent.setup(); renderApp('/console');
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    await user.click(within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', { name: '独立酒馆' }));
    expect(await screen.findByRole('heading', { name: '独立酒馆' })).toBeInTheDocument();
  });
});

describe('MapFlow tree library', () => {
  it('keeps public search and wallet recharge together after branch integration', async () => {
    const user = userEvent.setup();
    renderApp('/console');

    expect(await screen.findByRole('textbox', { name: '搜索公共地图' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '来源' })).toBeInTheDocument();
    const recharge = await screen.findByRole('button', { name: /前往充值/ });
    await user.click(recharge);
    expect(await screen.findByRole('heading', { name: '我的额度' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/wallet');
  });

  it('进入公共树库时先展示目录，选择地图后才加载节点图', async () => {
    const user = userEvent.setup();
    renderApp('/console');

    expect(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    ).toBeInTheDocument();
    expect(screen.getByText('选择一张地图查看路线')).toBeInTheDocument();
    expect(treeApi.fetchPublicTree).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: '查看 NestJS 完整学习树' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'NestJS 完整学习树' }),
    ).toBeInTheDocument();
    expect(treeApi.fetchPublicTree).toHaveBeenCalledWith(nestjsTree.id);
    expect(screen.getByRole('button', { name: '加入我的学习' })).toBeInTheDocument();
  });

  it('合并游标目录页并按树 ID 去重', async () => {
    const user = userEvent.setup();
    treeApi.fetchPublicTrees.mockImplementation((options?: { cursor?: string | null }) =>
      Promise.resolve(
        options?.cursor === 'page-2'
          ? { trees: [nestjsTree, agentTree], attributions: {}, next_cursor: null }
          : { trees: [nestjsTree], attributions: {}, next_cursor: 'page-2' },
      ),
    );
    renderApp('/console');

    expect(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '加载更多地图' }));

    expect(
      await screen.findByRole('button', { name: '查看 Python Agent 完整学习树' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: '查看 NestJS 完整学习树' }),
    ).toHaveLength(1);
    expect(treeApi.fetchPublicTrees).toHaveBeenCalledWith({
      cursor: 'page-2',
      limit: 50,
    });
  });

  it('已登录访问产品首页仍可进入控制台', async () => {
    const user = userEvent.setup();
    renderApp('/?marketing=1');

    expect(
      await screen.findByRole('heading', {
        name: '学习——什么时候变得如此困难？',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '进入控制台' })[0]);

    expect(window.location.pathname).toBe('/assistant');
    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
  });

  it('公共树默认使用关系布局，不向游客展示块布局切换', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'mapflow.console.state.v1.visitor',
      JSON.stringify({
        version: 1,
        view: 'public',
        selectedPublicTreeId: nestjsTree.id,
        selectedLibraryEntryId: null,
        selectedNodeId: null,
        layoutMode: 'blocks',
        mobileView: 'graph',
        chatOpen: false,
      }),
    );
    treeApi.fetchPublicTree.mockResolvedValueOnce({
      view_mode: 'showcase',
      graph: {
        ...nestjsGraph,
        blocks: [
          {
            id: 'block-1',
            name: '基础能力',
            color: null,
            sort_order: 0,
          },
        ],
        node_block_assignments: [
          { node_id: 'node-1', block_id: 'block-1' },
        ],
      },
    });
    renderApp('/console');

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    expect(await screen.findByRole('heading', { name: 'NestJS 完整学习树' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '按块布局' })).not.toBeInTheDocument();
    const flowBoundary = await screen.findByTestId('react-flow-boundary');
    expect(flowBoundary.querySelector('[data-mapflow-block-lane]')).toBeNull();
  });

  it('首次进入公共树时展示通用引导，查看引导按钮可以重播', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    renderApp('/console');

    const guideCopy =
      '你现在看到的，就是一张学习地图，里面有许多节点，展示了一个技术或方向从浅到深、从易到难，需要掌握的所有节点。';
    const guideCopyElement = await screen.findByText(guideCopy);
    expect(guideCopyElement).toBeInTheDocument();
    expect(screen.getByTestId('public-map-guide-progress')).toHaveTextContent('1 / 5');
    expect(screen.getByRole('heading', { name: '先看懂一张学习地图' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-graph')).toHaveClass('block');
    expect(screen.queryByRole('dialog', { name: '登录学习账号' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    const publicPoolCopy =
      '这里是网站的公共池，不仅有官方的推荐地图，也有各个用户自己上传的，点击一个技能树，将它加入到自己的地图库内';
    const publicPoolCopyElement = await screen.findByText(publicPoolCopy);
    expect(screen.getByTestId('public-map-guide-progress')).toHaveTextContent('2 / 5');
    expect(screen.getByRole('heading', { name: '从公共池找到你的地图' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-list')).toHaveClass('flex');
    expect(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument();
    expect(screen.getByTestId('public-map-guide')).toHaveClass('pointer-events-none');
    expect(screen.getAllByTestId('public-map-guide-blocker').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '关闭引导' }));
    expect(screen.queryByText(publicPoolCopy)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '查看引导' }));
    expect(await screen.findByText(guideCopy)).toBeInTheDocument();
  });

  it('首次显示引导后重新挂载不会再次自动显示', async () => {
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    const firstRender = renderApp('/console');

    expect(await screen.findByTestId('public-map-guide')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem('mapflow.guide.public.v1.seen')).toBe('true');
    });

    firstRender.unmount();
    renderApp('/console');

    await waitFor(() => {
      expect(screen.queryByTestId('public-map-guide')).not.toBeInTheDocument();
    });
  });

  it('加入公共技能树后自动进入我的学习引导', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    treeApi.addTreeToPersonalLibrary.mockResolvedValue({
      library_entry_id: personalEntry.library_entry_id,
      tree_id: nestjsTree.id,
    });
    renderApp('/console');

    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(await screen.findByRole('button', { name: '加入我的学习' }));

    expect(
      await screen.findByTestId('public-map-guide-personal-headline'),
    ).toHaveTextContent('这里是你的个人地图库，你之后所创建的技能树，都会显示在这里。');
    const personalGuideNote = screen.getByTestId('public-map-guide-personal-note');
    expect(personalGuideNote).toHaveTextContent(
      '（而且如果你有本地agent，也可以让agent来完全操控你的个人地图库，具体详情，请查看上方的Agent接入教程）',
    );
    expect(personalGuideNote).toHaveClass('text-xs', 'font-normal');
    expect(personalGuideNote).not.toHaveClass('font-bold');
    expect(screen.getByTestId('public-map-guide-focus')).toHaveAttribute(
      'data-focus-scope',
      'personal-content',
    );
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByRole('heading', { name: '记录你的学习进度' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记为已完成' })).toBeInTheDocument();
    expect(screen.getByTestId('public-map-guide-focus')).toHaveAttribute(
      'data-focus-scope',
      'personal-status',
    );
    await user.click(screen.getByRole('button', { name: '查看 Agent 接入教程' }));
    expect(await screen.findByRole('heading', { name: '管理学习进度' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭 Agent 接入教程' }));
    expect(screen.getByRole('heading', { name: '记录你的学习进度' })).toBeInTheDocument();
  });

  it('公共池引导的下一步可以直接进入我的学习引导', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/console');

    await user.click(await screen.findByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '关闭引导' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下一步' }));

    expect(
      await screen.findByTestId('public-map-guide-personal-headline'),
    ).toHaveTextContent('这里是你的个人地图库，你之后所创建的技能树，都会显示在这里。');
    expect(treeApi.addTreeToPersonalLibrary).not.toHaveBeenCalled();
  });

  it('个人地图引导进入全局助手，不再创建旧生成会话', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/console');

    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(await screen.findByRole('button', { name: '下一步' }));

    expect(await screen.findByText('点击此按钮，生成技能树')).toBeInTheDocument();
    expect(screen.getByTestId('public-map-guide-progress')).toHaveTextContent('4 / 5');
    expect(screen.getByTestId('public-map-guide-focus')).toHaveAttribute(
      'data-focus-scope',
      'generation-button',
    );
    await user.click(screen.getByRole('button', { name: '下一步' }));

    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
    expect(screen.queryByTestId('public-map-guide')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name:'mock tree generator'})).not.toBeInTheDocument();
    expect(nativeApi.acceptAgentExecution).not.toHaveBeenCalled();
  });

  it('结束生成入口引导后可直接输入，打开助手不收费', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.guide.public.v1.seen');
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/console');

    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(await screen.findByRole('button', { name: '下一步' }));
    await user.click(await screen.findByRole('button', { name: '下一步' }));

    expect(await screen.findByLabelText('消息')).toBeEnabled();
    expect(screen.queryByTestId('public-map-guide')).not.toBeInTheDocument();
    expect(nativeApi.acceptAgentExecution).not.toHaveBeenCalled();
  });

  it('未登录时不能看到生成入口', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始生成技能树' })).not.toBeInTheDocument();
    expect(generationApi.readPlatformGenerationEntitlements).not.toHaveBeenCalled();
  });

  it('公共树加载失败时查看引导仍能打开独立浮层', async () => {
    const user = userEvent.setup();
    treeApi.fetchPublicTrees.mockRejectedValue(
      new Error('技能树服务暂时不可用，请稍后重试。'),
    );
    renderApp('/console');

    expect(
      await screen.findByText(
        '公共技能树暂时无法读取',
        {},
        { timeout: 4_000 },
      ),
    ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '查看引导' }));

    const guide = screen.getByTestId('public-map-guide');
    expect(guide).toHaveClass('fixed', 'inset-0');
    expect(
      within(guide).getByText(
        '你现在看到的，就是一张学习地图，里面有许多节点，展示了一个技术或方向从浅到深、从易到难，需要掌握的所有节点。',
      ),
    ).toBeInTheDocument();
    const demoTreeChoice = await screen.findByRole('button', {
      name: '查看 生产级 Agent AI 应用后端完整体系（NestJS）',
    });
    await user.click(demoTreeChoice);
    expect(
      await screen.findByRole('button', { name: '加入我的学习' }),
    ).toBeInTheDocument();
  });

  it('点击公共树节点不会重新挂载画布', async () => {
    const user = userEvent.setup();
    renderApp('/console');

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    const node = await screen.findByRole('button', { name: '查看节点 基础节点' });
    expect(flowLifecycle.mounts).toBe(1);

    await user.click(node);

    expect(flowLifecycle.unmounts).toBe(0);
    expect(flowLifecycle.mounts).toBe(1);
  });

  it('公共树目录失败时保留控制台，并允许继续使用个人学习', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPublicTrees.mockRejectedValue(
      new Error('技能树服务暂时不可用，请稍后重试。'),
    );
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/console');

    expect(
      await screen.findByText(
        '公共技能树暂时无法读取',
        {},
        { timeout: 4_000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新读取公共树库' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '我的地图' }));
    expect((await screen.findAllByText('NestJS 完整学习树')).length).toBeGreaterThan(0);
  });

  it('已登录访问根路径会自动进入控制台', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp('/');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/assistant');
    expect(
      screen.queryByRole('heading', {
        name: '学习——什么时候变得如此困难？',
      }),
    ).not.toBeInTheDocument();
  });

  it('控制台可以通过显式入口参数再次查看产品首页', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp('/?marketing=1');

    expect(
      await screen.findByRole('heading', {
        name: '学习——什么时候变得如此困难？',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();
  });

  it('控制台顶部可以打开 Agent 接入教程', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp('/console');

        const guideButton = await screen.findByRole('button', {
      name: '如何在自己的 Agent 里连接 MapFlow',
    });
    await user.click(guideButton);

    expect(
      await screen.findByRole('dialog', { name: '在自己的 Agent 中连接 MapFlow' }),
    ).toBeInTheDocument();
  });

  it('未登录从根路径登录后直接进入控制台', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    identityApi.loginIdentity.mockImplementation(async () => { identityApi.fetchCurrentSession.mockResolvedValue(authenticated); return authenticated; });
    renderApp('/');

    const gate = await screen.findByTestId('identity-gate');
    await user.type(within(gate).getByLabelText('用户名'), 'firstuser');
    await user.type(within(gate).getByLabelText('密码'), 'safe-password-2026');
    const loginButtons = within(gate).getAllByRole('button', { name: '登录' });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/assistant');
  });

  it('未登录时不能浏览公共树池或加入技能树', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByText('NestJS 完整学习树')).not.toBeInTheDocument();
    expect(screen.queryByText('Python Agent 完整学习树')).not.toBeInTheDocument();
    expect(treeApi.addTreeToPersonalLibrary).not.toHaveBeenCalled();
    expect(treeApi.fetchPublicTrees).not.toHaveBeenCalled();
  });

  it('adds a tree for a pioneer and keeps completion binary and account scoped', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValue({ entries: [personalEntry] });
    treeApi.addTreeToPersonalLibrary.mockResolvedValue({
      library_entry_id: personalEntry.library_entry_id,
      tree_id: nestjsTree.id,
    });
    treeApi.fetchPersonalTree
      .mockResolvedValueOnce(personalDetail([]))
      .mockResolvedValueOnce(personalDetail(['node-1']))
      .mockResolvedValueOnce(personalDetail([]));
    treeApi.setNodeCompletion.mockResolvedValue(undefined);
    renderApp();

    expect(await screen.findByText('MF-7K3P-9D2Q-X8CW')).toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '加入我的学习' }),
    );
    await waitFor(() =>
      expect(treeApi.addTreeToPersonalLibrary).toHaveBeenCalledWith(
        nestjsTree.id,
        'csrf-secret',
      ),
    );
    expect(await screen.findByText('总进度 0%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的地图' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: '标记为已完成' }));
    await waitFor(() =>
      expect(treeApi.setNodeCompletion).toHaveBeenCalledWith(
        personalEntry.library_entry_id,
        'node-1',
        true,
        'csrf-secret',
      ),
    );
    expect(await screen.findByText('总进度 50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看节点 基础节点' })).toHaveAttribute(
      'data-status',
      'completed',
    );
    expect(screen.getByRole('button', { name: '查看节点 进阶节点' })).toHaveAttribute(
      'data-status',
      'not_started',
    );

    await user.click(screen.getByRole('button', { name: '取消完成' }));
    await waitFor(() =>
      expect(treeApi.setNodeCompletion).toHaveBeenLastCalledWith(
        personalEntry.library_entry_id,
        'node-1',
        false,
        'csrf-secret',
      ),
    );
    expect(await screen.findByText('总进度 0%')).toBeInTheDocument();
  });

  it('saves a partial node percentage through the personal tree flow', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValue({ entries: [personalEntry] });
    treeApi.addTreeToPersonalLibrary.mockResolvedValue({
      library_entry_id: personalEntry.library_entry_id,
      tree_id: nestjsTree.id,
    });
    treeApi.fetchPersonalTree
      .mockResolvedValueOnce(personalDetail([]))
      .mockResolvedValueOnce(personalDetail([], [{ node_id: 'node-1', progress_percent: 37 }], 19));
    treeApi.setNodeProgress.mockResolvedValue(undefined);
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(await screen.findByRole('button', { name: '加入我的学习' }));
    await user.click(await screen.findByRole('button', { name: '填写详细进度' }));
    const input = screen.getByRole('spinbutton', { name: '节点完成百分比' });
    await user.clear(input);
    await user.type(input, '37');
    await user.click(screen.getByRole('button', { name: '保存详细进度' }));

    await waitFor(() =>
      expect(treeApi.setNodeProgress).toHaveBeenCalledWith(
        personalEntry.library_entry_id,
        'node-1',
        37,
        'csrf-secret',
      ),
    );
    expect(await screen.findByText('总进度 19%')).toBeInTheDocument();
  });

  it('switches between the two catalog trees without using the old canary endpoint', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    expect(await screen.findByRole('heading', { name: 'NestJS 完整学习树' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: '查看 Python Agent 完整学习树' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Python Agent 完整学习树' }),
    ).toBeInTheDocument();
    expect(treeApi.fetchPublicTree).toHaveBeenCalledWith(agentTree.id);
    expect(legacyApi.fetchLearningTree).not.toHaveBeenCalled();
  });

  it('shows an empty personal-library state instead of a disabled-query spinner', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();

    expect(await screen.findByText('MF-7K3P-9D2Q-X8CW')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的地图' }));

    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
  });

  it('does not expose the previous account personal library after logout and login', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    identityApi.logoutIdentity.mockResolvedValue(undefined);
    identityApi.loginIdentity.mockImplementation(async () => { identityApi.fetchCurrentSession.mockResolvedValue(secondAccount); return secondAccount; });
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [personalEntry] })
      .mockResolvedValueOnce({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    expect(await screen.findByText('0/2 已完成')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(screen.getByRole('dialog', { name: '确认退出登录' })).toBeInTheDocument();
    expect(identityApi.logoutIdentity).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消退出' }));
    expect(screen.queryByRole('dialog', { name: '确认退出登录' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '退出登录' }));
    await user.click(screen.getByRole('button', { name: '确认退出' }));
    const gate = await screen.findByTestId('identity-gate');
    await user.type(
      within(gate).getByLabelText('用户名'),
      secondAccount.account.username,
    );
    await user.type(within(gate).getByLabelText('密码'), 'safe-password-2026');
    const loginButtons = within(gate).getAllByRole('button', { name: '登录' });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText(secondAccount.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的地图' }));

    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0/2 已完成')).not.toBeInTheDocument();
    expect(treeApi.fetchPersonalLibrary).toHaveBeenCalledTimes(2);
  });

  it('starts new map-building through the global assistant instead of the legacy generation form',async()=>{
    const user=userEvent.setup();identityApi.fetchCurrentSession.mockResolvedValue(authenticated);renderApp();
    await user.click(await screen.findByRole('button',{name:'我的地图'}));
    await user.click(await screen.findByRole('button',{name:'生成新技能树'}));
    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'完成生成'})).not.toBeInTheDocument();
    expect(new URL(window.location.href).pathname).toBe('/assistant');
    expect(nativeApi.acceptAgentExecution).not.toHaveBeenCalled();
  });
  it('retains an existing generation session and selects its completed result', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/maps?generationSession=generation-session-1');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'mock tree generator' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('generationSession')).toBe(
      'generation-session-1',
    );
    await user.click(screen.getByRole('button', { name: '完成生成' }));

    await waitFor(() =>
      expect(treeApi.fetchPersonalTree).toHaveBeenCalledWith(
        personalEntry.library_entry_id,
      ),
    );
    expect(screen.queryByRole('dialog', { name: 'mock tree generator' })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('generationSession')).toBe(false);
  });

  it('未登录时不能看到生成入口', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始生成技能树' })).not.toBeInTheDocument();
    expect(generationApi.readPlatformGenerationEntitlements).not.toHaveBeenCalled();
  });

  it('lets an authenticated user open the shared assistant directly from the map header', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    const button = await screen.findByRole('button', { name: '开始生成技能树' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'mock tree generator' })).not.toBeInTheDocument();
  });

  it('opens the assistant while legacy generation capabilities are still loading', async () => {
    const user = userEvent.setup();
    identityApi.fetchCapabilities.mockImplementation(() => new Promise(() => {}));
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的地图' }));

    const button = await screen.findByRole('button', { name: '生成新技能树' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
  });

  it('opens the assistant when legacy generation capabilities fail', async () => {
    const user = userEvent.setup();
    identityApi.fetchCapabilities.mockRejectedValue(new Error('network down'));
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的地图' }));

    const button = await screen.findByRole('button', { name: '生成新技能树' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
  });

  it('restores an unfinished generation dialog from the URL after reload', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    window.history.replaceState(
      {},
      '',
      '/?generationSession=generation-session-1',
    );
    renderApp();

    expect(
      await screen.findByRole('dialog', { name: 'mock tree generator' }),
    ).toBeInTheDocument();
    expect(screen.getByText('generation-session-1')).toBeInTheDocument();
  });

  it('keeps an unfinished generation session available after minimizing', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp('/maps?generationSession=generation-session-1');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(await screen.findByRole('dialog',{name:'mock tree generator'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭生成器' }));

    expect(screen.queryByRole('dialog', { name: 'mock tree generator' })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('generationSession')).toBe(
      'generation-session-1',
    );
    const restore = screen.getByRole('button', { name: '查看技能树生成任务' });
    expect(restore.querySelector('[data-generation-pulse]')).toHaveClass('animate-pulse');

    await user.click(restore);
    expect(screen.getByRole('dialog', { name: 'mock tree generator' })).toBeInTheDocument();
  });

  it('shows platform balance and restores the server active session without URL state', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    generationApi.readPlatformGenerationEntitlements.mockResolvedValue({
      totalGranted: 3,
      available: 2,
      reserved: 1,
      consumed: 0,
      activePlatformSessionId: 'server-platform-session-1',
      platformModeAvailable: true,
    });
    renderApp();

    expect(await screen.findByText('平台免费生成剩余 2 次')).toBeInTheDocument();
    expect(
      await screen.findByRole('dialog', { name: 'mock tree generator' }),
    ).toBeInTheDocument();
    expect(screen.getByText('server-platform-session-1')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('generationSession')).toBe(
      'server-platform-session-1',
    );
  });

  it('does not restore a completed session from stale platform entitlements', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    generationApi.readPlatformGenerationEntitlements.mockResolvedValue({
      totalGranted: 3,
      available: 1,
      reserved: 1,
      consumed: 1,
      activePlatformSessionId: 'server-platform-session-1',
      platformModeAvailable: true,
    });
    renderApp();

    expect(
      await screen.findByRole('dialog', { name: 'mock tree generator' }),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('complete-generation'));

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).has('generationSession')).toBe(false),
    );
    expect(screen.queryByRole('dialog', { name: 'mock tree generator' })).not.toBeInTheDocument();
  });

  it('keeps the completion barrier while the first entitlement read is still pending', async () => {
    const user = userEvent.setup();
    let resolveEntitlements!: (value: {
      totalGranted: number;
      available: number;
      reserved: number;
      consumed: number;
      activePlatformSessionId: string | null;
      platformModeAvailable: boolean;
    }) => void;
    generationApi.readPlatformGenerationEntitlements.mockReturnValue(
      new Promise((resolve) => {
        resolveEntitlements = resolve;
      }),
    );
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    window.history.replaceState(
      {},
      '',
      '/?generationSession=server-platform-session-1',
    );
    renderApp();

    expect(
      await screen.findByRole('dialog', { name: 'mock tree generator' }),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId('complete-generation'));
    expect(new URLSearchParams(window.location.search).has('generationSession')).toBe(false);

    resolveEntitlements({
      totalGranted: 3,
      available: 1,
      reserved: 1,
      consumed: 1,
      activePlatformSessionId: 'server-platform-session-1',
      platformModeAvailable: true,
    });
    await waitFor(()=>expect(screen.queryByText('平台免费生成剩余 1 次')).not.toBeInTheDocument());
    expect(new URLSearchParams(window.location.search).has('generationSession')).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'mock tree generator' })).not.toBeInTheDocument();
  });

  it('does not request platform entitlements when the server disables that mode', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    identityApi.fetchCapabilities.mockResolvedValue({
      identity: { registrationEnabled: true },
      generation: {
        enabled: true,
        platformFundedEnabled: false,
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        thinkingModes: ['disabled', 'enabled'],
        reasoningEfforts: ['low', 'high', 'max'],
      },
    });
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(generationApi.readPlatformGenerationEntitlements).not.toHaveBeenCalled();
    expect(screen.queryByText(/平台免费生成剩余/)).not.toBeInTheDocument();
  });
});

describe('管理面板入口', () => {
  it('only shows the admin entry to admins and opens the panel with a working back button', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    renderApp();

        await user.click(await screen.findByRole('button', { name: '管理面板' }));
    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByLabelText('注册总数 12')).toBeInTheDocument();
    expect(adminApi.fetchAdminDashboard).toHaveBeenCalledWith(
      'admin-csrf-secret',
    );

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: '我的地图' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      await screen.findByText('还没有技能树，先从公共树池加入一棵吧。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '管理面板' }),
    ).not.toBeInTheDocument();
  });

  it('does not show the admin entry to a non-admin account', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '管理面板' }),
    ).not.toBeInTheDocument();
  });

  it('session 在管理面板失效后回到登录门禁', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    const { queryClient } = renderApp();

        await user.click(await screen.findByRole('button', { name: '管理面板' }));
    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();

    identityApi.fetchCurrentSession.mockResolvedValue(null);
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '管理面板' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('公共树池')).not.toBeInTheDocument();
  });
});

describe('手机端视图栈', () => {
  it('重新加载控制台后回到公共目录，不恢复历史节点', async () => {
    const user = userEvent.setup();
    renderApp('/console');

    await user.click(
      await screen.findByRole('button', { name: '查看 Python Agent 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 Agent 基础' }),
    );
    expect(screen.getByRole('heading', { name: 'Agent 基础' })).toBeInTheDocument();

    cleanup();
    renderApp('/console');

    expect(await screen.findByText('选择一张地图查看路线')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Agent 基础' })).not.toBeInTheDocument();
  });

  it('重新加载控制台后仍保留个人树和当前节点', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp('/console');

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 进阶节点' }),
    );
    expect(screen.getByRole('heading', { name: '进阶节点' })).toBeInTheDocument();

    cleanup();
    renderApp('/console');

    expect(await screen.findByRole('heading', { name: '进阶节点' })).toBeInTheDocument();
  });

  it('初始显示列表页：列表可见、图与详情隐藏、无返回按钮', async () => {
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-graph').className).toContain('hidden');
    expect(screen.queryByTestId('mobile-detail')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '返回上一级' }),
    ).not.toBeInTheDocument();
  });

  it('点树项进入图页：图可见、列表隐藏、返回按钮出现', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-list').className).toContain('hidden');
    expect(screen.getByRole('button', { name: '返回上一级' })).toBeInTheDocument();
  });

  it('点节点进入详情页，返回按钮先回图页再回列表', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    expect(screen.getByTestId('mobile-detail').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-detail').className).toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(
      screen.queryByRole('button', { name: '返回上一级' }),
    ).not.toBeInTheDocument();
  });

  it('公共树节点详情不显示知识聊天入口', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );

    expect(screen.queryByRole('button', { name: '进入学习区，向 AI 提问' })).not.toBeInTheDocument();
    expect(chatApi.sendKnowledgeChatMessageStream).not.toHaveBeenCalled();
  });

  it('默认展开的左右栏可以独立收起并恢复', async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem('mapflow.layout.personal-sidebar-open');
    window.localStorage.removeItem('mapflow.layout.node-detail-open');
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));

    try {
      renderApp();

      await screen.findByText(authenticated.account.playerId);
      await user.click(screen.getByRole('button', { name: '我的地图' }));
      await user.click(
        await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
      );
      await user.click(
        await screen.findByRole('button', { name: '查看节点 基础节点' }),
      );

      expect(screen.getAllByRole('button', { name: '收起左侧树库' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: '收起节点详情' })).toHaveLength(1);

      await user.click(screen.getAllByRole('button', { name: '收起左侧树库' })[0]);
      await user.click(screen.getAllByRole('button', { name: '收起节点详情' })[0]);

      expect(screen.getByTestId('mobile-list').className).toContain('lg:hidden');
      expect(screen.getByTestId('mobile-detail').className).toContain('lg:hidden');

      await user.click(screen.getByRole('button', { name: '展开左侧树库' }));
      await user.click(screen.getAllByRole('button', { name: '展开节点详情' })[0]);

      expect(screen.getByTestId('mobile-list').className).not.toContain('lg:hidden');
      expect(screen.getByTestId('mobile-detail').className).not.toContain('lg:hidden');
    } finally {
      window.localStorage.removeItem('mapflow.layout.personal-sidebar-open');
      window.localStorage.removeItem('mapflow.layout.node-detail-open');
    }
  });

  it('keeps an export action on every personal tree card, without duplicate desktop header controls', async () => {
    const user = userEvent.setup();
    const secondPersonalEntry = {
      ...personalEntry,
      library_entry_id: '44444444-4444-4444-8444-444444444444',
      tree: agentTree,
    };
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({
      entries: [personalEntry, secondPersonalEntry],
    });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );

    const header = document.querySelector('header');
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).queryByRole('button', { name: '导出技能树' }),
    ).not.toBeInTheDocument();
    expect(
      within(header as HTMLElement).queryByRole('button', { name: '收起左侧树库' }),
    ).not.toBeInTheDocument();
    expect(
      within(header as HTMLElement).queryByRole('button', { name: '收起节点详情' }),
    ).not.toBeInTheDocument();

    const exportTriggers = screen.getAllByRole('button', {
      name: /导出技能树：/,
    });
    expect(exportTriggers).toHaveLength(2);
    expect(exportTriggers[0].closest('header')).toBeNull();
    expect(exportTriggers[0].closest('[data-testid="mobile-list"]')).toBeNull();
    expect(exportTriggers[0].closest('[data-testid="tree-choice"]')).toBeNull();
    expect(exportTriggers[0].closest('[data-mapflow-tree-action-portal="true"]')).not.toBeNull();
    const firstTreeCard = screen.getAllByTestId('tree-choice')[0];
    expect(firstTreeCard).toHaveClass('overflow-visible');
    expect(firstTreeCard).toHaveClass('mapflow-tree-choice--with-actions');
    expect(screen.getAllByTestId('tree-choice-actions')).toHaveLength(2);
    expect(exportTriggers[1].closest('[data-testid="mobile-list"]')).toBeNull();

    const firstActionGroup = screen.getAllByTestId('tree-choice-actions')[0];
    expect(
      firstActionGroup.querySelector('.mapflow-tree-choice__drawer'),
    ).toHaveClass('mapflow-tree-choice__drawer--uniform');
    const firstActionButtons = within(firstActionGroup).getAllByRole('button');
    expect(firstActionButtons).toHaveLength(4);
    firstActionButtons.forEach((button) => {
      expect(button).toHaveClass('mapflow-tree-action--uniform');
    });

    const renameTriggers = screen.getAllByRole('button', {
      name: /重命名技能树：/,
    });
    const deleteTriggers = screen.getAllByRole('button', {
      name: /删除技能树：/,
    });
    expect(renameTriggers[0]).toHaveClass('mapflow-tree-action--rename');
    expect(deleteTriggers[0]).toHaveClass('mapflow-tree-action--delete');
    expect(renameTriggers).toHaveLength(2);
    expect(deleteTriggers).toHaveLength(2);
    renameTriggers.forEach((button) => expect(button).not.toBeDisabled());
    deleteTriggers.forEach((button) => expect(button).not.toBeDisabled());

    await user.hover(screen.getAllByTestId('tree-choice')[1]);
    const exportActionGroup = screen.getAllByTestId('tree-choice-actions')[1];
    expect(exportActionGroup).toHaveAttribute('data-mapflow-action-visible', 'true');
    await user.click(exportTriggers[1]);
    expect(exportActionGroup).toHaveAttribute('data-mapflow-action-visible', 'false');
    expect(treeApi.fetchPersonalTree).toHaveBeenCalledWith(
      secondPersonalEntry.library_entry_id,
    );
    expect(
      await screen.findByRole('dialog', { name: '导出技能树' }),
    ).toBeInTheDocument();
  });

  it('can rename a personal tree and delete it after explicit confirmation', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    treeApi.renamePersonalTree.mockResolvedValue(undefined);
    treeApi.deletePersonalTree.mockResolvedValue(undefined);
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );

    await user.click(screen.getByRole('button', { name: /重命名技能树：/ }));
    const renameDialog = await screen.findByRole('dialog', { name: '重命名技能树' });
    const titleInput = within(renameDialog).getByRole('textbox', {
      name: '新的技能树名称',
    });
    await user.clear(titleInput);
    await user.type(titleInput, '我的 NestJS 树');
    await user.click(within(renameDialog).getByRole('button', { name: '保存名称' }));
    await waitFor(() =>
      expect(treeApi.renamePersonalTree).toHaveBeenCalledWith(
        personalEntry.library_entry_id,
        '我的 NestJS 树',
        authenticated.csrfToken,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '重命名技能树' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /删除技能树：/ }));
    const deleteDialog = await screen.findByRole('dialog', { name: '删除技能树' });
    expect(
      within(deleteDialog).getByText(/学习进度、聊天历史和个人修改都会被移除/),
    ).toBeInTheDocument();
    await user.click(
      within(deleteDialog).getByRole('button', { name: '确认删除技能树' }),
    );
    await waitFor(() =>
      expect(treeApi.deletePersonalTree).toHaveBeenCalledWith(
        personalEntry.library_entry_id,
        authenticated.csrfToken,
      ),
    );
  });

  it('登录后的个人树打开聊天并可返回详情，选中节点保持不变', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    expect(tavernApi.openTreeConversation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('knowledge-chat-panel')).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

    expect(await screen.findByRole('region', { name: '角色对话' })).toBeInTheDocument();
    await waitFor(() => expect(tavernApi.openTreeConversation).toHaveBeenCalled());
    expect(screen.queryByTestId('mobile-detail')).not.toBeInTheDocument();
    expect(chatApi.sendKnowledgeChatMessageStream).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '我的地图' }));
    expect(screen.getByTestId('mobile-detail').className).not.toContain('hidden');
    expect(screen.getByRole('heading', { name: '基础节点' })).toBeInTheDocument();
  });

  it('手机端进入聊天后隐藏控制台顶栏，额度与账号入口改挂到会话操作菜单', async () => {
    const originalInnerWidth = window.innerWidth;
    window.innerWidth = 390;
    try {
      const user = userEvent.setup();
      identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
      treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
      treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
      renderApp();

      await user.click(await screen.findByRole('button',{name:'打开功能菜单'}));
      await user.click(screen.getByRole('button', { name: '我的地图' }));
      await user.click(
        await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
      );
      await user.click(
        await screen.findByRole('button', { name: '查看节点 基础节点' }),
      );
      await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

      expect(await screen.findByRole('region', { name: '角色对话' })).toBeInTheDocument();
      // 顶栏在聊天模式下只重复显示标题，却要占掉 64px 以上，整条不再渲染。
      expect(screen.queryByRole('button', { name: '更多' })).not.toBeInTheDocument();
      // 顶栏上的额度必须是转移而不是消失，否则等于删功能。
      expect(screen.queryByRole('button', { name: /现金额度/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
      const menu = screen.getByRole('navigation', { name: '辅助功能' });
      expect(within(menu).getByRole('button', { name: /现金额度/ })).toBeInTheDocument();
      expect(within(menu).getByRole('button', { name: '模型价格' })).toBeInTheDocument();
      expect(within(menu).getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });

  it('桌面端进入聊天后保留控制台顶栏，不产生重复入口', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

    expect(await screen.findByRole('region', { name: '角色对话' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '全局导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /现金额度/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '操作' })).not.toBeInTheDocument();
  });

  it('学习聊天卸载地图并去掉分隔条，查看地图后能恢复同一聊天', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

    expect(await screen.findByRole('region', { name: '角色对话' })).toBeInTheDocument();
    expect(screen.queryByRole('separator',{name:'调整聊天面板宽度'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'查看节点 基础节点'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'查看地图'}));
    expect(await screen.findByRole('button',{name:'查看节点 基础节点'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'收起地图'}));
    expect(screen.queryByRole('button',{name:'查看节点 基础节点'})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'消息'})).toBeVisible();
  });

  it('关闭再打开同一棵树时保留聊天气泡，但切换树会隔离会话', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    await screen.findByText(authenticated.account.playerId);
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

    await user.click(screen.getByRole('button', { name: '配置' }));
    await user.click(screen.getByRole('button', { name: '模型接入' }));
    fireEvent.change(screen.getByLabelText('配置资金通路'),{target:{value:'cash'}});
    expect(screen.getByLabelText('配置助手现金模型')).toHaveValue('learning-profile');
    await user.click(screen.getByRole('button', { name: '关闭配置' }));
    await user.type(screen.getByRole('textbox', { name: '消息' }), '保留这条消息');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByText('测试回答')).toBeInTheDocument();
    expect(nativeApi.acceptAgentExecution).toHaveBeenCalledOnce();expect(tavernApi.generateStream).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await user.click(screen.getByRole('button', { name: '进入学习区，向 AI 提问' }));

    expect(await screen.findByText(/保留这条消息/)).toBeInTheDocument();
    expect(await screen.findByText('测试回答')).toBeInTheDocument();
  });
});

describe('手机端抽屉', () => {
  beforeEach(() => { window.innerWidth = 390; });
  afterEach(() => { window.innerWidth = 1024; });
  it('手机名称搜索不会隐藏切换到桌面后的会话', async () => {
    const user = userEvent.setup();
    const chat = { ...tavernDetail, conversation: { ...tavernDetail.conversation, scene: 'tavern' as const } };
    tavernApi.fetchCharacters.mockResolvedValue([tavernCharacter]);
    tavernApi.fetchConversations.mockResolvedValue([chat.conversation]);
    tavernApi.fetchConversation.mockResolvedValue(chat);
    localStorage.setItem(`mapflow.tavern.selection.v1.${authenticated.account.playerId}`, chat.conversation.conversationId);
    renderApp('/tavern');
    await screen.findByRole('textbox', { name: '消息' });
    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.type(within(drawer).getByRole('searchbox', { name: '搜索会话' }), '不匹配的名称');
    expect(within(drawer).queryByRole('button', { name: `打开会话 ${chat.conversation.title}` })).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: '关闭功能菜单' }));
    window.innerWidth = 1440; fireEvent(window, new Event('resize'));
    expect(await screen.findByRole('button', { name: `打开会话 ${chat.conversation.title}` })).toBeInTheDocument();
    window.innerWidth = 390; fireEvent(window, new Event('resize'));
    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    expect(screen.getByRole('searchbox', { name: '搜索会话' })).toHaveValue('不匹配的名称');
    expect(screen.queryByRole('button', { name: `打开会话 ${chat.conversation.title}` })).not.toBeInTheDocument();
    expect(nativeApi.acceptAgentExecution).not.toHaveBeenCalled();
  });
  it('统一手机聊天：键盘缩小可视窗口后外壳跟随并清理监听', async () => {
    const viewport = Object.assign(new EventTarget(), { height: 650, offsetTop: 0 });
    const removeListener = vi.spyOn(viewport, 'removeEventListener');
    vi.stubGlobal('visualViewport', viewport);
    try {
      const view = renderApp('/assistant');
      const toolbar = await screen.findByRole('toolbar', { name: '对话操作' });
      const shell = toolbar.closest('.application-shell') as HTMLElement;
      expect(shell.style.getPropertyValue('--mobile-viewport-height')).toBe('650px');
      viewport.height = 340; viewport.offsetTop = 16;
      viewport.dispatchEvent(new Event('resize'));
      expect(shell.style.getPropertyValue('--mobile-viewport-height')).toBe('340px');
      expect(shell.style.getPropertyValue('--mobile-viewport-top')).toBe('16px');
      view.unmount();
      expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    } finally { vi.unstubAllGlobals(); }
  });
  it.each(['assistant', 'learning', 'tavern'] as const)('统一手机聊天：%s 顶部一行、单个抽屉和配置保留草稿', async scene => {
    const user = userEvent.setup();
    const areaId = personalEntry.library_entry_id;
    const chat = { ...tavernDetail, conversation: { ...tavernDetail.conversation,
      scene: scene === 'assistant' ? 'management' as const : scene,
      libraryEntryId: scene === 'learning' ? areaId : undefined,
      learningAreaId: scene === 'learning' ? areaId : undefined,
    } };
    tavernApi.fetchCharacters.mockResolvedValue([tavernCharacter]);
    tavernApi.fetchConversations.mockResolvedValue([chat.conversation]);
    tavernApi.fetchLearningAreaConversations.mockResolvedValue([chat.conversation]);
    tavernApi.fetchConversation.mockResolvedValue(chat);
    tavernApi.openTreeConversation.mockResolvedValue(chat);
    tavernApi.openManagementConversation.mockResolvedValue(chat);
    tavernApi.fetchLearningAreas.mockResolvedValue([{ areaId, libraryEntryId: areaId,
      title: personalEntry.tree.title, available: true, createdAt: '2026-10-11T00:00:00Z' }]);
    localStorage.setItem(`mapflow.tavern.selection.v1.${authenticated.account.playerId}${scene === 'assistant' ? '.management' : ''}`, chat.conversation.conversationId);
    renderApp(scene === 'learning' ? `/learning?area=${areaId}` : `/${scene}`);
    const input = await screen.findByRole('textbox', { name: '消息' });
    const toolbar = screen.getByRole('toolbar', { name: '对话操作' });
    expect(within(toolbar).getByRole('button', { name: '新建会话' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '配置' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /展开画布|收起画布/ })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '资金通路' })).not.toBeInTheDocument();
    await user.type(input, '抽屉和配置关闭后保留我的输入');
    await user.click(within(toolbar).getByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    expect(screen.getAllByRole('dialog', { name: '功能菜单' })).toHaveLength(1);
    expect(within(drawer).getByRole('combobox', { name: '资金通路' })).toBeInTheDocument();
    expect(within(drawer).getByRole('combobox', { name: '筛选历史角色' })).toHaveValue('all');
    const search = within(drawer).getByRole('searchbox', { name: '搜索会话' });
    await user.type(search, '不存在的会话名称');
    expect(within(drawer).queryByRole('button', { name: `打开会话 ${chat.conversation.title}` })).not.toBeInTheDocument();
    await user.clear(search);
    expect(within(drawer).getByRole('button', { name: `打开会话 ${chat.conversation.title}` })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: '关闭功能菜单' }));
    expect(input).toHaveValue('抽屉和配置关闭后保留我的输入');
    await user.click(within(toolbar).getByRole('button', { name: '配置' }));
    const configuration = screen.getByRole('dialog', { name: '配置' });
    await user.click(within(configuration).getByRole('button', { name: '关闭配置' }));
    expect(input).toHaveValue('抽屉和配置关闭后保留我的输入');
    expect(nativeApi.acceptAgentExecution).not.toHaveBeenCalled();
  });
  it('点 ☰ 打开抽屉，点「我的学习」进入个人视图并关闭抽屉', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.click(within(drawer).getByRole('button', { name: '我的地图' }));

    expect(
      screen.queryByRole('dialog', { name: '功能菜单' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
  });

  it('管理员可在抽屉打开管理面板', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    renderApp();
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '管理面板',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();
  });

  it('未登录时直接显示登录门禁，不渲染抽屉', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开功能菜单' })).not.toBeInTheDocument();
    expect(screen.queryByText('NestJS 完整学习树')).not.toBeInTheDocument();
  });

  it('登录后抽屉的公告入口打开公告列表', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '公告',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: '全部公告' }),
    ).toBeInTheDocument();
  });

  it('identity 功能关闭时已登录抽屉仍不渲染登录入口', async () => {
    const user = userEvent.setup();
    identityApi.fetchCapabilities.mockResolvedValue({
      identity: { registrationEnabled: false },
      generation: {
        enabled: true,
        platformFundedEnabled: true,
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        thinkingModes: ['disabled', 'enabled'],
        reasoningEfforts: ['low', 'high', 'max'],
      },
    });
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    expect(screen.getByRole('dialog', { name: '功能菜单' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '登录 / 激活账号' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('未登录')).not.toBeInTheDocument();
  });

  it('抽屉退出失败时显示错误提示', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    identityApi.logoutIdentity.mockRejectedValue(new Error('登出失败'));
    renderApp();
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.click(
      within(drawer).getByRole('button', { name: '退出登录' }),
    );

    const dialog = await screen.findByRole('dialog', { name: '确认退出登录' });
    await user.click(within(dialog).getByRole('button', { name: '确认退出' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('请求暂时失败，请稍后重试。');
  });

  it('session 失效后重新登录不自动弹出残留的公告弹窗', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    const { queryClient } = renderApp();
    await user.click(await screen.findByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '公告',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: '全部公告' }),
    ).toBeInTheDocument();

    // 模拟 session 失效：弹窗随之卸载但 state 残留
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '全部公告' }),
      ).not.toBeInTheDocument(),
    );

    // 重新登录后公告弹窗不应自动弹出
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    await screen.findByRole('button', { name: '打开功能菜单' });

    expect(
      screen.queryByRole('dialog', { name: '全部公告' }),
    ).not.toBeInTheDocument();
  });
});

describe('登录门禁', () => {
  it('未登录访问根路径时只显示登录注册门禁', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/');

    const gate = await screen.findByTestId('identity-gate');
    expect(
      within(gate).getByRole('heading', { name: '登录学习账号' }),
    ).toBeInTheDocument();
    expect(within(gate).getByRole('button', { name: '注册激活' })).toBeInTheDocument();
    expect(screen.queryByText('公共树池')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '如何在自己的 Agent 里连接 MapFlow' }),
    ).not.toBeInTheDocument();
  });

  it('未登录直接访问控制台路径时仍被拦截到登录门禁', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/console');
    expect(screen.queryByTestId('mobile-list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '我的地图' })).not.toBeInTheDocument();
  });

  it('session 加载期间不闪现主应用内容', async () => {
    let resolveSession!: (session: typeof authenticated | null) => void;
    identityApi.fetchCurrentSession.mockImplementation(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );

    renderApp('/console');

    expect(await screen.findByTestId('session-loading')).toHaveTextContent(
      '正在检查登录状态…',
    );
    expect(screen.queryByTestId('identity-gate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();

    resolveSession(null);
    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
  });

  it('未登录时不会请求公共树、个人树、生成或管理数据', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    renderApp('/console');
    await screen.findByTestId('identity-gate');

    expect(identityApi.fetchCapabilities).not.toHaveBeenCalled();
    expect(treeApi.fetchPublicTrees).not.toHaveBeenCalled();
    expect(treeApi.fetchPublicTree).not.toHaveBeenCalled();
    expect(treeApi.fetchPersonalLibrary).not.toHaveBeenCalled();
    expect(treeApi.fetchPersonalTree).not.toHaveBeenCalled();
    expect(generationApi.readPlatformGenerationEntitlements).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminDashboard).not.toHaveBeenCalled();
  });

  it('登录成功后才进入主应用并开始请求数据', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    identityApi.loginIdentity.mockImplementation(async () => { identityApi.fetchCurrentSession.mockResolvedValue(authenticated); return authenticated; });
    renderApp('/console');

    const gate = await screen.findByTestId('identity-gate');
    await user.type(within(gate).getByLabelText('用户名'), 'firstuser');
    await user.type(within(gate).getByLabelText('密码'), 'safe-password-2026');
    const loginButtons = within(gate).getAllByRole('button', { name: '登录' });

    expect(treeApi.fetchPublicTrees).not.toHaveBeenCalled();
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/console');
    await waitFor(() => expect(treeApi.fetchPublicTrees).toHaveBeenCalled());
    await waitFor(() => expect(identityApi.fetchCapabilities).toHaveBeenCalled());
  });

  it('登录失败后仍停留在门禁并显示错误', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(null);
    identityApi.loginIdentity.mockRejectedValue(new Error('用户名或密码错误，请重试。'));
    renderApp('/console');

    const gate = await screen.findByTestId('identity-gate');
    await user.type(within(gate).getByLabelText('用户名'), 'firstuser');
    await user.type(within(gate).getByLabelText('密码'), 'wrong-password');
    const loginButtons = within(gate).getAllByRole('button', { name: '登录' });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await within(gate).findByRole('alert')).toHaveTextContent(
      '请求暂时失败，请稍后重试。',
    );
    expect(screen.getByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-list')).not.toBeInTheDocument();
  });

  it('已登录用户刷新后仍停留在当前控制台路径', async () => {
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp('/console');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/console');

    cleanup();
    renderApp('/console');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/console');
  });

  it('退出登录后回到门禁并清理旧用户数据', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    identityApi.logoutIdentity.mockResolvedValue(undefined);
    treeApi.fetchPersonalLibrary.mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    const { queryClient } = renderApp('/console');

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    window.localStorage.setItem(
      'mapflow.console.state.v1.MF-7K3P-9D2Q-X8CW',
      'stale-user-state',
    );
    await user.click(screen.getByRole('button', { name: '我的地图' }));
    await screen.findByText('0/2 已完成');
        await user.click(screen.getByRole('button', { name: '退出登录' }));
    await user.click(screen.getByRole('button', { name: '确认退出' }));

    expect(await screen.findByTestId('identity-gate')).toBeInTheDocument();
    expect(screen.queryByText(authenticated.account.playerId)).not.toBeInTheDocument();
    expect(screen.queryByText('NestJS 完整学习树')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(['trees', 'public'])).toBeUndefined();
    expect(
      queryClient.getQueryData(['me', authenticated.account.playerId, 'tree-library']),
    ).toBeUndefined();
    expect(
      window.localStorage.getItem('mapflow.console.state.v1.MF-7K3P-9D2Q-X8CW'),
    ).toBeNull();
  });
});

function renderApp(path?: string) {
  if (path) window.history.replaceState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <IdentityProvider>
          <App />
        </IdentityProvider>
      </QueryClientProvider>,
    ),
  };
}

const nestjsTree = {
  id: '11111111-1111-4111-8111-111111111111',
  topic: 'NestJS',
  title: 'NestJS 完整学习树',
  description: '79 个完整节点',
  difficulty_level: 'intermediate',
  total_nodes: 2,
};

const agentTree = {
  id: '22222222-2222-4222-8222-222222222222',
  topic: 'Python Agent',
  title: 'Python Agent 完整学习树',
  description: '74 个完整节点',
  difficulty_level: 'advanced',
  total_nodes: 2,
};

const baseNode = {
  tree_id: nestjsTree.id,
  description: null,
  icon: 'box',
  category: 'foundation',
  difficulty: 1,
  estimated_minutes: 30,
  depth_level: 0,
  position_x: 0,
  position_y: 0,
  order_in_level: 0,
  learning_objectives: null,
  key_concepts: null,
  recommended_depth: 'Understand' as const,
  depth_rationale: '理解边界',
  observable_evidence: '["可以解释概念"]',
};

const nestjsGraph = {
  tree: nestjsTree,
  nodes: [
    { ...baseNode, id: 'node-1', title: '基础节点' },
    {
      ...baseNode,
      id: 'node-2',
      title: '进阶节点',
      depth_level: 1,
      order_in_level: 1,
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source_node_id: 'node-1',
      target_node_id: 'node-2',
      edge_type: 'prerequisite',
      label: null,
    },
  ],
};

const agentGraph = {
  tree: agentTree,
  nodes: [
    {
      ...baseNode,
      id: 'agent-node-1',
      tree_id: agentTree.id,
      title: 'Agent 基础',
    },
  ],
  edges: [],
};

const personalEntry = {
  library_entry_id: '33333333-3333-4333-8333-333333333333',
  tree: nestjsTree,
  completed_nodes: 0,
};

function personalDetail(
  completedNodeIds: string[],
  nodeProgress: Array<{ node_id: string; progress_percent: number }> = [],
  progress_percent = completedNodeIds.length ? 50 : 0,
) {
  const effectiveNodeProgress = nodeProgress.length
    ? nodeProgress
    : completedNodeIds.map((node_id) => ({ node_id, progress_percent: 100 }));
  return {
    view_mode: 'personal',
    library_entry_id: personalEntry.library_entry_id,
    graph: nestjsGraph,
    completed_node_ids: completedNodeIds,
    node_progress: effectiveNodeProgress,
    progress_percent,
  };
}

const legacySnapshot = {
  tree: {
    ...nestjsTree,
    title: 'Rust Axum 两节点演示',
  },
  nodes: nestjsGraph.nodes,
  edges: nestjsGraph.edges,
  current_node_id: null,
  progress: [],
  demo_source: 'legacy',
};
