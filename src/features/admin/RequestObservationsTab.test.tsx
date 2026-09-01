import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type {
  AdminRequestObservation,
  AdminRequestObservationSummary,
  AdminRequestStage,
  AdminRequestStageSummary,
  ObservationEvidence,
  RequestStageId,
  RequestStageStatus,
} from './types';
import RequestObservationsTab from './RequestObservationsTab';

const adminApi = vi.hoisted(() => ({
  fetchAdminRequestObservations: vi.fn(),
  fetchAdminRequestObservation: vi.fn(),
}));

vi.mock('./adminClient', () => adminApi);

const REQUEST_ID = '81000000-0000-4000-8000-000000000301';

beforeEach(() => {
  adminApi.fetchAdminRequestObservations.mockReset();
  adminApi.fetchAdminRequestObservation.mockReset();
  adminApi.fetchAdminRequestObservations.mockResolvedValue({
    items: [summary()],
    total: 1,
    delivery: {
      persistedSinceStart: 120,
      queueDroppedSinceStart: 2,
      writeFailedSinceStart: 1,
      queued: 3,
      capacity: 256,
    },
  });
  adminApi.fetchAdminRequestObservation.mockResolvedValue(detail());
});

it('draws every fixed lifecycle node and exposes friendly plus raw diagnostics', async () => {
  const user = userEvent.setup();
  renderTab();

  expect(await screen.findByText('邀请码领取频率守卫拒绝了请求')).toBeInTheDocument();
  expect(screen.getByText('本进程已有 3 条观测未能落库')).toBeInTheDocument();
  expect(screen.getByText('当前排队 3 / 256')).toBeInTheDocument();
  expect(screen.getByText('/api/invitations/claim')).toBeInTheDocument();
  expect(screen.getByText('429')).toBeInTheDocument();

  await user.click(
    screen.getByRole('button', { name: `查看请求 ${REQUEST_ID}` }),
  );

  const dialog = await screen.findByRole('dialog', { name: '请求生命周期详情' });
  const timeline = within(dialog).getByLabelText('请求生命周期');
  expect(timeline).toHaveClass('lg:grid-cols-11');
  expect(
    within(dialog).getByText(/最后一个节点就是本次响应落点/),
  ).toBeInTheDocument();
  for (const title of [
    '客户端 / 浏览器',
    'Caddy 入口',
    'MapFlow HTTP 路由',
    '通用安全守卫',
    '身份与权限校验',
    'HTTP 处理器（类似 Controller）',
    '业务服务',
    'PostgreSQL',
    '进程内 Worker / 队列',
    '外部依赖',
    'HTTP 响应',
  ]) {
    expect(within(timeline).getByText(title)).toBeInTheDocument();
  }
  expect(within(timeline).getAllByText('未经过').length).toBeGreaterThan(0);
  expect(within(timeline).getAllByText('不适用').length).toBeGreaterThan(0);

  const lanes = within(dialog).getByLabelText('运行位置泳道');
  for (const lane of ['Caddy', 'mapflow-app', 'PostgreSQL', '进程内 Worker', '外部服务']) {
    expect(within(lanes).getByText(lane)).toBeInTheDocument();
  }

  await user.click(
    within(timeline).getByRole('button', {
      name: '通用安全守卫：被拒绝',
    }),
  );
  expect(within(dialog).getByText('为什么停在这里')).toBeInTheDocument();
  expect(
    within(dialog).getByText('有效客户端 IP 在 24 小时内已经领取过邀请码。'),
  ).toBeInTheDocument();
  const raw = within(dialog).getByLabelText('脱敏后的原始技术诊断');
  expect(raw).toHaveTextContent('invitation.claim_rate_limited');
  expect(raw).toHaveTextContent('429');
  expect(within(dialog).getByText('技术诊断已截断')).toBeInTheDocument();
  expect(within(dialog).getByText('+4 ms')).toBeInTheDocument();
  expect(within(dialog).getByText('生命周期 v2 · 脱敏规则 v1')).toBeInTheDocument();
  expect(within(dialog).getByText('请求 128 B · 响应 256 B')).toBeInTheDocument();
});

