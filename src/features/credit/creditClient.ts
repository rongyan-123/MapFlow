import { IdentityApiError } from '../identity/identityClient';

export interface CreditSummary {
  balance: number;
  signedInToday: boolean;
  freeRemaining: number;
  pricePerTree: number;
}

export interface CreditSigninResult {
  balance: number;
  awarded: number;
}

export function formatCreditAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return value.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '');
}

export async function readCreditSummary(): Promise<CreditSummary> {
  const response = await request('/api/credit/me', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    typeof body.balance !== 'number' ||
    typeof body.signedInToday !== 'boolean' ||
    typeof body.freeRemaining !== 'number' ||
    typeof body.pricePerTree !== 'number'
  ) {
    throw invalidResponseError();
  }
  return {
    balance: body.balance,
    signedInToday: body.signedInToday,
    freeRemaining: body.freeRemaining,
    pricePerTree: body.pricePerTree,
  };
}

export async function signInForCredit(csrfToken: string): Promise<CreditSigninResult> {
  const response = await request('/api/credit/signin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
  const body = await readJson(response);
  if (!isRecord(body) || typeof body.balance !== 'number' || typeof body.awarded !== 'number') {
    throw invalidResponseError();
  }
  return { balance: body.balance, awarded: body.awarded };
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'credit.network_unavailable', '积分服务暂时无法连接。');
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
    'credit.request_failed',
    response.status === 409 ? '今天已经签到过了，明天再来吧。' : '积分请求失败，请稍后再试。',
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
  return new IdentityApiError(502, 'credit.invalid_response', '积分服务返回了无法识别的结果。');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
