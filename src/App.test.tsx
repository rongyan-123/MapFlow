import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  IdentityProvider,
  SESSION_QUERY_KEY,
} from './features/identity/IdentityContext';

const identityApi = vi.hoisted(() => ({
  fetchCapabilities: vi.fn(),
  fetchCurrentSession: vi.fn(),
  loginIdentity: vi.fn(),
  logoutIdentity: vi.fn(),
  registerIdentity: vi.fn(),
}));

const treeApi = vi.hoisted(() => ({
  addTreeToPersonalLibrary: vi.fn(),
  fetchPersonalLibrary: vi.fn(),
  fetchPersonalTree: vi.fn(),
  fetchPublicTree: vi.fn(),
  fetchPublicTrees: vi.fn(),
  setNodeCompletion: vi.fn(),
}));

const generationApi = vi.hoisted(() => ({
  readPlatformGenerationEntitlements: vi.fn(),
}));

const legacyApi = vi.hoisted(() => ({ fetchLearningTree: vi.fn() }));

const adminApi = vi.hoisted(() => ({
  fetchAdminDashboard: vi.fn(),
  fetchAdminAccounts: vi.fn(),
  fetchAdminInvitations: vi.fn(),
  fetchAdminAuditEvents: vi.fn(),
  fetchAdminAuditEventsPage: vi.fn(),
  suspendAdminAccount: vi.fn(),
  revokeAdminInvitation: vi.fn(),
}));

vi.mock('./features/identity/identityClient', () => identityApi);
vi.mock('./features/tree-library/treeLibraryClient', () => treeApi);
vi.mock('./features/tree-generation/treeGenerationClient', () => generationApi);
vi.mock('./features/admin/adminClient', () => adminApi);
vi.mock('./lib/api', () => legacyApi);

const announcementsApi = vi.hoisted(() => ({ getAnnouncements: vi.fn() }));

