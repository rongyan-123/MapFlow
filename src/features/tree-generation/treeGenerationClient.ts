import type {
  GenerationInput,
  GenerationFundingMode,
  GenerationPlan,
  GenerationPlanStage,
  GenerationRun,
  GenerationRunStatus,
  GenerationSession,
  GenerationSessionState,
  GenerationUsage,
  ModelAccess,
  PlatformGenerationEntitlementSummary,
  PlatformGenerationLimits,
  PlanningChangeKind,
  PlanningOutcome,
} from './types';

const JSON_GET: RequestInit = {
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
};

export class TreeGenerationApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;
  readonly details?: TreeGenerationErrorDetails;

  constructor(
    status: number,
    code: string,
    message: string,
    traceId?: string,
    details?: TreeGenerationErrorDetails,
  ) {
    super(message);
    this.name = 'TreeGenerationApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
    this.details = details;
  }
}

export interface TreeGenerationErrorDetails {
  readonly field: string;
  readonly reason: string;
  readonly maxChars?: number;
}

export async function createTreeGeneration(
  input: GenerationInput,
  modelAccess: ModelAccess,
  csrfToken: string,
): Promise<GenerationSession> {
  const response = await request(
    '/api/me/tree-generations',
    modelRequest(csrfToken, { ...input, modelAccess }),
    [modelAccess.apiKey],
  );
  return parseGenerationSession(await readJson(response));
}

export async function createPlatformTreeGeneration(
  input: GenerationInput,
  csrfToken: string,
): Promise<GenerationSession> {
  const response = await request(
    '/api/me/tree-generations',
    modelRequest(csrfToken, { ...input, fundingMode: 'platform' }),
  );
  return parseGenerationSession(await readJson(response));
}

export async function readPlatformGenerationEntitlements(): Promise<PlatformGenerationEntitlementSummary> {
  const response = await request(
    '/api/me/platform-generation-entitlements',
    JSON_GET,
  );
  return parsePlatformGenerationEntitlements(await readJson(response));
}

export async function readTreeGeneration(
  generationSessionId: string,
): Promise<GenerationSession> {
  const path = `/api/me/tree-generations/${encodeURIComponent(generationSessionId)}`;
  return parseGenerationSession(await readJson(await request(path, JSON_GET)));
}

export async function replanTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  feedback: string,
  modelAccess: ModelAccess,
  csrfToken: string,
): Promise<GenerationSession> {
  return reviseTreeGeneration(
    generationSessionId,
    'replan',
    { expectedPlanVersion, feedback, modelAccess },
    modelAccess.apiKey,
    csrfToken,
  );
}

export async function replanPlatformTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  feedback: string,
  csrfToken: string,
): Promise<GenerationSession> {
  return revisePlatformTreeGeneration(
    generationSessionId,
    'replan',
    { expectedPlanVersion, feedback },
    csrfToken,
  );
}

export async function adjustTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  feedback: string,
  modelAccess: ModelAccess,
  csrfToken: string,
): Promise<GenerationSession> {
  return reviseTreeGeneration(
    generationSessionId,
    'adjust',
    { expectedPlanVersion, feedback, modelAccess },
    modelAccess.apiKey,
    csrfToken,
  );
}

export async function adjustPlatformTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  feedback: string,
  csrfToken: string,
): Promise<GenerationSession> {
  return revisePlatformTreeGeneration(
    generationSessionId,
    'adjust',
    { expectedPlanVersion, feedback },
    csrfToken,
  );
}

export async function clarifyTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  answer: string,
  modelAccess: ModelAccess,
  csrfToken: string,
): Promise<GenerationSession> {
  return reviseTreeGeneration(
    generationSessionId,
    'clarify',
    { expectedPlanVersion, answer, modelAccess },
    modelAccess.apiKey,
    csrfToken,
  );
}

export async function clarifyPlatformTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  answer: string,
  csrfToken: string,
): Promise<GenerationSession> {
  return revisePlatformTreeGeneration(
    generationSessionId,
    'clarify',
    { expectedPlanVersion, answer },
    csrfToken,
  );
}

