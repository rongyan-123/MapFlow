import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityApiError } from '../identity/identityClient';
import AdminPanel from './AdminPanel';
import type {
  AdminAccount,
  AdminAuditEventsPage,
  AdminDashboard,
  AdminInvitationsResponse,
} from './types';

const adminApi = vi.hoisted(() => ({
  fetchAdminDashboard: vi.fn(),
  fetchAdminAccounts: vi.fn(),
  fetchAdminInvitations: vi.fn(),
  fetchAdminAuditEvents: vi.fn(),
  fetchAdminAuditEventsPage: vi.fn(),
  suspendAdminAccount: vi.fn(),
  revokeAdminInvitation: vi.fn(),
}));

vi.mock('./adminClient', () => adminApi);

function dashboard(): AdminDashboard {
  return {
    registeredAccounts: 12,
    availableInvites: 3,
    redeemedInvites: 9,
    revokedInvites: 1,
    activeSessions: 7,
    platformConsumedUsages: 42,
    platformConsumedTokens: 123456,
    // 第 3 天（08-15）是 7 日最大值 8，最后一天（08-19）只有 3 ——
    // 刻意让「最后一天 ≠ 最大值」，以钉死「今日登录」取最后一天而非最高日的口径。
    loginTrend7d: [
      { date: '2026-08-13', activeAccounts: 2 },
      { date: '2026-08-14', activeAccounts: 4 },
      { date: '2026-08-15', activeAccounts: 8 },
      { date: '2026-08-16', activeAccounts: 5 },
      { date: '2026-08-17', activeAccounts: 4 },
      { date: '2026-08-18', activeAccounts: 6 },
      { date: '2026-08-19', activeAccounts: 3 },
    ],
  };
}

function accounts(): AdminAccount[] {
  return [
    {
      accountId: 'acc-1',
      username: 'firstuser',
      status: 'active',
      registeredAt: '2026-08-01T08:00:00Z',
      lastSeenAt: '2026-08-19T08:00:00Z',
      byokSessions: 2,
      platformSessions: 5,
      totalTokens: 9000,
    },
    {
      accountId: 'acc-2',
      username: 'seconduser',
      status: 'suspended',
      registeredAt: '2026-08-02T08:00:00Z',
      lastSeenAt: null,
      byokSessions: 0,
      platformSessions: 0,
      totalTokens: 0,
    },
  ];
}

function invitationsResponse(): AdminInvitationsResponse {
  return {
    summary: { available: 2, redeemed: 1, revoked: 0 },
    items: [
      {
        inviteId: 'inv-1',
        status: 'available',
        createdAt: '2026-08-15T10:00:00Z',
        claimedIp: null,
        claimedAt: null,
        redeemedBy: null,
        redeemedAt: null,
      },
      {
        inviteId: 'inv-2',
        status: 'redeemed',
        createdAt: '2026-08-14T10:00:00Z',
        claimedIp: '120.230.61.229',
        claimedAt: '2026-08-16T03:40:11Z',
        redeemedBy: '焦糖牛之角',
        redeemedAt: '2026-08-16T03:40:31Z',
      },
    ],
  };
}

function auditPage(
  events: AdminAuditEventsPage['events'],
  total: number,
): AdminAuditEventsPage {
  return { events, total };
}

beforeEach(() => {
  for (const mock of Object.values(adminApi)) mock.mockReset();
  adminApi.fetchAdminDashboard.mockResolvedValue(dashboard());
  adminApi.fetchAdminAccounts.mockResolvedValue(accounts());
  adminApi.fetchAdminInvitations.mockResolvedValue(invitationsResponse());
  adminApi.fetchAdminAuditEventsPage.mockResolvedValue(
    auditPage(
      [
        {
          eventId: 'ev-1',
          eventType: 'identity.registered',
          outcome: 'succeeded',
          playerId: 'MF-AAAA-AAAA',
          occurredAt: '2026-08-16T03:40:11Z',
        },
        {
          eventId: 'ev-2',
          eventType: 'identity.logged_in',
          outcome: 'succeeded',
          playerId: 'MF-BBBB-BBBB',
          occurredAt: '2026-08-17T03:40:11Z',
        },
      ],
      2,
    ),
  );
});

function renderAdminPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = { onBack: vi.fn(), csrfToken: 'csrf-secret' };
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminPanel {...props} />
      </QueryClientProvider>,
    ),
    props,
  };
}

describe('AdminPanel', () => {
  it('renders the four tabs, opens the overview by default, and goes back', async () => {
    const user = userEvent.setup();
    const { props } = renderAdminPanel();

    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '用户' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '邀请码' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();

    await waitFor(() =>
      expect(adminApi.fetchAdminDashboard).toHaveBeenCalledWith('csrf-secret'),
    );
    expect(adminApi.fetchAdminAccounts).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminInvitations).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminAuditEventsPage).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('overview renders the metric cards and the tallest bar of the 7-day trend', async () => {
    renderAdminPanel();

    expect(await screen.findByLabelText('注册总数 12')).toBeInTheDocument();
    // 「今日登录」= 趋势最后一天（08-19），不是最高日。
    expect(screen.getByLabelText('今日登录 3')).toBeInTheDocument();
    expect(screen.getByLabelText('活跃会话 7')).toBeInTheDocument();
    expect(screen.getByLabelText('剩余邀请码 3')).toBeInTheDocument();
    expect(screen.getByLabelText('平台消耗次数 42')).toBeInTheDocument();
    expect(screen.getByLabelText('平台消耗 token 123456')).toBeInTheDocument();
    expect(screen.getByText('最近 7 日登录趋势')).toBeInTheDocument();

    // 柱高按 7 日最大值归一化：最高日（08-15，8 人）柱高 100%；
    // 最后一天（08-19，3 人）柱高 3/8 ≈ 38%，并非最高柱。
    const tallestBar = screen.getByLabelText('2026-08-15 8 人登录');
    expect(tallestBar).toHaveStyle({ height: '100%' });
    expect(screen.getByLabelText('2026-08-19 3 人登录')).toHaveStyle({
      height: '38%',
    });
    expect(screen.getByLabelText('2026-08-13 2 人登录')).toHaveStyle({
      height: '25%',
    });
  });

  it('overview shows 今日登录 0 without crashing when the trend is empty', async () => {
    adminApi.fetchAdminDashboard.mockResolvedValue({
      ...dashboard(),
      loginTrend7d: [],
    });
    renderAdminPanel();

    expect(await screen.findByLabelText('今日登录 0')).toBeInTheDocument();
    expect(screen.getByText('最近 7 日登录趋势')).toBeInTheDocument();
  });

  it('accounts renders usernames and suspends an account after inline confirmation', async () => {
    const user = userEvent.setup();
    adminApi.suspendAdminAccount.mockResolvedValue(undefined);
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '用户' }));
    expect(await screen.findByText('firstuser')).toBeInTheDocument();
    expect(screen.getByText('seconduser')).toBeInTheDocument();
    // 后端输出 RFC3339 UTC，界面必须显式标注 UTC，避免东八区操作员误读
    expect(screen.getByText('2026-08-01 08:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('2026-08-19 08:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('正常')).toBeInTheDocument();
    expect(screen.getByText('已封禁')).toBeInTheDocument();

    // 只有 active 账号出现封禁按钮；已封禁账号不出现。
    const suspendButtons = screen.getAllByRole('button', { name: '封禁' });
    expect(suspendButtons).toHaveLength(1);

    await user.click(suspendButtons[0]);
    expect(screen.getByRole('button', { name: '确认封禁' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认封禁' }));

    await waitFor(() =>
      expect(adminApi.suspendAdminAccount).toHaveBeenCalledWith(
        'acc-1',
        'csrf-secret',
      ),
    );
    await waitFor(() =>
      expect(adminApi.fetchAdminAccounts).toHaveBeenCalledTimes(2),
    );
  });

  it('invitations renders the summary and statuses, and revokes after inline confirmation', async () => {
    const user = userEvent.setup();
    adminApi.revokeAdminInvitation.mockResolvedValue(undefined);
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '邀请码' }));
    expect(await screen.findByText('邀请码分布')).toBeInTheDocument();
    // 汇总：可用 2 / 已兑换 1 / 已作废 0；列表项展示状态与兑换信息。
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('兑换人 焦糖牛之角')).toBeInTheDocument();
    expect(screen.getByText('创建于 2026-08-15 10:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('兑换于 2026-08-16 03:40 UTC')).toBeInTheDocument();
    expect(screen.getAllByText('可用').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已兑换').length).toBeGreaterThanOrEqual(1);

    // 只有 available 邀请码出现作废按钮。
    expect(screen.getAllByRole('button', { name: '作废' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '作废' }));
    expect(screen.getByRole('button', { name: '确认作废' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认作废' }));

    await waitFor(() =>
      expect(adminApi.revokeAdminInvitation).toHaveBeenCalledWith(
        'inv-1',
        'csrf-secret',
      ),
    );
    await waitFor(() =>
      expect(adminApi.fetchAdminInvitations).toHaveBeenCalledTimes(2),
    );
  });

  it('invitations shows the Chinese message when revoking an already redeemed code fails with 409', async () => {
    const user = userEvent.setup();
    adminApi.revokeAdminInvitation.mockRejectedValue(
      new IdentityApiError(
        409,
        'admin.invitation_already_redeemed',
        '该邀请码已被兑换，无法作废。',
      ),
    );
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '邀请码' }));
    await screen.findByText('邀请码分布');
    await user.click(screen.getByRole('button', { name: '作废' }));
    await user.click(screen.getByRole('button', { name: '确认作废' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('该邀请码已被兑换，无法作废。');
    expect(adminApi.revokeAdminInvitation).toHaveBeenCalledWith(
      'inv-1',
      'csrf-secret',
    );
  });

  it('audit renders event types and re-requests when the type filter changes', async () => {
    const user = userEvent.setup();
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '审计日志' }));
    expect(await screen.findAllByText('identity.registered')).not.toHaveLength(0);
    expect(screen.getAllByText('identity.logged_in')).not.toHaveLength(0);
    expect(screen.getByText('2026-08-16 03:40 UTC')).toBeInTheDocument();
    await waitFor(() =>
      expect(adminApi.fetchAdminAuditEventsPage).toHaveBeenCalledWith(
        'csrf-secret',
        { limit: 50, offset: 0 },
      ),
    );

    await user.selectOptions(
      screen.getByLabelText('事件类型'),
      'identity.registered',
    );
    await waitFor(() =>
      expect(adminApi.fetchAdminAuditEventsPage).toHaveBeenLastCalledWith(
        'csrf-secret',
        { eventType: 'identity.registered', limit: 50, offset: 0 },
      ),
    );
  });

  it('audit paginates by offset using the total from the server', async () => {
    const user = userEvent.setup();
    adminApi.fetchAdminAuditEventsPage.mockResolvedValue(
      auditPage(
        [
          {
            eventId: 'ev-1',
            eventType: 'identity.logged_in',
            outcome: 'succeeded',
            playerId: 'MF-AAAA-AAAA',
            occurredAt: '2026-08-17T03:40:11Z',
          },
        ],
        120,
      ),
    );
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '审计日志' }));
    expect(await screen.findByText('第 1 / 3 页 · 共 120 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() =>
      expect(adminApi.fetchAdminAuditEventsPage).toHaveBeenLastCalledWith(
        'csrf-secret',
        { limit: 50, offset: 50 },
      ),
    );
    expect(await screen.findByText('第 2 / 3 页 · 共 120 条')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() =>
      expect(adminApi.fetchAdminAuditEventsPage).toHaveBeenLastCalledWith(
        'csrf-secret',
        { limit: 50, offset: 100 },
      ),
    );
    expect(await screen.findByText('第 3 / 3 页 · 共 120 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  });
});