vi.mock('./features/announcements/announcementsClient', () => announcementsApi);
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
    data: {
      node: { title: string };
      progress: { status: string } | null;
      displayMode?: string;
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

  function ReactFlow({
    nodes,
    onNodeClick,
    children,
  }: {
    nodes: FlowNode[];
    onNodeClick?: (event: React.MouseEvent, node: FlowNode) => void;
    children?: React.ReactNode;
  }) {
    return (
      <div data-testid="react-flow-boundary">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-label={`查看节点 ${node.data.node.title}`}
            data-status={node.data.progress?.status ?? 'not_started'}
            data-display-mode={node.data.displayMode}
            onClick={(event) => onNodeClick?.(event, node)}
          >
            {node.data.node.title}
          </button>
        ))}
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
  for (const mock of Object.values(identityApi)) mock.mockReset();
  for (const mock of Object.values(treeApi)) mock.mockReset();
  for (const mock of Object.values(adminApi)) mock.mockReset();
  legacyApi.fetchLearningTree.mockReset();
  announcementsApi.getAnnouncements.mockReset();
  announcementsApi.getAnnouncements.mockResolvedValue({ items: [], unreadCount: 0 });
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
  identityApi.fetchCurrentSession.mockResolvedValue(null);
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
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('MapFlow tree library', () => {
  it('lets a visitor inspect two complete public trees and opens identity for joining', async () => {
    const user = userEvent.setup();
    renderApp();

    expect((await screen.findAllByText('NestJS 完整学习树')).length).toBeGreaterThan(0);
    expect(screen.getByText('Python Agent 完整学习树')).toBeInTheDocument();
    expect(
      await screen.findByText('示例展示 · 加入后从 0 开始'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Rust Axum 两节点演示')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '加入我的学习' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(treeApi.addTreeToPersonalLibrary).not.toHaveBeenCalled();
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
      await screen.findByRole('button', { name: '加入我的学习' }),
    );
    await waitFor(() =>
      expect(treeApi.addTreeToPersonalLibrary).toHaveBeenCalledWith(
        nestjsTree.id,
        'csrf-secret',
      ),
    );
    expect(await screen.findByText('总进度 0%')).toBeInTheDocument();
    expect(screen.getByText('我的学习')).toHaveAttribute('aria-current', 'page');

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

  it('switches between the two catalog trees without using the old canary endpoint', async () => {
    const user = userEvent.setup();
    renderApp();

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
    await user.click(screen.getByRole('button', { name: '我的学习' }));

    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
  });

  it('does not expose the previous account personal library after logout and login', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    identityApi.logoutIdentity.mockResolvedValue(undefined);
    identityApi.loginIdentity.mockResolvedValue(secondAccount);
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [personalEntry] })
      .mockResolvedValueOnce({ entries: [] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的学习' }));
    expect(await screen.findByText('0/2 已完成')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '退出登录' }));
    expect(
      await screen.findByRole('button', { name: '登录 / 激活账号' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '登录 / 激活账号' }));
    await user.type(screen.getByLabelText('用户名'), secondAccount.account.username);
    await user.type(screen.getByLabelText('密码'), 'safe-password-2026');
    const loginButtons = screen.getAllByRole('button', { name: '登录' });
    await user.click(loginButtons[loginButtons.length - 1]);

    expect(await screen.findByText(secondAccount.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的学习' }));

    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0/2 已完成')).not.toBeInTheDocument();
    expect(treeApi.fetchPersonalLibrary).toHaveBeenCalledTimes(2);
  });

  it('opens generation only from an authenticated personal library and selects its result', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    treeApi.fetchPersonalLibrary
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValue({ entries: [personalEntry] });
    treeApi.fetchPersonalTree.mockResolvedValue(personalDetail([]));
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成新技能树' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的学习' }));
    await user.click(screen.getByRole('button', { name: '生成新技能树' }));
    expect(screen.getByRole('dialog', { name: 'mock tree generator' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存生成会话' }));
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
    renderApp();

    expect(await screen.findByText(authenticated.account.playerId)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '我的学习' }));
    await user.click(screen.getByRole('button', { name: '生成新技能树' }));
    await user.click(screen.getByRole('button', { name: '保存生成会话' }));
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
    expect(await screen.findByText('平台免费生成剩余 1 次')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '我的学习' })).toHaveAttribute(
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

  it('falls back to the public view when the session disappears inside the admin view', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    const { queryClient } = renderApp();

    await user.click(await screen.findByRole('button', { name: '管理面板' }));
    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();

    identityApi.fetchCurrentSession.mockResolvedValue(null);
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

    expect(await screen.findByRole('button', { name: '公共树库' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.queryByRole('heading', { name: '管理面板' }),
    ).not.toBeInTheDocument();
  });
});

describe('手机端视图栈', () => {
  it('初始显示列表页：列表可见、图与详情隐藏、无返回按钮', async () => {
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-graph').className).toContain('hidden');
    expect(screen.getByTestId('mobile-detail').className).toContain('hidden');
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
    expect(screen.getByTestId('mobile-graph').className).toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-detail').className).toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(
      screen.queryByRole('button', { name: '返回上一级' }),
    ).not.toBeInTheDocument();
  });
});

describe('手机端抽屉', () => {
  it('点 ☰ 打开抽屉，点「我的学习」进入个人视图并关闭抽屉', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.click(within(drawer).getByRole('button', { name: '我的学习' }));

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
    await screen.findByText(adminAccount.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '管理面板',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();
  });

  it('未登录时抽屉提供登录入口', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '登录 / 激活账号',
      }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('登录后抽屉的公告入口打开公告列表', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '公告',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: '全部公告' }),
    ).toBeInTheDocument();
  });

  it('identity 功能关闭时抽屉不渲染登录入口', async () => {
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
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.click(
      within(drawer).getByRole('button', { name: '退出登录' }),
    );

    const alert = await within(drawer).findByRole('alert');
    expect(alert).toHaveTextContent('登出失败');
  });

  it('session 失效后重新登录不自动弹出残留的公告弹窗', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    const { queryClient } = renderApp();
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
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
    await screen.findByText(authenticated.account.playerId);

    expect(
      screen.queryByRole('dialog', { name: '全部公告' }),
    ).not.toBeInTheDocument();
  });
});

function renderApp() {
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

function personalDetail(completedNodeIds: string[]) {
  return {
    view_mode: 'personal',
    library_entry_id: personalEntry.library_entry_id,
    graph: nestjsGraph,
    completed_node_ids: completedNodeIds,
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