export async function confirmTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  idempotencyKey: string,
  modelAccess: ModelAccess,
  csrfToken: string,
): Promise<GenerationRun> {
  const path = `/api/me/tree-generations/${encodeURIComponent(generationSessionId)}/confirm`;
  const response = await request(
    path,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ expectedPlanVersion, modelAccess }),
    },
    [modelAccess.apiKey],
  );
  return parseGenerationRun(await readJson(response));
}

export async function confirmPlatformTreeGeneration(
  generationSessionId: string,
  expectedPlanVersion: number,
  idempotencyKey: string,
  csrfToken: string,
): Promise<GenerationRun> {
  const path = `/api/me/tree-generations/${encodeURIComponent(generationSessionId)}/confirm`;
  const response = await request(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ expectedPlanVersion }),
  });
  return parseGenerationRun(await readJson(response));
}

export async function abandonPlatformTreeGeneration(
  generationSessionId: string,
  csrfToken: string,
): Promise<GenerationSession> {
  return platformLifecycleCommand(generationSessionId, 'abandon', csrfToken);
}

export async function releaseFailedPlatformTreeGeneration(
  generationSessionId: string,
  csrfToken: string,
): Promise<GenerationSession> {
  return platformLifecycleCommand(generationSessionId, 'release-failed', csrfToken);
}

export async function readGenerationRun(
  generationSessionId: string,
  runId: string,
): Promise<GenerationRun> {
  const session = encodeURIComponent(generationSessionId);
  const run = encodeURIComponent(runId);
  const path = `/api/me/tree-generations/${session}/runs/${run}`;
  return parseGenerationRun(await readJson(await request(path, JSON_GET)));
}

async function reviseTreeGeneration(
  generationSessionId: string,
  action: 'replan' | 'adjust' | 'clarify',
  body: object,
  apiKey: string,
  csrfToken: string,
): Promise<GenerationSession> {
  const session = encodeURIComponent(generationSessionId);
  const path = `/api/me/tree-generations/${session}/${action}`;
  const response = await request(path, modelRequest(csrfToken, body), [apiKey]);
  return parseGenerationSession(await readJson(response));
}

async function revisePlatformTreeGeneration(
  generationSessionId: string,
  action: 'replan' | 'adjust' | 'clarify',
  body: object,
  csrfToken: string,
): Promise<GenerationSession> {
  const session = encodeURIComponent(generationSessionId);
  const path = `/api/me/tree-generations/${session}/${action}`;
  const response = await request(path, modelRequest(csrfToken, body));
  return parseGenerationSession(await readJson(response));
}

async function platformLifecycleCommand(
  generationSessionId: string,
  action: 'abandon' | 'release-failed',
  csrfToken: string,
): Promise<GenerationSession> {
  const session = encodeURIComponent(generationSessionId);
  const path = `/api/me/tree-generations/${session}/${action}`;
  const response = await request(path, modelRequest(csrfToken, {}));
  return parseGenerationSession(await readJson(response));
}

function modelRequest(csrfToken: string, body: object): RequestInit {
  return {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  };
}

async function request(
  path: string,
  init: RequestInit,
  redactedValues: readonly string[] = [],
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new TreeGenerationApiError(
      0,
      'network.unavailable',
      '技能树生成服务暂时无法连接。',
    );
  }
  if (!response.ok) throw await parseError(response, redactedValues);
  return response;
}

async function parseError(
  response: Response,
  redactedValues: readonly string[],
): Promise<TreeGenerationApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new TreeGenerationApiError(
        response.status,
        body.error.code,
        redact(body.error.message, redactedValues),
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
        parseGenerationErrorDetails(body.error.details),
      );
    }
  } catch {
    // A malformed body is replaced with a stable local error below.
  }
  return new TreeGenerationApiError(
    response.status,
    'generation.request_failed',
    '技能树生成请求失败，请稍后重试。',
  );
}

