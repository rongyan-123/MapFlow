import { IdentityApiError } from '../identity/identityClient';

export async function submitFeedback(
  content: string,
  csrfToken: string,
): Promise<void> {
  await request('/api/feedback', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ content }),
  });
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'feedback.network_unavailable', '反馈服务暂时无法连接。');
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
    'feedback.request_failed',
    '反馈请求失败，请稍后再试。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
