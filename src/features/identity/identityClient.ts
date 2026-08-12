import type {
  IdentityCapabilities,
  IdentitySession,
  LoginInput,
  RegistrationInput,
} from './types';

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const;

export class IdentityApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;

  constructor(status: number, code: string, message: string, traceId?: string) {
    super(message);
    this.name = 'IdentityApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

export async function fetchCapabilities(): Promise<IdentityCapabilities> {
  const response = await request('/api/capabilities', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    !isRecord(body.identity) ||
    typeof body.identity.registrationEnabled !== 'boolean' ||
    !isRecord(body.generation) ||
    typeof body.generation.enabled !== 'boolean' ||
    !isExactStringArray(body.generation.models, [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ]) ||
    !isExactStringArray(body.generation.thinkingModes, ['disabled', 'enabled']) ||
    !isExactStringArray(body.generation.reasoningEfforts, ['low', 'high', 'max'])
  ) {
    throw invalidResponseError();
  }
  return {
    identity: { registrationEnabled: body.identity.registrationEnabled },
    generation: {
      enabled: body.generation.enabled,
      models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      thinkingModes: ['disabled', 'enabled'],
      reasoningEfforts: ['low', 'high', 'max'],
    },
  };
}

export async function fetchCurrentSession(): Promise<IdentitySession | null> {
  const response = await request(
    '/api/auth/session',
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
    [401],
  );
  if (response.status === 401) return null;
  return parseSession(await readJson(response));
}

export async function registerIdentity(
  input: RegistrationInput,
): Promise<IdentitySession> {
  const response = await request('/api/auth/register', {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  return parseSession(await readJson(response));
}

export async function loginIdentity(input: LoginInput): Promise<IdentitySession> {
  const response = await request('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  return parseSession(await readJson(response));
}

export async function logoutIdentity(csrfToken: string): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

async function request(
  path: string,
  init: RequestInit,
  acceptedErrorStatuses: readonly number[] = [],
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new IdentityApiError(0, 'network.unavailable', '账号服务暂时无法连接。');
  }
  if (!response.ok && !acceptedErrorStatuses.includes(response.status)) {
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
    // The fallback below deliberately avoids exposing a malformed server body.
  }
  return new IdentityApiError(
    response.status,
    'identity.request_failed',
    response.status === 429 ? '请求过于频繁，请稍后再试。' : '账号请求失败，请稍后再试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function parseSession(body: unknown): IdentitySession {
  if (
    !isRecord(body) ||
    !isRecord(body.account) ||
    typeof body.account.playerId !== 'string' ||
    typeof body.account.username !== 'string' ||
    body.account.status !== 'active' ||
    typeof body.csrfToken !== 'string' ||
    body.csrfToken.length === 0
  ) {
    throw invalidResponseError();
  }
  return {
    account: {
      playerId: body.account.playerId,
      username: body.account.username,
      status: 'active',
    },
    csrfToken: body.csrfToken,
  };
}

function invalidResponseError(): IdentityApiError {
  return new IdentityApiError(
    502,
    'identity.invalid_response',
    '账号服务返回了无法识别的结果。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExactStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}
