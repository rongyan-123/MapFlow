import type {
  AdminRequestObservation,
  AdminRequestObservationSummary,
  AdminRequestStage,
  AdminRequestStageSummary,
  ObservationEvidence,
  RequestStageId,
  RequestStageStatus,
} from '../domains/admin/types';
const REQUEST_ID='81000000-0000-4000-8000-000000000301';
export function summary(): AdminRequestObservationSummary {
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

export function detail(): AdminRequestObservation {
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