it('shows captured operations beside the friendly explanation and raw diagnostic', async () => {
  const observedDetail = detail();
  Object.assign(observedDetail.stages[3], {
    operations: [
      {
        code: 'invitation.claim.ip_guard',
        status: 'rejected',
        evidence: 'measured',
        startedOffsetMs: 4,
        durationMs: 1,
        explanation: '命中 24 小时 IP 领取限制（原始操作码保留）。',
      },
    ],
    operationsTruncated: true,
  });
  adminApi.fetchAdminRequestObservation.mockResolvedValueOnce(observedDetail);
  const user = userEvent.setup();
  renderTab();

  await user.click(
    await screen.findByRole('button', { name: `查看请求 ${REQUEST_ID}` }),
  );
  const dialog = await screen.findByRole('dialog', { name: '请求生命周期详情' });
  const timeline = within(dialog).getByLabelText('请求生命周期');
  await user.click(
    within(timeline).getByRole('button', {
      name: '通用安全守卫：被拒绝',
    }),
  );

  expect(within(dialog).getByText('本阶段实际操作')).toBeInTheDocument();
  expect(within(dialog).getByText('invitation.claim.ip_guard')).toBeInTheDocument();
  expect(
    within(dialog).getByText('命中 24 小时 IP 领取限制（原始操作码保留）。'),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('操作记录已截断')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('脱敏后的原始技术诊断')).toHaveTextContent(
    'invitation.claim_rate_limited',
  );
});

it('shows the fixed lifecycle matrix, username, and endpoint in the list', async () => {
  const listSummary = summary();
  Object.assign(listSummary, {
    username: 'alice',
    accountId: 'account-301',
    actorKind: 'authenticated',
    lifecycleSchemaVersion: 2,
    lifecycleDataStatus: 'current',
    stages: compactStages(),
  });
  adminApi.fetchAdminRequestObservations.mockResolvedValueOnce({
    items: [listSummary],
    total: 1,
    delivery: null,
  });
  renderTab();

  expect(await screen.findByText('alice')).toBeInTheDocument();
  expect(screen.getByText('已登录用户')).toBeInTheDocument();
  const matrix = screen.getByLabelText('请求生命周期矩阵');
  expect(
    within(matrix).getByRole('button', { name: '客户端：已通过' }),
  ).toBeInTheDocument();
  expect(
    within(matrix).getByRole('button', { name: 'PG：未经过' }),
  ).toBeInTheDocument();
  expect(
    within(matrix).getByRole('button', { name: '响应：已通过' }),
  ).toBeInTheDocument();
  expect(within(matrix).getByRole('columnheader', { name: '响应' })).toBeInTheDocument();
});