function parseGenerationErrorDetails(value: unknown): TreeGenerationErrorDetails | undefined {
  if (!isRecord(value) || typeof value.field !== 'string' || typeof value.reason !== 'string') {
    return undefined;
  }
  const maxChars = value.maxChars;
  if (
    maxChars !== undefined &&
    (typeof maxChars !== 'number' || !Number.isInteger(maxChars) || maxChars <= 0)
  ) {
    return undefined;
  }
  return {
    field: value.field,
    reason: value.reason,
    ...(maxChars === undefined ? {} : { maxChars }),
  };
}

function redact(message: string, redactedValues: readonly string[]): string {
  return redactedValues.reduce(
    (safe, value) => (value.length > 0 ? safe.split(value).join('[REDACTED]') : safe),
    message,
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function parseGenerationSession(value: unknown): GenerationSession {
  if (
    !isRecord(value) ||
    typeof value.generation_session_id !== 'string' ||
    !isGenerationFundingMode(value.funding_mode) ||
    !isGenerationSessionState(value.state) ||
    !isNullableString(value.produced_tree_id) ||
    !isNullableString(value.produced_library_entry_id)
  ) {
    throw invalidResponseError();
  }
  const latestPlan =
    value.latest_plan === null ? null : parseGenerationPlan(value.latest_plan);
  const platformLimits =
    value.platform_limits === null
      ? null
      : parsePlatformGenerationLimits(value.platform_limits);
  if (
    (value.funding_mode === 'byok' && platformLimits !== null) ||
    (value.funding_mode === 'platform' && platformLimits === null) ||
    (value.state === 'planning' &&
      (value.funding_mode !== 'platform' || latestPlan !== null)) ||
    (!['planning', 'failed'].includes(value.state) && latestPlan === null)
  ) {
    throw invalidResponseError();
  }
  return {
    generationSessionId: value.generation_session_id,
    input: parseGenerationInput(value.input),
    fundingMode: value.funding_mode,
    state: value.state,
    latestPlan,
    latestRun: value.latest_run === null ? null : parseGenerationRun(value.latest_run),
    producedTreeId: value.produced_tree_id,
    producedLibraryEntryId: value.produced_library_entry_id,
    platformLimits,
  };
}

function parsePlatformGenerationEntitlements(
  value: unknown,
): PlatformGenerationEntitlementSummary {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.totalGranted) ||
    !isNonNegativeInteger(value.available) ||
    !isNonNegativeInteger(value.reserved) ||
    !isNonNegativeInteger(value.consumed) ||
    !isNullableString(value.activePlatformSessionId) ||
    typeof value.platformModeAvailable !== 'boolean' ||
    value.reserved > 1 ||
    value.available + value.reserved + value.consumed !== value.totalGranted ||
    (value.reserved === 1) !== (value.activePlatformSessionId !== null)
  ) {
    throw invalidResponseError();
  }
  return {
    totalGranted: value.totalGranted,
    available: value.available,
    reserved: value.reserved,
    consumed: value.consumed,
    activePlatformSessionId: value.activePlatformSessionId,
    platformModeAvailable: value.platformModeAvailable,
  };
}

function parsePlatformGenerationLimits(value: unknown): PlatformGenerationLimits {
  if (
    !isRecord(value) ||
    !isBoundedInteger(value.replans_remaining, 3) ||
    !isBoundedInteger(value.adjustments_remaining, 5) ||
    !isBoundedInteger(value.clarification_questions_remaining, 1) ||
    !isBoundedInteger(value.formal_run_attempts_remaining, 2)
  ) {
    throw invalidResponseError();
  }
  return {
    replansRemaining: value.replans_remaining,
    adjustmentsRemaining: value.adjustments_remaining,
    clarificationQuestionsRemaining: value.clarification_questions_remaining,
    formalRunAttemptsRemaining: value.formal_run_attempts_remaining,
  };
}

function parseGenerationInput(value: unknown): GenerationInput {
  if (
    !isRecord(value) ||
    typeof value.topic !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.goal_description !== 'string' ||
    typeof value.learner_context_summary !== 'string'
  ) {
    throw invalidResponseError();
  }
  return {
    topic: value.topic,
    role: value.role,
    goalDescription: value.goal_description,
    learnerContextSummary: value.learner_context_summary,
  };
}

