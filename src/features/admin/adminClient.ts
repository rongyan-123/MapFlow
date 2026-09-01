import { IdentityApiError } from '../identity/identityClient';
import type {
  AdminAccount,
  AdminAnnouncement,
  AdminAuditEvent,
  AdminAuditEventsPage,
  AdminDashboard,
  AdminFeedback,
  AdminFeedbackPage,
  AdminInvitation,
  AdminInvitationSummary,
  AdminInvitationsResponse,
  AdminRequestObservation,
  AdminRequestObservationsPage,
  AdminRequestStageSummary,
  AdminRequestStageOperation,
  AuditFilter,
  RequestObservationFilter,
} from './types';

export async function fetchAdminDashboard(
  csrfToken: string,
): Promise<AdminDashboard> {
  // GET 只走会话 Cookie 校验；保留 csrfToken 参数与其余接口统一，便于调用方同源传参。
  void csrfToken;
  const response = await request('/api/admin/dashboard', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    typeof body.registeredAccounts !== 'number' ||
    typeof body.availableInvites !== 'number' ||
    typeof body.redeemedInvites !== 'number' ||
    typeof body.revokedInvites !== 'number' ||
    typeof body.activeSessions !== 'number' ||
    typeof body.platformConsumedUsages !== 'number' ||
    typeof body.platformConsumedTokens !== 'number' ||
    !isLoginTrend7d(body.loginTrend7d) ||
    typeof body.currentOnline !== 'number' ||
    typeof body.consecutive3dLogins !== 'number' ||
    typeof body.totalActiveMinutes !== 'number' ||
    typeof body.avgActiveMinutes !== 'number' ||
    !isDailyConsumed7d(body.dailyConsumed7d)
  ) {
    throw invalidResponseError();
  }
  return {
    registeredAccounts: body.registeredAccounts,
    availableInvites: body.availableInvites,
    redeemedInvites: body.redeemedInvites,
    revokedInvites: body.revokedInvites,
    activeSessions: body.activeSessions,
    platformConsumedUsages: body.platformConsumedUsages,
    platformConsumedTokens: body.platformConsumedTokens,
    loginTrend7d: body.loginTrend7d,
    currentOnline: body.currentOnline,
    consecutive3dLogins: body.consecutive3dLogins,
    totalActiveMinutes: body.totalActiveMinutes,
    avgActiveMinutes: body.avgActiveMinutes,
    dailyConsumed7d: body.dailyConsumed7d,
  };
}

export async function fetchAdminAccounts(
  csrfToken: string,
): Promise<AdminAccount[]> {
  void csrfToken;
  const response = await request('/api/admin/accounts', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!isRecord(body) || !isExactArray(body.accounts, isAdminAccount)) {
    throw invalidResponseError();
  }
  return body.accounts;
}

export async function fetchAdminInvitations(
  csrfToken: string,
): Promise<AdminInvitationsResponse> {
  void csrfToken;
  const response = await request('/api/admin/invitations', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isAdminInvitationSummary(body.summary) ||
    !isExactArray(body.items, isAdminInvitation)
  ) {
    throw invalidResponseError();
  }
  return {
    summary: {
      available: body.summary.available,
      redeemed: body.summary.redeemed,
      revoked: body.summary.revoked,
    },
    items: body.items,
  };
}

/** brief 签名不变：仅返回事件列表。需要 total 的调用方用 fetchAdminAuditEventsPage。 */
export async function fetchAdminAuditEvents(
  csrfToken: string,
  filter: AuditFilter,
): Promise<AdminAuditEvent[]> {
  return (await fetchAdminAuditEventsPage(csrfToken, filter)).events;
}

/** 返回 `{ events, total }`，供需要全量总数（分页）的 UI 使用。 */
export async function fetchAdminAuditEventsPage(
  csrfToken: string,
  filter: AuditFilter,
): Promise<AdminAuditEventsPage> {
  void csrfToken;
  const query = new URLSearchParams();
  // 后端拒绝未知查询参数，且字段名为 snake_case（event_type）。
  if (filter.eventType !== undefined) query.set('event_type', filter.eventType);
  if (filter.from !== undefined) query.set('from', filter.from);
  if (filter.to !== undefined) query.set('to', filter.to);
  if (filter.limit !== undefined) query.set('limit', String(filter.limit));
  if (filter.offset !== undefined) query.set('offset', String(filter.offset));
  const queryString = query.toString();
  const path = queryString
    ? `/api/admin/audit-events?${queryString}`
    : '/api/admin/audit-events';
  const response = await request(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(body.events, isAdminAuditEvent) ||
    typeof body.total !== 'number'
  ) {
    throw invalidResponseError();
  }
  return { events: body.events, total: body.total };
}

