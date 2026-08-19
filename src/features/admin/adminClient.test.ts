import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityApiError } from '../identity/identityClient';
import {
  fetchAdminAccounts,
  fetchAdminAuditEvents,
  fetchAdminAuditEventsPage,
  fetchAdminDashboard,
  fetchAdminInvitations,
  revokeAdminInvitation,
  suspendAdminAccount,
} from './adminClient';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adminClient', () => {
  it('reads the dashboard aggregates with same-origin credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        registeredAccounts: 12,
        availableInvites: 3,
        redeemedInvites: 9,
        revokedInvites: 1,
        activeSessions: 7,
        platformConsumedUsages: 42,
        platformConsumedTokens: 123456,
        loginTrend7d: [
          { date: '2026-08-13', activeAccounts: 2 },
          { date: '2026-08-14', activeAccounts: 5 },
        ],
        currentOnline: 3,
        consecutive3dLogins: 1,
        totalActiveMinutes: 120,
        avgActiveMinutes: 40,
        dailyConsumed7d: [{ date: '2026-08-13', consumed: 2 }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminDashboard('csrf-secret')).resolves.toEqual({
      registeredAccounts: 12,
      availableInvites: 3,
      redeemedInvites: 9,
      revokedInvites: 1,
      activeSessions: 7,
      platformConsumedUsages: 42,
      platformConsumedTokens: 123456,
      loginTrend7d: [
        { date: '2026-08-13', activeAccounts: 2 },
        { date: '2026-08-14', activeAccounts: 5 },
      ],
      currentOnline: 3,
      consecutive3dLogins: 1,
      totalActiveMinutes: 120,
      avgActiveMinutes: 40,
      dailyConsumed7d: [{ date: '2026-08-13', consumed: 2 }],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/dashboard', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  });

  it('rejects a dashboard response that misses an aggregate', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ registeredAccounts: 12 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminDashboard('csrf-secret').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('unwraps the accounts list from the envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        accounts: [
          {
            accountId: '6f6f0d0a-5f4e-4a0e-9d0f-0e6d8f6b7c1a',
            username: 'firstuser',
            status: 'active',
            registeredAt: '2026-08-01T08:00:00Z',
            lastSeenAt: '2026-08-19T08:00:00Z',
            byokSessions: 2,
            platformSessions: 5,
            totalTokens: 9000,
            platformConsumedUsages: 4,
            activeMinutes: 150,
          },
          {
            accountId: '7a1b2c3d-4e5f-4a0e-9d0f-0e6d8f6b7c2b',
            username: 'seconduser',
            status: 'suspended',
            registeredAt: '2026-08-02T08:00:00Z',
            lastSeenAt: null,
            byokSessions: 0,
            platformSessions: 0,
            totalTokens: 0,
            platformConsumedUsages: 0,
            activeMinutes: 0,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminAccounts('csrf-secret')).resolves.toEqual([
      {
        accountId: '6f6f0d0a-5f4e-4a0e-9d0f-0e6d8f6b7c1a',
        username: 'firstuser',
        status: 'active',
        registeredAt: '2026-08-01T08:00:00Z',
        lastSeenAt: '2026-08-19T08:00:00Z',
        byokSessions: 2,
        platformSessions: 5,
        totalTokens: 9000,
        platformConsumedUsages: 4,
        activeMinutes: 150,
      },
      {
        accountId: '7a1b2c3d-4e5f-4a0e-9d0f-0e6d8f6b7c2b',
        username: 'seconduser',
        status: 'suspended',
        registeredAt: '2026-08-02T08:00:00Z',
        lastSeenAt: null,
        byokSessions: 0,
        platformSessions: 0,
        totalTokens: 0,
        platformConsumedUsages: 0,
        activeMinutes: 0,
      },
    ]);
  });

  it('rejects an accounts response whose envelope is not a list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ accounts: 'nope' }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminAccounts('csrf-secret').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('unwraps the invitation summary and items without ever reading a code field', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        summary: { available: 38, redeemed: 17, revoked: 0 },
        items: [
          {
            inviteId: '9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c',
            status: 'available',
            createdAt: '2026-08-01T08:00:00Z',
            claimedIp: null,
            claimedAt: null,
            redeemedBy: null,
            redeemedAt: null,
          },
          {
            inviteId: '8b2c3d4e-5f6a-4b0e-9d0f-0e6d8f6b7c4d',
            status: 'redeemed',
            createdAt: '2026-08-02T08:00:00Z',
            claimedIp: '192.0.2.10',
            claimedAt: '2026-08-02T09:00:00Z',
            redeemedBy: 'firstuser',
            redeemedAt: '2026-08-02T09:05:00Z',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAdminInvitations('csrf-secret')).resolves.toEqual({
      summary: { available: 38, redeemed: 17, revoked: 0 },
      items: [
        {
          inviteId: '9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c',
          status: 'available',
          createdAt: '2026-08-01T08:00:00Z',
          claimedIp: null,
          claimedAt: null,
          redeemedBy: null,
          redeemedAt: null,
        },
        {
          inviteId: '8b2c3d4e-5f6a-4b0e-9d0f-0e6d8f6b7c4d',
          status: 'redeemed',
          createdAt: '2026-08-02T08:00:00Z',
          claimedIp: '192.0.2.10',
          claimedAt: '2026-08-02T09:00:00Z',
          redeemedBy: 'firstuser',
          redeemedAt: '2026-08-02T09:05:00Z',
        },
      ],
    });
  });

  it('rejects an invitations response that misses the summary envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            inviteId: '9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c',
            status: 'available',
            createdAt: '2026-08-01T08:00:00Z',
            claimedIp: null,
            claimedAt: null,
            redeemedBy: null,
            redeemedAt: null,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminInvitations('csrf-secret').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('unwraps audit events and forwards the filter as snake_case query parameters', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [
          {
            eventId: '5d4e5f6a-7b8c-4d0e-9d0f-0e6d8f6b7c5e',
            eventType: 'login',
            outcome: 'success',
            playerId: 'MF-7K3P-9D2Q-X8CW',
            occurredAt: '2026-08-18T10:00:00Z',
            details: { client_ip: '203.0.113.9' },
          },
          {
            eventId: '4c3d4e5f-6a7b-4c0e-9d0f-0e6d8f6b7c6f',
            eventType: 'register',
            outcome: 'rejected',
            playerId: null,
            occurredAt: '2026-08-18T11:00:00Z',
            details: {},
          },
        ],
        total: 27,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchAdminAuditEvents('csrf-secret', {
        eventType: 'login',
        from: '2026-08-01T00:00:00Z',
        to: '2026-08-19T00:00:00Z',
        limit: 50,
        offset: 10,
      }),
    ).resolves.toEqual([
      {
        eventId: '5d4e5f6a-7b8c-4d0e-9d0f-0e6d8f6b7c5e',
        eventType: 'login',
        outcome: 'success',
        playerId: 'MF-7K3P-9D2Q-X8CW',
        occurredAt: '2026-08-18T10:00:00Z',
        details: { client_ip: '203.0.113.9' },
      },
      {
        eventId: '4c3d4e5f-6a7b-4c0e-9d0f-0e6d8f6b7c6f',
        eventType: 'register',
        outcome: 'rejected',
        playerId: null,
        occurredAt: '2026-08-18T11:00:00Z',
        details: {},
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/audit-events?event_type=login&from=2026-08-01T00%3A00%3A00Z&to=2026-08-19T00%3A00%3A00Z&limit=50&offset=10',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('exposes the audit total through the page-shaped fetch', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [
          {
            eventId: '5d4e5f6a-7b8c-4d0e-9d0f-0e6d8f6b7c5e',
            eventType: 'login',
            outcome: 'success',
            playerId: 'MF-7K3P-9D2Q-X8CW',
            occurredAt: '2026-08-18T10:00:00Z',
            details: { client_ip: '203.0.113.9' },
          },
        ],
        total: 27,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchAdminAuditEventsPage('csrf-secret', { limit: 1 }),
    ).resolves.toEqual({
      events: [
        {
          eventId: '5d4e5f6a-7b8c-4d0e-9d0f-0e6d8f6b7c5e',
          eventType: 'login',
          outcome: 'success',
          playerId: 'MF-7K3P-9D2Q-X8CW',
          occurredAt: '2026-08-18T10:00:00Z',
          details: { client_ip: '203.0.113.9' },
        },
      ],
      total: 27,
    });
  });

  it('omits absent audit filter fields from the query string', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchAdminAuditEvents('csrf-secret', { eventType: 'register' }),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/audit-events?event_type=register',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('suspends an account with the CSRF header and treats 204 as success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      suspendAdminAccount('6f6f0d0a-5f4e-4a0e-9d0f-0e6d8f6b7c1a', 'csrf-secret'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/accounts/6f6f0d0a-5f4e-4a0e-9d0f-0e6d8f6b7c1a/suspend',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': 'csrf-secret',
        },
      },
    );
  });

  it('revokes an invitation with the CSRF header and treats 204 as success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      revokeAdminInvitation('9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c', 'csrf-secret'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/invitations/9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c/revoke',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': 'csrf-secret',
        },
      },
    );
  });

  it('surfaces the already-redeemed rejection envelope when revoking fails with 409', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'admin.invitation_already_redeemed',
            message: '该邀请码已被使用，无法撤销。',
            traceId: 'trace-revoke',
          },
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await revokeAdminInvitation(
      '9c1a2b3c-4d5e-4f0e-8d0f-0e6d8f6b7c3c',
      'csrf-secret',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'admin.invitation_already_redeemed',
      message: '该邀请码已被使用，无法撤销。',
      traceId: 'trace-revoke',
    });
  });

  it('rejects an audit events response with a malformed entry', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        events: [{ eventId: 'x', eventType: 'login' }],
        total: 1,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminAuditEvents('csrf-secret', {}).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('rejects an audit events response that misses the total', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminAuditEventsPage('csrf-secret', {}).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
