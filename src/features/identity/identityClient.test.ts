import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IdentityApiError,
  fetchCapabilities,
  fetchCurrentSession,
  loginIdentity,
  logoutIdentity,
  registerIdentity,
} from './identityClient';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('identityClient', () => {
  it('reads the capability contract with same-origin credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        identity: { registrationEnabled: true },
        generation: {
          enabled: true,
          models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
          thinkingModes: ['disabled', 'enabled'],
          reasoningEfforts: ['low', 'high', 'max'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCapabilities()).resolves.toEqual({
      identity: { registrationEnabled: true },
      generation: {
        enabled: true,
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        thinkingModes: ['disabled', 'enabled'],
        reasoningEfforts: ['low', 'high', 'max'],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/capabilities', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  });

  it('treats an unauthorized session lookup as an anonymous visitor', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentSession()).resolves.toBeNull();
  });

  it('registers with only the server-approved fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          account: {
            playerId: 'MF-7K3P-9D2Q-X8CW',
            username: 'firstuser',
            status: 'active',
          },
          csrfToken: 'csrf-secret',
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await registerIdentity({
      username: 'firstuser',
      password: 'safe-password-2026',
      invitationCode: 'QJXKRP',
      email: 'learner@example.com',
    });

    expect(session.account.playerId).toBe('MF-7K3P-9D2Q-X8CW');
    const [path, request] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/auth/register');
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      username: 'firstuser',
      password: 'safe-password-2026',
      invitationCode: 'QJXKRP',
      email: 'learner@example.com',
    });
  });

  it('logs in with username and password through the opaque-cookie session endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        account: {
          playerId: 'MF-7K3P-9D2Q-X8CW',
          username: 'firstuser',
          status: 'active',
        },
        csrfToken: 'csrf-secret',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loginIdentity({ username: 'firstuser', password: 'safe-password-2026' }),
    ).resolves.toMatchObject({ account: { username: 'firstuser' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'firstuser', password: 'safe-password-2026' }),
    });
  });

  it('surfaces the stable safe error envelope and status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'rate_limit.exceeded',
            message: '请求过于频繁，请稍后再试。',
            traceId: 'trace-123',
          },
        },
        429,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await registerIdentity({
      username: 'firstuser',
      password: 'safe-password-2026',
      invitationCode: 'QJXKRP',
      email: 'learner@example.com',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'rate_limit.exceeded',
      message: '请求过于频繁，请稍后再试。',
      traceId: 'trace-123',
    });
  });

  it('requires the in-memory CSRF token when logging out', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await logoutIdentity('csrf-secret');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': 'csrf-secret',
      },
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