export async function fetchAdminRequestObservations(
  csrfToken: string,
  filter: RequestObservationFilter,
): Promise<AdminRequestObservationsPage> {
  void csrfToken;
  const query = new URLSearchParams();
  if (filter.outcome !== undefined) query.set('outcome', filter.outcome);
  if (filter.routeFamily !== undefined) query.set('route_family', filter.routeFamily);
  if (filter.terminalStage !== undefined) query.set('terminal_stage', filter.terminalStage);
  if (filter.errorCode !== undefined) query.set('error_code', filter.errorCode);
  if (filter.httpStatus !== undefined) query.set('http_status', String(filter.httpStatus));
  if (filter.requestId !== undefined) query.set('request_id', filter.requestId);
  if (filter.accountId !== undefined) query.set('account_id', filter.accountId);
  if (filter.effectiveClientIp !== undefined) {
    query.set('effective_client_ip', filter.effectiveClientIp);
  }
  if (filter.from !== undefined) query.set('from', filter.from);
  if (filter.to !== undefined) query.set('to', filter.to);
  if (filter.limit !== undefined) query.set('limit', String(filter.limit));
  if (filter.offset !== undefined) query.set('offset', String(filter.offset));
  const queryString = query.toString();
  const response = await request(
    queryString
      ? `/api/admin/request-observations?${queryString}`
      : '/api/admin/request-observations',
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(body.items, isAdminRequestObservationSummary) ||
    typeof body.total !== 'number' ||
    !isRequestObservationDeliveryStatusOrNull(body.delivery)
  ) {
    throw invalidResponseError();
  }
  return { items: body.items, total: body.total, delivery: body.delivery };
}

export async function fetchAdminRequestObservation(
  csrfToken: string,
  requestId: string,
): Promise<AdminRequestObservation> {
  void csrfToken;
  const response = await request(
    `/api/admin/request-observations/${encodeURIComponent(requestId)}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const body = await readJson(response);
  if (!isAdminRequestObservation(body)) throw invalidResponseError();
  return body;
}

export async function suspendAdminAccount(
  accountId: string,
  csrfToken: string,
): Promise<void> {
  await request(`/api/admin/accounts/${accountId}/suspend`, mutationInit(csrfToken));
}

export async function revokeAdminInvitation(
  inviteId: string,
  csrfToken: string,
): Promise<void> {
  await request(
    `/api/admin/invitations/${inviteId}/revoke`,
    mutationInit(csrfToken),
  );
}

export async function fetchAdminFeedback(
  csrfToken: string,
  limit: number,
  offset: number,
): Promise<AdminFeedbackPage> {
  void csrfToken;
  const response = await request(
    `/api/admin/feedback?limit=${limit}&offset=${offset}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(
      body.items,
      (item): item is AdminFeedback =>
        isRecord(item) &&
        typeof item.feedbackId === 'string' &&
        typeof item.username === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string',
    ) ||
    typeof body.total !== 'number'
  ) {
    throw invalidResponseError();
  }
  return { items: body.items, total: body.total };
}

export async function fetchAdminAnnouncements(
  csrfToken: string,
): Promise<AdminAnnouncement[]> {
  void csrfToken;
  const response = await request('/api/admin/announcements', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isExactArray(
      body.items,
      (item): item is AdminAnnouncement =>
        isRecord(item) &&
        typeof item.announcementId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.readCount === 'number',
    )
  ) {
    throw invalidResponseError();
  }
  return body.items;
}

export async function createAdminAnnouncement(
  title: string,
  content: string,
  csrfToken: string,
): Promise<string> {
  const response = await request('/api/admin/announcements', {
    ...mutationInit(csrfToken),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ title, content }),
  });
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.announcementId !== 'string') {
    throw invalidResponseError();
  }
  return body.announcementId;
}

