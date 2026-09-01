import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TreeGenerationApiError,
  adjustTreeGeneration,
  abandonPlatformTreeGeneration,
  adjustPlatformTreeGeneration,
  clarifyTreeGeneration,
  clarifyPlatformTreeGeneration,
  confirmTreeGeneration,
  confirmPlatformTreeGeneration,
  confirmCreditsTreeGeneration,
  createPlatformTreeGeneration,
  createCreditsTreeGeneration,
  createTreeGeneration,
  readPlatformGenerationEntitlements,
  readGenerationRun,
  readTreeGeneration,
  releaseFailedPlatformTreeGeneration,
  replanTreeGeneration,
  replanPlatformTreeGeneration,
  reviseCreditsTreeGeneration,
} from './treeGenerationClient';
import type { GenerationInput, ModelAccess } from './types';

const fetchMock = vi.fn<typeof fetch>();
const input: GenerationInput = {
  topic: 'Rust',
  role: '后端开发者',
  goalDescription: '交付可靠服务',
  learnerContextSummary: 'TypeScript 基础，每周八小时',
};
const modelAccess: ModelAccess = {
  apiKey: 'CLIENT-SECRET-SENTINEL',
  model: 'deepseek-v4-flash',
  thinking: 'enabled',
  reasoningEffort: 'high',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('treeGenerationClient', () => {
  it('creates with only the fixed form, nested model access, same-origin cookie and CSRF', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(planReadySession()));
    vi.stubGlobal('fetch', fetchMock);

    const session = await createTreeGeneration(input, modelAccess, 'csrf-token');

    expect(session).toMatchObject({
      generationSessionId: '71000000-0000-4000-8000-000000000001',
      input,
      state: 'plan_ready',
      latestPlan: { version: 1, changeKind: 'initial' },
    });
    const [path, request] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/me/tree-generations');
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
      },
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      ...input,
      modelAccess,
    });
    expect(String(request?.body)).not.toContain('baseUrl');
    expect(String(request?.body)).not.toContain('accountId');
  });

  it('uses distinct versioned paths and feedback fields for replan, adjust and clarify', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(planReadySession(2, 'replan')))
      .mockResolvedValueOnce(jsonResponse(planReadySession(3, 'adjust')))
      .mockResolvedValueOnce(jsonResponse(planReadySession(4, 'clarification')));
    vi.stubGlobal('fetch', fetchMock);

    await replanTreeGeneration(
      'session/id',
      1,
      '重新设计整体路线',
      modelAccess,
      'csrf-token',
    );
    await adjustTreeGeneration(
      'session/id',
      2,
      '保留基础阶段',
      modelAccess,
      'csrf-token',
    );
    await clarifyTreeGeneration(
      'session/id',
      3,
      '每周八小时',
      modelAccess,
      'csrf-token',
    );

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/me/tree-generations/session%2Fid/replan',
      '/api/me/tree-generations/session%2Fid/adjust',
      '/api/me/tree-generations/session%2Fid/clarify',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      expectedPlanVersion: 1,
      feedback: '重新设计整体路线',
      modelAccess,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      expectedPlanVersion: 3,
      answer: '每周八小时',
      modelAccess,
    });
  });

  it('confirms only through the explicit endpoint and forwards the idempotency key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(runDocument('queued'), 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      confirmTreeGeneration(
        'session-id',
        4,
        'browser-generated-key-0001',
        modelAccess,
        'csrf-token',
      ),
    ).resolves.toMatchObject({ status: 'queued', progress: 0 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-generations/session-id/confirm',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-token',
          'Idempotency-Key': 'browser-generated-key-0001',
        },
        body: JSON.stringify({ expectedPlanVersion: 4, modelAccess }),
      },
    );
  });

  it('restores needs-input sessions and polls runs without sending model access', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(needsInputSession()))
      .mockResolvedValueOnce(jsonResponse(runDocument('running')));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readTreeGeneration('session/id')).resolves.toMatchObject({
      state: 'needs_input',
      latestPlan: {
        outcome: { outcome: 'needs_input', question: '每周可以投入多少时间？' },
      },
    });
    await expect(readGenerationRun('session/id', 'run/id')).resolves.toMatchObject({
      status: 'running',
      stage: 'bridging',
      progress: 0.5,
    });
    for (const [, request] of fetchMock.mock.calls) {
      expect(request).toEqual({
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      expect(request?.body).toBeUndefined();
    }
  });

  it('rejects malformed response variants and redacts the submitted API key from errors', async () => {
    const malformedPlan = planReadySession();
    malformedPlan.latest_plan.outcome.stages = [];
    fetchMock
      .mockResolvedValueOnce(jsonResponse(malformedPlan))
      .mockResolvedValueOnce(jsonResponse({ ...runDocument('running'), progress: 2 }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'generation.engine_failed',
              message: 'provider echoed CLIENT-SECRET-SENTINEL',
              traceId: 'trace-1',
            },
          },
          502,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTreeGeneration(input, modelAccess, 'csrf-token'),
    ).rejects.toMatchObject({ code: 'generation.invalid_response' });
    await expect(readGenerationRun('session-id', 'run-id')).rejects.toMatchObject({
      code: 'generation.invalid_response',
    });
    const error = await createTreeGeneration(input, modelAccess, 'csrf-token').catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(TreeGenerationApiError);
    expect(String(error)).not.toContain(modelAccess.apiKey);
    expect(error).toMatchObject({
      status: 502,
      code: 'generation.engine_failed',
      traceId: 'trace-1',
    });
  });

  it('never writes API credentials to browser persistence', async () => {
    const localWrite = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockResolvedValueOnce(jsonResponse(planReadySession()));
    vi.stubGlobal('fetch', fetchMock);

    await createTreeGeneration(input, modelAccess, 'csrf-token');

    expect(localWrite).not.toHaveBeenCalled();
    expect(localStorage.getItem(modelAccess.apiKey)).toBeNull();
    expect(sessionStorage.getItem(modelAccess.apiKey)).toBeNull();
  });

  it('creates and revises platform sessions without ever serializing model controls', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(platformPlanningSession(), 202))
      .mockResolvedValueOnce(jsonResponse(platformPlanReadySession(2, 'replan')))
      .mockResolvedValueOnce(jsonResponse(platformPlanReadySession(3, 'adjust')))
      .mockResolvedValueOnce(jsonResponse(platformPlanReadySession(4, 'clarification')))
      .mockResolvedValueOnce(jsonResponse(runDocument('queued'), 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createPlatformTreeGeneration(input, 'csrf-token'),
    ).resolves.toMatchObject({
      fundingMode: 'platform',
      state: 'planning',
      latestPlan: null,
    });
    await replanPlatformTreeGeneration(
      'session/id',
      1,
      '重新设计路线',
      'csrf-token',
    );
    await adjustPlatformTreeGeneration(
      'session/id',
      2,
      '提前部署',
      'csrf-token',
    );
    await clarifyPlatformTreeGeneration(
      'session/id',
      3,
      '每周八小时',
      'csrf-token',
    );
    await confirmPlatformTreeGeneration(
      'session/id',
      4,
      'platform-confirmation-0001',
      'csrf-token',
    );

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      ...input,
      fundingMode: 'platform',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      expectedPlanVersion: 1,
      feedback: '重新设计路线',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({
      expectedPlanVersion: 3,
      answer: '每周八小时',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toEqual({
      expectedPlanVersion: 4,
    });
    for (const [, request] of fetchMock.mock.calls) {
      const serialized = String(request?.body ?? '');
      for (const forbidden of [
        'apiKey',
        'modelAccess',
        'model',
        'thinking',
        'reasoningEffort',
        modelAccess.apiKey,
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it('sends paid-credit model controls and never sends a client price', async () => {
    const selection = {
      model: 'deepseek-v4-pro' as const,
      thinking: 'enabled' as const,
      reasoningEffort: 'max' as const,
      clarificationQuestionLimit: 3 as const,
    };
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...planReadySession(),
          funding_mode: 'credits',
          credit_question_limit: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...planReadySession(2, 'replan'),
          funding_mode: 'credits',
          credit_question_limit: 3,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(runDocument('queued'), 202));
    vi.stubGlobal('fetch', fetchMock);

    await createCreditsTreeGeneration(input, selection, 'csrf-token');
    await reviseCreditsTreeGeneration(
      'session/id',
      'replan',
      { expectedPlanVersion: 1, feedback: '扩大实战部分' },
      'csrf-token',
    );
    await confirmCreditsTreeGeneration(
      'session/id',
      2,
      'credits-confirmation-0001',
      'csrf-token',
    );

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      ...input,
      fundingMode: 'credits',
      creditSelection: selection,
    });
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain('price');
  });

  it('reads strict entitlement summaries and sends explicit empty lifecycle commands', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          totalGranted: 3,
          available: 2,
          reserved: 1,
          consumed: 0,
          activePlatformSessionId: '71000000-0000-4000-8000-000000000001',
          platformModeAvailable: true,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(platformAbandonedSession()))
      .mockResolvedValueOnce(jsonResponse(platformFailedSession()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readPlatformGenerationEntitlements()).resolves.toEqual({
      totalGranted: 3,
      available: 2,
      reserved: 1,
      consumed: 0,
      activePlatformSessionId: '71000000-0000-4000-8000-000000000001',
      platformModeAvailable: true,
    });
    await expect(
      abandonPlatformTreeGeneration('session/id', 'csrf-token'),
    ).resolves.toMatchObject({ state: 'abandoned' });
    await expect(
      releaseFailedPlatformTreeGeneration('session/id', 'csrf-token'),
    ).resolves.toMatchObject({ state: 'failed' });

    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/me/platform-generation-entitlements',
      { credentials: 'same-origin', headers: { Accept: 'application/json' } },
    ]);
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect(call[0]).toMatch(/session%2Fid\/(abandon|release-failed)$/);
      expect(JSON.parse(String(call[1]?.body))).toEqual({});
    }
  });

  it('accepts every recoverable platform state and rejects inconsistent funding payloads', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(platformPlanningSession()))
      .mockResolvedValueOnce(jsonResponse(platformFailedSession()))
      .mockResolvedValueOnce(jsonResponse(platformAbandonedSession()))
      .mockResolvedValueOnce(
        jsonResponse({ ...platformPlanningSession(), funding_mode: 'byok' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ ...platformPlanReadySession(), platform_limits: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          totalGranted: 3,
          available: 4,
          reserved: 0,
          consumed: 0,
          activePlatformSessionId: null,
          platformModeAvailable: true,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(readTreeGeneration('planning')).resolves.toMatchObject({
      state: 'planning',
      latestPlan: null,
    });
    await expect(readTreeGeneration('failed')).resolves.toMatchObject({
      state: 'failed',
    });
    await expect(readTreeGeneration('abandoned')).resolves.toMatchObject({
      state: 'abandoned',
    });
    await expect(readTreeGeneration('bad-byok')).rejects.toMatchObject({
      code: 'generation.invalid_response',
    });
    await expect(readTreeGeneration('missing-limits')).rejects.toMatchObject({
      code: 'generation.invalid_response',
    });
    await expect(readPlatformGenerationEntitlements()).rejects.toMatchObject({
      code: 'generation.invalid_response',
    });
  });
});