it('defaults a successful request to the HTTP response stage', async () => {
  const successfulDetail = detail();
  successfulDetail.outcome = 'succeeded';
  successfulDetail.httpStatus = 200;
  successfulDetail.summary = '请求已成功完成';
  successfulDetail.terminalStage = null;
  successfulDetail.stages = successfulDetail.stages.map((currentStage) => {
    const isResponse = currentStage.id === 'response';
    return {
      ...currentStage,
      status: isResponse ? ('passed' as const) : ('not_reached' as const),
      evidence: isResponse ? ('measured' as const) : ('not_observed' as const),
      startedOffsetMs: isResponse ? 17 : null,
      durationMs: isResponse ? 1 : null,
    };
  });
  adminApi.fetchAdminRequestObservation.mockResolvedValueOnce(successfulDetail);
  const user = userEvent.setup();
  renderTab();

  await user.click(
    await screen.findByRole('button', { name: `查看请求 ${REQUEST_ID}` }),
  );
  const dialog = await screen.findByRole('dialog', { name: '请求生命周期详情' });
  const timeline = within(dialog).getByLabelText('请求生命周期');
  expect(
    within(timeline).getByRole('button', { name: 'HTTP 响应：已通过' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('filters by outcome and keeps the reader endpoint on manual refresh', async () => {
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('邀请码领取频率守卫拒绝了请求');

  await user.selectOptions(screen.getByLabelText('结果'), 'rejected');

  expect(adminApi.fetchAdminRequestObservations).toHaveBeenLastCalledWith(
    'csrf-secret',
    { outcome: 'rejected', limit: 50, offset: 0 },
  );
  expect(screen.getByRole('button', { name: '手动刷新' })).toBeInTheDocument();
});

it('filters by terminal lifecycle stage', async () => {
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('邀请码领取频率守卫拒绝了请求');

  await user.selectOptions(screen.getByLabelText('停止阶段'), 'security_guard');

  expect(adminApi.fetchAdminRequestObservations).toHaveBeenLastCalledWith(
    'csrf-secret',
    { terminalStage: 'security_guard', limit: 50, offset: 0 },
  );
});

it('applies advanced request-id and route-family filters as one query', async () => {
  const user = userEvent.setup();
  renderTab();
  await screen.findByText('邀请码领取频率守卫拒绝了请求');

  await user.click(screen.getByText('高级筛选'));
  await user.selectOptions(screen.getByLabelText('路由族'), 'knowledge_chat');
  await user.type(screen.getByLabelText('请求 ID'), REQUEST_ID);
  await user.click(screen.getByRole('button', { name: '应用高级筛选' }));

  await waitFor(() => {
    expect(adminApi.fetchAdminRequestObservations).toHaveBeenLastCalledWith(
      'csrf-secret',
      {
        routeFamily: 'knowledge_chat',
        requestId: REQUEST_ID,
        limit: 50,
        offset: 0,
      },
    );
  });
});

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RequestObservationsTab csrfToken="csrf-secret" />
    </QueryClientProvider>,
  );
}

function summary(): AdminRequestObservationSummary {
  return {
    requestId: REQUEST_ID,
    startedAt: '2026-08-31T11:59:59Z',
    completedAt: '2026-08-31T12:00:00Z',
    durationMs: 18,
    method: 'POST',
    route: '/api/invitations/claim',
    routeFamily: 'invitation',
    httpStatus: 429,
    requestBytes: 128,
    responseBytes: 256,
    outcome: 'rejected',
    summary: '邀请码领取频率守卫拒绝了请求',
    terminalStage: 'security_guard',
    errorCode: 'invitation.claim_rate_limited',
    effectiveClientIp: '198.51.100.23',
    accountId: null,
    username: null,
    correlationId: null,
    actorKind: 'unassociated',
    lifecycleSchemaVersion: 2,
    lifecycleDataStatus: 'current',
    stages: compactStages(),
  };
}

function detail(): AdminRequestObservation {
  return {
    ...summary(),
    peerIp: '172.30.0.3',
    lifecycleSchemaVersion: 2,
    redactionSchemaVersion: 1,
    stages: [
      stage('client', '客户端 / 浏览器', 'client', 'passed', '浏览器已发出请求。'),
      stage('edge_proxy', 'Caddy 入口', 'caddy', 'passed', 'Caddy 已转发请求。'),
      stage('router', 'MapFlow HTTP 路由', 'mapflow-app', 'passed', '路由已匹配。'),
      stage(
        'security_guard',
        '通用安全守卫',
        'mapflow-app',
        'rejected',
        '有效客户端 IP 在 24 小时内已经领取过邀请码。',
        { errorCode: 'invitation.claim_rate_limited', httpStatus: 429 },
      ),
      stage(
        'identity',
        '身份与权限校验',
        'mapflow-app',
        'not_applicable',
        '公开领取接口不要求登录。',
      ),
      stage(
        'http_handler',
        'HTTP 处理器（类似 Controller）',
        'mapflow-app',
        'not_reached',
        '本次请求没有到达此阶段。',
      ),
      stage('business_service', '业务服务', 'mapflow-app', 'not_reached', '本次请求没有到达此阶段。'),
      stage('database', 'PostgreSQL', 'postgres', 'not_reached', '本次请求没有到达此阶段。'),
      stage('worker', '进程内 Worker / 队列', 'mapflow-app', 'not_applicable', '本类请求不需要 Worker。'),
      stage('external_dependency', '外部依赖', 'external', 'not_reached', '本次请求没有到达此阶段。'),
      stage('response', 'HTTP 响应', 'mapflow-app', 'passed', '已返回 HTTP 429。'),
    ],
  };
}

function stage(
  id: RequestStageId,
  title: string,
  location: string,
  status: RequestStageStatus,
  explanation: string,
  technical: Record<string, unknown> = {},
): AdminRequestStage {
  return {
    id,
    title,
    location,
    status,
    evidence: status === 'not_reached' || status === 'not_applicable' ? 'not_observed' : 'measured',
    explanation,
    startedOffsetMs: id === 'security_guard' ? 4 : null,
    durationMs: status === 'passed' ? 2 : null,
    technical,
    technicalTruncated: id === 'security_guard',
    operations: [],
    operationsTruncated: false,
  };
}

function compactStages(): AdminRequestStageSummary[] {
  const definitions: [RequestStageId, RequestStageStatus, ObservationEvidence, number | null][] = [
    ['client', 'passed', 'measured', 2],
    ['edge_proxy', 'passed', 'confirmed_header', 1],
    ['router', 'passed', 'measured', 1],
    ['security_guard', 'rejected', 'measured', 3],
    ['identity', 'not_applicable', 'not_observed', null],
    ['http_handler', 'not_reached', 'not_observed', null],
    ['business_service', 'not_reached', 'not_observed', null],
    ['database', 'not_reached', 'not_observed', null],
    ['worker', 'not_applicable', 'not_observed', null],
    ['external_dependency', 'not_reached', 'not_observed', null],
    ['response', 'passed', 'measured', 1],
  ];
  return definitions.map(([id, status, evidence, durationMs]) => ({
    id,
    status,
    evidence,
    durationMs,
  }));
}
