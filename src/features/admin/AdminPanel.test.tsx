import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityApiError } from '../identity/identityClient';
import AdminPanel from './AdminPanel';
import type {
  AdminAccount,
  AdminAnnouncement,
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
  fetchAdminFeedback: vi.fn(),
  fetchAdminAnnouncements: vi.fn(),
  createAdminAnnouncement: vi.fn(),
  deleteAdminAnnouncement: vi.fn(),
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
    // 消耗图同理：第 3 天（08-15）是 7 日最高 6 次，最后一天（08-19）2 次。
    currentOnline: 5,
    consecutive3dLogins: 2,
    totalActiveMinutes: 390,
    avgActiveMinutes: 65,
    dailyConsumed7d: [
      { date: '2026-08-13', consumed: 1 },
      { date: '2026-08-14', consumed: 2 },
      { date: '2026-08-15', consumed: 6 },
      { date: '2026-08-16', consumed: 4 },
      { date: '2026-08-17', consumed: 3 },
      { date: '2026-08-18', consumed: 5 },
      { date: '2026-08-19', consumed: 2 },
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
      platformConsumedUsages: 11,
      activeMinutes: 95,
      creditBalance: 0,
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
      platformConsumedUsages: 0,
      activeMinutes: 0,
      creditBalance: 0,
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

function announcements(): AdminAnnouncement[] {
  return [
    {
      announcementId: 'ann-1',
      title: '系统维护通知',
      content: '本周六 22:00 停机维护。',
      createdAt: '2026-08-18T10:00:00Z',
      readCount: 3,
    },
  ];
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
          details: { client_ip: '203.0.113.7' },
        },
        {
          eventId: 'ev-2',
          eventType: 'identity.logged_in',
          outcome: 'succeeded',
          playerId: 'MF-BBBB-BBBB',
          occurredAt: '2026-08-17T03:40:11Z',
          details: { client_ip: '198.51.100.23' },
        },
      ],
      2,
    ),
  );
  adminApi.fetchAdminFeedback.mockResolvedValue({ items: [], total: 0 });
  adminApi.fetchAdminAnnouncements.mockResolvedValue([]);
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
  it('renders the six tabs, opens the overview by default, and goes back', async () => {
    const user = userEvent.setup();
    const { props } = renderAdminPanel();

    expect(screen.getByRole('tab', { name: '概览' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '用户' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '邀请码' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '反馈' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '公告' })).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();

    await waitFor(() =>
      expect(adminApi.fetchAdminDashboard).toHaveBeenCalledWith('csrf-secret'),
    );
    expect(adminApi.fetchAdminAccounts).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminInvitations).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminAuditEventsPage).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminFeedback).not.toHaveBeenCalled();
    expect(adminApi.fetchAdminAnnouncements).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '返回' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('overview renders the metric cards and the tallest bar of the 7-day trend', async () => {
    renderAdminPanel();

    expect(await screen.findByLabelText('注册总数 12')).toBeInTheDocument();
    // 「今日登录」= 趋势最后一天（08-19），不是最高日。
    expect(screen.getByLabelText('今日登录 3')).toBeInTheDocument();
    expect(screen.getByLabelText('活跃会话 7')).toBeInTheDocument();
    expect(screen.getByLabelText('未领取邀请码 3')).toBeInTheDocument();
    expect(screen.getByLabelText('平台消耗次数 42')).toBeInTheDocument();
    expect(screen.getByLabelText('平台消耗 token 123456')).toBeInTheDocument();
    // v2 新指标卡片：当前在线 / 连续 3 天在线 / 总停留时长 / 人均停留时长（分钟经 formatMinutes）。
    expect(screen.getByLabelText('当前在线 5')).toBeInTheDocument();
    expect(screen.getByLabelText('连续 3 天在线 2')).toBeInTheDocument();
    expect(screen.getByLabelText('总停留时长 6h 30m')).toBeInTheDocument();
    expect(screen.getByLabelText('人均停留时长 1h 5m')).toBeInTheDocument();
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

    // 每日消耗次数图：最高日（08-15，6 次）柱高 100%，08-19（2 次）2/6 ≈ 33%。
    expect(screen.getByText('每日消耗次数')).toBeInTheDocument();
    expect(screen.getByLabelText('2026-08-15 消耗 6 次')).toHaveStyle({
      height: '100%',
    });
    expect(screen.getByLabelText('2026-08-19 消耗 2 次')).toHaveStyle({
      height: '33%',
    });
  });

  it('overview shows 今日登录 0 without crashing when the trend is empty', async () => {
    adminApi.fetchAdminDashboard.mockResolvedValue({
      ...dashboard(),
      loginTrend7d: [],
      dailyConsumed7d: [],
    });
    renderAdminPanel();

    expect(await screen.findByLabelText('今日登录 0')).toBeInTheDocument();
    expect(screen.getByText('最近 7 日登录趋势')).toBeInTheDocument();
    // 消耗图空数组显示空态文案。
    expect(screen.getByText('每日消耗次数')).toBeInTheDocument();
    expect(screen.getByText('近 7 日暂无平台消耗记录。')).toBeInTheDocument();
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
    // v2 新列：平台消耗次数（11 / 0）与停留时长（95 分钟 → 1h 35m；0 → 0m）。
    expect(screen.getByText('平台消耗次数')).toBeInTheDocument();
    expect(screen.getByText('停留时长')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('1h 35m')).toBeInTheDocument();
    expect(screen.getByText('0m')).toBeInTheDocument();

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

  it('audit renders Chinese event titles, outcomes, and IPs, and re-requests when the type filter changes', async () => {
    const user = userEvent.setup();
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '审计日志' }));
    // 事件列渲染中文标题 + 描述（下拉里也有同名选项，故用 within 限定表格范围）。
    const table = await screen.findByRole('table');
    expect(within(table).getByText('注册账号')).toBeInTheDocument();
    expect(within(table).getByText('新用户通过邀请码注册')).toBeInTheDocument();
    expect(within(table).getByText('用户登录')).toBeInTheDocument();
    expect(within(table).getByText('用户登录系统')).toBeInTheDocument();
    // outcome 映射为中文：两条 succeeded → 两个「成功」徽标。
    expect(within(table).getAllByText('成功')).toHaveLength(2);
    // details JSONB 的 snake_case `client_ip` 透出为 IP 列。
    expect(within(table).getByText('203.0.113.7')).toBeInTheDocument();
    expect(within(table).getByText('198.51.100.23')).toBeInTheDocument();
    expect(within(table).getByText('2026-08-16 03:40 UTC')).toBeInTheDocument();
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
            details: { client_ip: '203.0.113.7' },
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

  it('audit falls back to raw strings for unknown event types and outcomes', async () => {
    const user = userEvent.setup();
    adminApi.fetchAdminAuditEventsPage.mockResolvedValue(
      auditPage(
        [
          {
            eventId: 'ev-9',
            eventType: 'custom.event',
            outcome: 'unknown-outcome',
            playerId: null,
            occurredAt: '2026-08-18T12:00:00Z',
            details: {},
          },
        ],
        1,
      ),
    );
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '审计日志' }));
    // 未知事件类型：标题回退原字符串；未知 outcome：回退原字符串。
    expect(await screen.findByText('custom.event')).toBeInTheDocument();
    expect(screen.getByText('unknown-outcome')).toBeInTheDocument();
  });

  it('announcements deletes an announcement only after inline confirmation', async () => {
    const user = userEvent.setup();
    adminApi.fetchAdminAnnouncements.mockResolvedValue(announcements());
    adminApi.deleteAdminAnnouncement.mockResolvedValue(undefined);
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '公告' }));
    expect(await screen.findByText('系统维护通知')).toBeInTheDocument();

    // 第一次点击只进入确认态，不发起删除。
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(adminApi.deleteAdminAnnouncement).not.toHaveBeenCalled();
    expect(screen.getByText('确认删除？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument();

    // 取消按钮可退出确认态，恢复为普通删除按钮。
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByText('确认删除？')).not.toBeInTheDocument();

    // 再次进入确认态后点确认才真正删除。
    await user.click(screen.getByRole('button', { name: '删除' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() =>
      expect(adminApi.deleteAdminAnnouncement).toHaveBeenCalledWith(
        'ann-1',
        'csrf-secret',
      ),
    );
    await waitFor(() =>
      expect(adminApi.fetchAdminAnnouncements).toHaveBeenCalledTimes(2),
    );
  });

  it('announcements shows the error banner when deletion fails', async () => {
    const user = userEvent.setup();
    adminApi.fetchAdminAnnouncements.mockResolvedValue(announcements());
    adminApi.deleteAdminAnnouncement.mockRejectedValue(
      new IdentityApiError(
        409,
        'admin.announcement_not_found',
        '公告不存在，可能已被删除。',
      ),
    );
    renderAdminPanel();

    await user.click(screen.getByRole('tab', { name: '公告' }));
    await screen.findByText('系统维护通知');
    await user.click(screen.getByRole('button', { name: '删除' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('公告不存在，可能已被删除。');
  });
});