export async function deleteAdminAnnouncement(
  announcementId: string,
  csrfToken: string,
): Promise<void> {
  await request(`/api/admin/announcements/${announcementId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

function mutationInit(csrfToken: string): RequestInit {
  return {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  };
}

function isLoginTrend7d(
  value: unknown,
): value is { date: string; activeAccounts: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.date === 'string' &&
        typeof item.activeAccounts === 'number',
    )
  );
}

function isDailyConsumed7d(
  value: unknown,
): value is { date: string; consumed: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.date === 'string' &&
        typeof item.consumed === 'number',
    )
  );
}

function isAdminAccount(value: unknown): value is AdminAccount {
  return (
    isRecord(value) &&
    typeof value.accountId === 'string' &&
    typeof value.username === 'string' &&
    typeof value.status === 'string' &&
    typeof value.registeredAt === 'string' &&
    isStringOrNull(value.lastSeenAt) &&
    typeof value.byokSessions === 'number' &&
    typeof value.platformSessions === 'number' &&
    typeof value.totalTokens === 'number' &&
    typeof value.platformConsumedUsages === 'number' &&
    typeof value.activeMinutes === 'number' &&
    typeof value.creditBalance === 'number'
  );
}

function isAdminInvitationSummary(
  value: unknown,
): value is AdminInvitationSummary {
  return (
    isRecord(value) &&
    typeof value.available === 'number' &&
    typeof value.redeemed === 'number' &&
    typeof value.revoked === 'number'
  );
}

function isAdminInvitation(value: unknown): value is AdminInvitation {
  return (
    isRecord(value) &&
    typeof value.inviteId === 'string' &&
    typeof value.status === 'string' &&
    typeof value.createdAt === 'string' &&
    isStringOrNull(value.claimedIp) &&
    isStringOrNull(value.claimedAt) &&
    isStringOrNull(value.redeemedBy) &&
    isStringOrNull(value.redeemedAt)
  );
}

function isAdminAuditEvent(value: unknown): value is AdminAuditEvent {
  return (
    isRecord(value) &&
    typeof value.eventId === 'string' &&
    typeof value.eventType === 'string' &&
    typeof value.outcome === 'string' &&
    isStringOrNull(value.playerId) &&
    typeof value.occurredAt === 'string' &&
    isRecord(value.details)
  );
}

const REQUEST_OUTCOMES = new Set([
  'succeeded',
  'rejected',
  'failed',
  'async_pending',
]);
const REQUEST_STAGE_ORDER = [
  'client',
  'edge_proxy',
  'router',
  'security_guard',
  'identity',
  'http_handler',
  'business_service',
  'database',
  'worker',
  'external_dependency',
  'response',
] as const;
const REQUEST_STAGE_IDS: ReadonlySet<string> = new Set(REQUEST_STAGE_ORDER);
const REQUEST_STAGE_STATUSES = new Set([
  'passed',
  'rejected',
  'failed',
  'pending',
  'not_reached',
  'not_applicable',
  'unobserved',
]);
const REQUEST_STAGE_OPERATION_STATUSES = new Set([
  'passed',
  'rejected',
  'failed',
  'pending',
]);
const REQUEST_ACTOR_KINDS = new Set([
  'authenticated',
  'visitor',
  'identity_rejected',
  'unassociated',
]);
const REQUEST_LIFECYCLE_DATA_STATUSES = new Set([
  'current',
  'legacy_degraded',
  'corrupt',
]);
const OBSERVATION_EVIDENCE = new Set([
  'measured',
  'confirmed_header',
  'inferred',
  'not_observed',
]);

function isAdminRequestObservationSummary(
  value: unknown,
): value is Record<string, unknown> & AdminRequestObservationsPage['items'][number] {
  return (
    isRecord(value) &&
    typeof value.requestId === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.completedAt === 'string' &&
    typeof value.durationMs === 'number' &&
    typeof value.method === 'string' &&
    typeof value.route === 'string' &&
    typeof value.routeFamily === 'string' &&
    typeof value.httpStatus === 'number' &&
    isNumberOrNull(value.requestBytes) &&
    isNumberOrNull(value.responseBytes) &&
    typeof value.outcome === 'string' &&
    REQUEST_OUTCOMES.has(value.outcome) &&
    typeof value.summary === 'string' &&
    (value.terminalStage === null ||
      (typeof value.terminalStage === 'string' &&
        REQUEST_STAGE_IDS.has(value.terminalStage))) &&
    isStringOrNull(value.errorCode) &&
    isStringOrNull(value.effectiveClientIp) &&
    isStringOrNull(value.accountId) &&
    isStringOrNull(value.username) &&
    isStringOrNull(value.correlationId) &&
    typeof value.actorKind === 'string' &&
    REQUEST_ACTOR_KINDS.has(value.actorKind) &&
    isNonNegativeInteger(value.lifecycleSchemaVersion) &&
    typeof value.lifecycleDataStatus === 'string' &&
    REQUEST_LIFECYCLE_DATA_STATUSES.has(value.lifecycleDataStatus) &&
    isExactArray(value.stages, isAdminRequestStageSummary) &&
    value.stages.length === REQUEST_STAGE_ORDER.length &&
    value.stages.every(
      (stage, index) => stage.id === REQUEST_STAGE_ORDER[index],
    )
  );
}

function isAdminRequestObservation(
  value: unknown,
): value is AdminRequestObservation {
  return (
    isAdminRequestObservationSummary(value) &&
    isStringOrNull(value.peerIp) &&
    typeof value.lifecycleSchemaVersion === 'number' &&
    typeof value.redactionSchemaVersion === 'number' &&
    Array.isArray(value.stages) &&
    value.stages.length === REQUEST_STAGE_ORDER.length &&
    value.stages.every(
      (stage, index) =>
        isAdminRequestStage(stage) && stage.id === REQUEST_STAGE_ORDER[index],
    )
  );
}

function isAdminRequestStage(
  stage: unknown,
): stage is AdminRequestObservation['stages'][number] {
  if (
    !isRecord(stage) ||
    typeof stage.id !== 'string' ||
    !REQUEST_STAGE_IDS.has(stage.id) ||
    typeof stage.title !== 'string' ||
    typeof stage.location !== 'string' ||
    typeof stage.status !== 'string' ||
    !REQUEST_STAGE_STATUSES.has(stage.status) ||
    typeof stage.evidence !== 'string' ||
    !OBSERVATION_EVIDENCE.has(stage.evidence) ||
    typeof stage.explanation !== 'string' ||
    !isNumberOrNull(stage.startedOffsetMs) ||
    !(typeof stage.durationMs === 'number' || stage.durationMs === null) ||
    !isRecord(stage.technical) ||
    typeof stage.technicalTruncated !== 'boolean' ||
    !isExactArray(stage.operations, isAdminRequestStageOperation) ||
    typeof stage.operationsTruncated !== 'boolean'
  ) {
    return false;
  }
  return isTruthfulStageEvidence(stage.status, stage.evidence);
}

function isAdminRequestStageSummary(
  value: unknown,
): value is AdminRequestStageSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !REQUEST_STAGE_IDS.has(value.id) ||
    typeof value.status !== 'string' ||
    !REQUEST_STAGE_STATUSES.has(value.status) ||
    typeof value.evidence !== 'string' ||
    !OBSERVATION_EVIDENCE.has(value.evidence) ||
    !isNumberOrNull(value.durationMs)
  ) {
    return false;
  }
  return isTruthfulStageEvidence(value.status, value.evidence);
}

function isTruthfulStageEvidence(status: string, evidence: string): boolean {
  if (status === 'passed' || status === 'pending') {
    return evidence === 'measured' || evidence === 'confirmed_header';
  }
  if (
    status === 'not_reached' ||
    status === 'not_applicable' ||
    status === 'unobserved'
  ) {
    return evidence === 'not_observed';
  }
  return evidence !== 'not_observed';
}

function isAdminRequestStageOperation(
  value: unknown,
): value is AdminRequestStageOperation {
  if (
    !isRecord(value) ||
    typeof value.code !== 'string' ||
    value.code.length === 0 ||
    typeof value.status !== 'string' ||
    !REQUEST_STAGE_OPERATION_STATUSES.has(value.status) ||
    typeof value.evidence !== 'string' ||
    !OBSERVATION_EVIDENCE.has(value.evidence) ||
    !isNonNegativeInteger(value.startedOffsetMs) ||
    !isNonNegativeInteger(value.durationMs) ||
    typeof value.explanation !== 'string'
  ) {
    return false;
  }
  return isTruthfulStageEvidence(value.status, value.evidence);
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === 'number' || value === null;
}

function isRequestObservationDeliveryStatusOrNull(
  value: unknown,
): value is AdminRequestObservationsPage['delivery'] {
  if (value === null) return true;
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.persistedSinceStart) &&
    isNonNegativeInteger(value.queueDroppedSinceStart) &&
    isNonNegativeInteger(value.writeFailedSinceStart) &&
    isNonNegativeInteger(value.queued) &&
    isNonNegativeInteger(value.capacity) &&
    value.queued <= value.capacity
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isExactArray<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'admin.network_unavailable', '管理服务暂时无法连接。');
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return response;
}

async function parseError(response: Response): Promise<IdentityApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new IdentityApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // 下方兜底刻意不暴露格式错误的服务端响应体。
  }
  return new IdentityApiError(
    response.status,
    'admin.request_failed',
    response.status === 429 ? '请求过于频繁，请稍后再试。' : '管理请求失败，请稍后再试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function invalidResponseError(): IdentityApiError {
  return new IdentityApiError(
    502,
    'admin.invalid_response',
    '管理服务返回了无法识别的结果。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
