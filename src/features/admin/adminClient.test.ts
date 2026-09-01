import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityApiError } from '../identity/identityClient';
import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  fetchAdminAccounts,
  fetchAdminAuditEvents,
  fetchAdminAuditEventsPage,
  fetchAdminDashboard,
  fetchAdminFeedback,
  fetchAdminInvitations,
  fetchAdminRequestObservation,
  fetchAdminRequestObservations,
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
            creditBalance: 0,
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
            creditBalance: 0,
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
        creditBalance: 0,
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
        creditBalance: 0,
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

  it('reads request observation summaries and sends snake_case filters', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            requestId: '81000000-0000-4000-8000-000000000301',
            startedAt: '2026-08-31T11:59:59Z',
            completedAt: '2026-08-31T12:00:00Z',
            durationMs: 18,
            method: 'POST',
            route: '/api/invitations/claim',
            routeFamily: 'invitation',
            httpStatus: 429,
            requestBytes: 128,
            responseBytes: 256,
            outcome: 'rejected',
            summary: '邀请码领取频率守卫拒绝了请求',
            terminalStage: 'security_guard',
            errorCode: 'invitation.claim_rate_limited',
            effectiveClientIp: '198.51.100.23',
            accountId: null,
            username: null,
            correlationId: null,
            actorKind: 'unassociated',
            lifecycleSchemaVersion: 2,
            lifecycleDataStatus: 'current',
            stages: validRequestStages(),
          },
        ],
        total: 1,
        delivery: {
          persistedSinceStart: 120,
          queueDroppedSinceStart: 2,
          writeFailedSinceStart: 1,
          queued: 3,
          capacity: 256,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchAdminRequestObservations('csrf-secret', {
      outcome: 'rejected',
      routeFamily: 'invitation',
      terminalStage: 'security_guard',
      errorCode: 'invitation.claim_rate_limited',
      limit: 50,
      offset: 0,
    });

    expect(page.total).toBe(1);
    expect(page.delivery).toEqual({
      persistedSinceStart: 120,
      queueDroppedSinceStart: 2,
      writeFailedSinceStart: 1,
      queued: 3,
      capacity: 256,
    });
    expect(page.items[0]).toMatchObject({
      requestId: '81000000-0000-4000-8000-000000000301',
      outcome: 'rejected',
      terminalStage: 'security_guard',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/request-observations?outcome=rejected&route_family=invitation&terminal_stage=security_guard&error_code=invitation.claim_rate_limited&limit=50&offset=0',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('reads a complete request lifecycle with friendly and technical details', async () => {
    const stages = validRequestStages();
    stages[3] = {
      ...stages[3],
      id: 'security_guard',
      title: '通用安全守卫',
      status: 'rejected',
      evidence: 'measured',
      explanation: '有效客户端 IP 在 24 小时内已经领取过邀请码。',
      startedOffsetMs: 4,
      durationMs: 3,
      technical: {
        errorCode: 'invitation.claim_rate_limited',
        httpStatus: 429,
      },
      technicalTruncated: true,
      operations: [
        {
          code: 'invitation.claim.ip_guard',
          status: 'rejected',
          evidence: 'measured',
          startedOffsetMs: 4,
          durationMs: 1,
          explanation: '命中 24 小时 IP 领取限制。',
        },
      ],
      operationsTruncated: false,
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(requestObservationDetailBody(stages)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const detail = await fetchAdminRequestObservation(
      'csrf-secret',
      '81000000-0000-4000-8000-000000000301',
    );

    expect(detail.stages[3].explanation).toContain('24 小时');
    expect(detail.stages[3].technical).toEqual({
      errorCode: 'invitation.claim_rate_limited',
      httpStatus: 429,
    });
    expect(detail.stages[3].startedOffsetMs).toBe(4);
    expect(detail.stages[3].technicalTruncated).toBe(true);
    expect(detail.stages[3].operations[0]).toMatchObject({
      code: 'invitation.claim.ip_guard',
      status: 'rejected',
      durationMs: 1,
    });
    expect(detail.lifecycleSchemaVersion).toBe(2);
    expect(detail.redactionSchemaVersion).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/request-observations/81000000-0000-4000-8000-000000000301',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('rejects request observation details that omit redaction metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: '81000000-0000-4000-8000-000000000301',
        startedAt: '2026-08-31T11:59:59Z',
        completedAt: '2026-08-31T12:00:00Z',
        durationMs: 18,
        method: 'POST',
        route: '/api/invitations/claim',
        routeFamily: 'invitation',
        httpStatus: 429,
        requestBytes: 128,
        responseBytes: 256,
        outcome: 'rejected',
        summary: '邀请码领取频率守卫拒绝了请求',
        terminalStage: 'security_guard',
        errorCode: 'invitation.claim_rate_limited',
        effectiveClientIp: '198.51.100.23',
        peerIp: '172.30.0.3',
        accountId: null,
        username: null,
        correlationId: null,
        lifecycleSchemaVersion: 2,
        redactionSchemaVersion: 1,
        stages: [
          {
            id: 'security_guard',
            title: '通用安全守卫',
            location: 'mapflow-app',
            status: 'rejected',
            evidence: 'measured',
            explanation: '请求被拒绝。',
            startedOffsetMs: 4,
            durationMs: 3,
            technical: {},
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminRequestObservation(
      'csrf-secret',
      '81000000-0000-4000-8000-000000000301',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('rejects a lifecycle that omits any fixed architecture stage', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(requestObservationDetailBody(validRequestStages().slice(0, -1))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminRequestObservation(
      'csrf-secret',
      '81000000-0000-4000-8000-000000000301',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('rejects an operation with impossible evidence', async () => {
    const stages = validRequestStages();
    stages[3] = {
      ...stages[3],
      status: 'passed',
      evidence: 'measured',
      operations: [
        {
          code: 'security.guard',
          status: 'passed',
          evidence: 'not_observed',
          startedOffsetMs: 1,
          durationMs: 1,
          explanation: '不应通过校验。',
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(requestObservationDetailBody(stages)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminRequestObservation(
      'csrf-secret',
      '81000000-0000-4000-8000-000000000301',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
  });

  it('rejects inferred evidence that would otherwise be painted as a green pass', async () => {
    const stages = validRequestStages();
    stages[0] = { ...stages[0], status: 'passed', evidence: 'inferred' };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(requestObservationDetailBody(stages)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchAdminRequestObservation(
      'csrf-secret',
      '81000000-0000-4000-8000-000000000301',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(error).toMatchObject({ status: 502, code: 'admin.invalid_response' });
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

  it('lists admin feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              feedbackId: 'fb-1',
              username: 'user1',
              content: '希望支持暗色主题',
              createdAt: '2026-08-19T00:00:00Z',
            },
          ],
          total: 1,
        }),
      ),
    );

    const page = await fetchAdminFeedback('csrf-admin', 50, 0);
    expect(page.total).toBe(1);
    expect(page.items[0].content).toBe('希望支持暗色主题');
  });

  it('creates and deletes announcements', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ announcementId: 'ann-1' })),
    );
    await expect(
      createAdminAnnouncement('标题', '内容', 'csrf-1'),
    ).resolves.toBe('ann-1');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(
      deleteAdminAnnouncement('ann-1', 'csrf-2'),
    ).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(path).toBe('/api/admin/announcements/ann-1');
    expect(init.method).toBe('DELETE');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestObservationDetailBody(stages: unknown[]) {
  return {
    requestId: '81000000-0000-4000-8000-000000000301',
    startedAt: '2026-08-31T11:59:59Z',
    completedAt: '2026-08-31T12:00:00Z',
    durationMs: 18,
    method: 'POST',
    route: '/api/invitations/claim',
    routeFamily: 'invitation',
    httpStatus: 429,
    requestBytes: 128,
    responseBytes: 256,
    outcome: 'rejected',
    summary: '邀请码领取频率守卫拒绝了请求',
    terminalStage: 'security_guard',
    errorCode: 'invitation.claim_rate_limited',
    effectiveClientIp: '198.51.100.23',
    peerIp: '172.30.0.3',
    accountId: null,
    username: null,
    correlationId: null,
    actorKind: 'unassociated',
    lifecycleSchemaVersion: 2,
    lifecycleDataStatus: 'current',
    redactionSchemaVersion: 1,
    stages,
  };
}

function validRequestStages(): Record<string, unknown>[] {
  return [
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
  ].map((id) => ({
    id,
    title: id,
    location: 'mapflow-app',
    status: 'not_reached',
    evidence: 'not_observed',
    explanation: '本次请求没有到达此阶段。',
    startedOffsetMs: null,
    durationMs: null,
    technical: {},
    technicalTruncated: false,
    operations: [],
    operationsTruncated: false,
  }));
}
