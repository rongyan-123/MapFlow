import { IdentityApiError } from '../identity/identityClient';

export interface Announcement {
  announcementId: string;
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface AnnouncementsData {
  items: Announcement[];
  unreadIds: string[];
}

export async function getAnnouncements(): Promise<AnnouncementsData> {
  const response = await request('/api/announcements', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!isRecord(body) || !isAnnouncementsArray(body.items) || !isStringArray(body.unreadIds)) {
    throw invalidResponseError();
  }
  return { items: body.items, unreadIds: body.unreadIds };
}

export async function markAnnouncementRead(
  announcementId: string,
  csrfToken: string,
): Promise<void> {
  await request(`/api/announcements/${announcementId}/read`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

function isAnnouncementsArray(value: unknown): value is Announcement[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.announcementId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.content === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.isRead === 'boolean',
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'announcements.network_unavailable', '公告服务暂时无法连接。');
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
    // 兜底刻意不暴露格式错误的服务端响应体。
  }
  return new IdentityApiError(
    response.status,
    'announcements.request_failed',
    '公告请求失败，请稍后再试。',
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
  return new IdentityApiError(502, 'announcements.invalid_response', '公告服务返回了无法识别的结果。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
