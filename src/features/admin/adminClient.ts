import { IdentityApiError } from '../identity/identityClient';
import type {
  AdminAccount,
  AdminAuditEvent,
  AdminDashboard,
  AdminInvitation,
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
    !isLoginTrend7d(body.loginTrend7d)
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
): Promise<AdminInvitation[]> {
  void csrfToken;
  const response = await request('/api/admin/invitations', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!isRecord(body) || !isExactArray(body.invitations, isAdminInvitation)) {
    throw invalidResponseError();
  }
  return body.invitations;
}

export async function fetchAdminAuditEvents(
  csrfToken: string,
  filter: AuditFilter,
): Promise<AdminAuditEvent[]> {
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
  if (!isRecord(body) || !isExactArray(body.events, isAdminAuditEvent)) {
    throw invalidResponseError();
  }
  return body.events;
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
    typeof value.totalTokens === 'number'
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
    typeof value.occurredAt === 'string'
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
