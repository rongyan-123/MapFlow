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
  AuditFilter,
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

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
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
