import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IdentityApiError,
  claimInvitation,
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
          platformFundedEnabled: true,
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
        platformFundedEnabled: true,
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

  it('parses the admin flag from the current session account', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        account: {
          playerId: 'MF-7K3P-9D2Q-X8CW',
          username: 'adminuser',
          status: 'active',
          isAdmin: true,
        },
        csrfToken: 'csrf-secret',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentSession()).resolves.toMatchObject({
      account: { isAdmin: true },
    });
  });

  it('rejects a session response without the admin flag', async () => {
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

    const error = await fetchCurrentSession().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'identity.invalid_response' });
  });

  it('registers with only the server-approved fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          account: {
            playerId: 'MF-7K3P-9D2Q-X8CW',
            username: 'firstuser',
            status: 'active',
            isAdmin: false,
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
    expect(session.account.isAdmin).toBe(false);
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
          isAdmin: false,
        },
        csrfToken: 'csrf-secret',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loginIdentity({ username: 'firstuser', password: 'safe-password-2026' }),
    ).resolves.toMatchObject({ account: { username: 'firstuser', isAdmin: false } });
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

  it('claims one invitation without a turnstile token when none is configured', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ invitationCode: 'EYOSBF' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(claimInvitation()).resolves.toEqual({
      invitationCode: 'EYOSBF',
    });
    const [path, request] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/invitations/claim');
    expect(JSON.parse(String(request?.body))).toEqual({});
  });

  it('forwards the turnstile token with the claim request', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ invitationCode: 'ITCJNJ' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(claimInvitation('turnstile-widget-token')).resolves.toEqual({
      invitationCode: 'ITCJNJ',
    });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      turnstileToken: 'turnstile-widget-token',
    });
  });

  it('surfaces the server claim rejection envelope and status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'invitation.claim_rate_limited',
            message: '您 24 小时内已领取过邀请码，请使用已领取的邀请码完成注册。',
            traceId: 'trace-claim',
          },
        },
        429,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await claimInvitation('turnstile-widget-token').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'invitation.claim_rate_limited',
      message: '您 24 小时内已领取过邀请码，请使用已领取的邀请码完成注册。',
      traceId: 'trace-claim',
    });
  });

  it('rejects a claim response without the six-letter invitation format', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ invitationCode: 'short' }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await claimInvitation().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'identity.invalid_response' });
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