function planReadySession(version = 1, changeKind = 'initial') {
  return {
    generation_session_id: '71000000-0000-4000-8000-000000000001',
    input: {
      topic: input.topic,
      role: input.role,
      goal_description: input.goalDescription,
      learner_context_summary: input.learnerContextSummary,
    },
    funding_mode: 'byok',
    state: 'plan_ready',
    latest_plan: {
      version,
      change_kind: changeKind,
      outcome: {
        outcome: 'plan_ready',
        normalized_spec: {
          topic: input.topic,
          role: input.role,
          goal_description: input.goalDescription,
          learner_context_summary: input.learnerContextSummary,
        },
        stages: [
          { title: '基础', goal: '掌握语义', topics: ['所有权'] },
          { title: '交付', goal: '部署服务', topics: ['Axum'] },
        ],
        assumptions: ['每周投入八小时'],
        estimated_nodes: 20,
      },
      usage: usageDocument(),
    },
    latest_run: null,
    produced_tree_id: null,
    produced_library_entry_id: null,
    platform_limits: null,
  };
}

function platformPlanningSession() {
  return {
    ...planReadySession(),
    funding_mode: 'platform',
    state: 'planning',
    latest_plan: null,
    platform_limits: platformLimits(),
  };
}

function platformPlanReadySession(version = 1, changeKind = 'initial') {
  return {
    ...planReadySession(version, changeKind),
    funding_mode: 'platform',
    platform_limits: platformLimits(),
  };
}