function parseGenerationPlan(value: unknown): GenerationPlan {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.version) ||
    value.version === 0 ||
    !isPlanningChangeKind(value.change_kind)
  ) {
    throw invalidResponseError();
  }
  return {
    version: value.version,
    changeKind: value.change_kind,
    outcome: parsePlanningOutcome(value.outcome),
    usage: parseUsage(value.usage),
  };
}

function parsePlanningOutcome(value: unknown): PlanningOutcome {
  if (!isRecord(value)) throw invalidResponseError();
  if (value.outcome === 'needs_input' && isNonEmptyString(value.question)) {
    return { outcome: 'needs_input', question: value.question };
  }
  if (
    value.outcome !== 'plan_ready' ||
    !Array.isArray(value.stages) ||
    value.stages.length < 2 ||
    value.stages.length > 10 ||
    !isStringArray(value.assumptions) ||
    value.assumptions.length < 1 ||
    value.assumptions.length > 12 ||
    !value.assumptions.every(isNonEmptyString) ||
    !isNonNegativeInteger(value.estimated_nodes) ||
    value.estimated_nodes < 15 ||
    value.estimated_nodes > 50
  ) {
    throw invalidResponseError();
  }
  return {
    outcome: 'plan_ready',
    normalizedSpec: parseGenerationInput(value.normalized_spec),
    stages: value.stages.map(parsePlanStage),
    assumptions: [...value.assumptions],
    estimatedNodes: value.estimated_nodes,
  };
}

function parsePlanStage(value: unknown): GenerationPlanStage {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.goal) ||
    !isStringArray(value.topics) ||
    value.topics.length < 1 ||
    value.topics.length > 12 ||
    !value.topics.every(isNonEmptyString)
  ) {
    throw invalidResponseError();
  }
  return {
    title: value.title,
    goal: value.goal,
    topics: [...value.topics],
  };
}

function parseGenerationRun(value: unknown): GenerationRun {
  if (
    !isRecord(value) ||
    typeof value.run_id !== 'string' ||
    !isGenerationRunStatus(value.status) ||
    !isNullableString(value.stage) ||
    !isNullableString(value.message) ||
    !isFiniteProgress(value.progress) ||
    !isNullableString(value.error_code)
  ) {
    throw invalidResponseError();
  }
  return {
    runId: value.run_id,
    status: value.status,
    stage: value.stage,
    message: value.message,
    progress: value.progress,
    errorCode: value.error_code,
    usage: parseUsage(value.usage),
  };
}

function parseUsage(value: unknown): GenerationUsage {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.input_tokens) ||
    !isNonNegativeInteger(value.output_tokens) ||
    !isNonNegativeInteger(value.cache_hit_input_tokens) ||
    !isNonNegativeInteger(value.cache_miss_input_tokens)
  ) {
    throw invalidResponseError();
  }
  return {
    inputTokens: value.input_tokens,
    outputTokens: value.output_tokens,
    cacheHitInputTokens: value.cache_hit_input_tokens,
    cacheMissInputTokens: value.cache_miss_input_tokens,
  };
}

function invalidResponseError(): TreeGenerationApiError {
  return new TreeGenerationApiError(
    502,
    'generation.invalid_response',
    '技能树生成服务返回了无法识别的结果。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return isNonNegativeInteger(value) && value <= maximum;
}

function isFiniteProgress(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPlanningChangeKind(value: unknown): value is PlanningChangeKind {
  return (
    value === 'initial' ||
    value === 'replan' ||
    value === 'adjust' ||
    value === 'clarification'
  );
}

function isGenerationSessionState(value: unknown): value is GenerationSessionState {
  return (
    value === 'planning' ||
    value === 'needs_input' ||
    value === 'plan_ready' ||
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'abandoned'
  );
}

function isGenerationFundingMode(value: unknown): value is GenerationFundingMode {
  return value === 'byok' || value === 'platform';
}

function isGenerationRunStatus(value: unknown): value is GenerationRunStatus {
  return (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed'
  );
}