function platformFailedSession() {
  return {
    ...platformPlanReadySession(),
    state: 'failed',
    latest_run: {
      ...runDocument('failed'),
      error_code: 'generation.provider_unavailable',
    },
    platform_limits: { ...platformLimits(), formal_run_attempts_remaining: 0 },
  };
}

function platformAbandonedSession() {
  return { ...platformPlanReadySession(), state: 'abandoned' };
}

function platformLimits() {
  return {
    replans_remaining: 3,
    adjustments_remaining: 5,
    clarification_questions_remaining: 1,
    formal_run_attempts_remaining: 2,
  };
}

function needsInputSession() {
  const session = planReadySession();
  return {
    ...session,
    state: 'needs_input',
    latest_plan: {
      ...session.latest_plan,
      outcome: { outcome: 'needs_input', question: '每周可以投入多少时间？' },
    },
  };
}

function runDocument(status: 'queued' | 'running' | 'failed') {
  return {
    run_id: '72000000-0000-4000-8000-000000000001',
    status,
    stage: status === 'running' ? 'bridging' : null,
    message: status === 'running' ? '正在生成学习路径' : null,
    progress: status === 'running' ? 0.5 : 0,
    error_code: status === 'failed' ? 'generation.provider_unavailable' : null,
    usage: usageDocument(),
  };
}

function usageDocument() {
  return {
    input_tokens: 20,
    output_tokens: 10,
    cache_hit_input_tokens: 8,
    cache_miss_input_tokens: 12,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
