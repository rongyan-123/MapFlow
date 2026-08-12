import type { TreeGenerationApiError } from './treeGenerationClient';

export type GenerationDiagnosticOperation =
  | 'create_plan'
  | 'clarify_plan'
  | 'replan'
  | 'adjust'
  | 'confirm_generation'
  | 'read_session'
  | 'read_run'
  | 'abandon_session'
  | 'release_failed_session';

export interface GenerationDiagnostic {
  diagnosticVersion: 1;
  product: 'MapFlow';
  occurredAt: string;
  operation: GenerationDiagnosticOperation;
  httpStatus: number;
  errorCode: string;
  traceId: string | null;
  sessionId: string | null;
  planVersion: number | null;
}

const SAFE_ERROR_CODES = new Set([
  'generation.api_key_invalid',
  'generation.engine_failed',
  'generation.insufficient_balance',
  'generation.invalid_model_output',
  'generation.invalid_response',
  'generation.planning_follow_up_not_allowed',
  'generation.projection_failed',
  'generation.rate_limited',
  'generation.request_failed',
  'generation.state_conflict',
  'generation.temporarily_unavailable',
  'generation.unclassified_error',
  'identity.authentication_rejected',
  'identity.csrf_rejected',
  'identity.temporarily_unavailable',
  'network.unavailable',
  'platform_adjust_limit_reached',
  'platform_clarification_limit_reached',
  'platform_entitlement_exhausted',
  'platform_failed_session_not_releasable',
  'platform_generation_retry_exhausted',
  'platform_generation_session_active',
  'platform_generation_unavailable',
  'platform_replan_limit_reached',
  'platform_session_not_abandonable',
  'rate_limit.exceeded',
  'request.invalid',
  'request.origin_rejected',
  'request.payload_too_large',
  'route.not_found',
]);
const SAFE_OPERATIONS = new Set<GenerationDiagnosticOperation>([
  'create_plan',
  'clarify_plan',
  'replan',
  'adjust',
  'confirm_generation',
  'read_session',
  'read_run',
  'abandon_session',
  'release_failed_session',
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'generation.api_key_invalid': 'DeepSeek API Key 无效或已失效，请检查后重试。',
  'generation.engine_failed': '技能树生成暂时失败，请稍后重试。',
  'generation.insufficient_balance': 'DeepSeek 账户余额不足，请充值或更换 API Key 后重试。',
  'generation.invalid_model_output': 'DeepSeek 返回的内容格式异常，请重新尝试生成。',
  'generation.invalid_response': '技能树生成服务返回了无法识别的结果。',
  'generation.planning_follow_up_not_allowed':
    'DeepSeek 未按当前规划阶段返回结果，本次修改未保存，请重试。',
  'generation.projection_failed': '技能树结果无法转换为页面格式。',
  'generation.rate_limited': 'DeepSeek 请求过于频繁，请稍后再试。',
  'generation.request_failed': '技能树生成请求失败，请稍后重试。',
  'generation.state_conflict': '技能树生成状态已变化，请刷新后重试。',
  'generation.temporarily_unavailable': '技能树生成服务暂时不可用，请稍后重试。',
  'identity.authentication_rejected': '登录状态已失效，请重新登录。',
  'identity.csrf_rejected': '请求验证失败，请刷新页面后重试。',
  'identity.temporarily_unavailable': '账号服务暂时不可用，请稍后重试。',
  'network.unavailable': '技能树生成服务暂时无法连接。',
  'platform_adjust_limit_reached': '平台免费体验的细节调整次数已用完。',
  'platform_clarification_limit_reached': '平台免费体验的补充追问次数已用完。',
  'platform_entitlement_exhausted': '平台免费生成次数已用完。',
  'platform_failed_session_not_releasable': '当前失败会话不能释放免费生成次数。',
  'platform_generation_retry_exhausted': '平台免费体验的系统失败重试次数已用完。',
  'platform_generation_session_active': '当前已有一个进行中的平台免费生成会话。',
  'platform_generation_unavailable': '平台免费生成暂时不可用，请稍后重试。',
  'platform_replan_limit_reached': '平台免费体验的重新规划次数已用完。',
  'platform_session_not_abandonable': '当前平台生成会话不能主动放弃。',
  'rate_limit.exceeded': '请求过于频繁，请稍后再试。',
  'request.invalid': '请求格式无效。',
  'request.origin_rejected': '请求来源无效，请刷新页面后重试。',
  'request.payload_too_large': '请求内容过大，请缩短输入后重试。',
  'route.not_found': '请求的生成资源不存在。',
};

export function createGenerationDiagnostic({
  operation,
  error,
  sessionId,
  planVersion,
  occurredAt = new Date().toISOString(),
}: {
  operation: GenerationDiagnosticOperation;
  error: unknown;
  sessionId: string | null;
  planVersion: number | null;
  occurredAt?: string;
}): GenerationDiagnostic | null {
  if (!isTreeGenerationApiError(error)) return null;
  return {
    diagnosticVersion: 1,
    product: 'MapFlow',
    occurredAt: normalizeIsoTimestamp(occurredAt),
    operation,
    httpStatus: isHttpStatus(error.status) ? error.status : 0,
    errorCode: SAFE_ERROR_CODES.has(error.code)
      ? error.code
      : 'generation.unclassified_error',
    traceId: isUuid(error.traceId) ? error.traceId : null,
    sessionId: isUuid(sessionId) ? sessionId : null,
    planVersion:
      typeof planVersion === 'number' && Number.isInteger(planVersion) && planVersion > 0
        ? planVersion
        : null,
  };
}

export function readableGenerationError(error: unknown): string | null {
  if (!isTreeGenerationApiError(error)) {
    return error instanceof Error ? error.message : null;
  }
  return SAFE_ERROR_MESSAGES[error.code] ?? '技能树生成请求失败，请稍后重试。';
}

function isHttpStatus(status: number): boolean {
  return Number.isInteger(status) && (status === 0 || (status >= 400 && status <= 599));
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function serializeGenerationDiagnostic(
  diagnostic: GenerationDiagnostic | null,
): string {
  if (!isSafeGenerationDiagnostic(diagnostic)) return '';
  return JSON.stringify(
    {
      diagnosticVersion: diagnostic.diagnosticVersion,
      product: diagnostic.product,
      occurredAt: diagnostic.occurredAt,
      operation: diagnostic.operation,
      httpStatus: diagnostic.httpStatus,
      errorCode: diagnostic.errorCode,
      traceId: diagnostic.traceId,
      sessionId: diagnostic.sessionId,
      planVersion: diagnostic.planVersion,
    },
    null,
    2,
  );
}

function isSafeGenerationDiagnostic(
  diagnostic: GenerationDiagnostic | null,
): diagnostic is GenerationDiagnostic {
  return (
    diagnostic !== null &&
    diagnostic.diagnosticVersion === 1 &&
    diagnostic.product === 'MapFlow' &&
    isCanonicalIsoTimestamp(diagnostic.occurredAt) &&
    SAFE_OPERATIONS.has(diagnostic.operation) &&
    isHttpStatus(diagnostic.httpStatus) &&
    SAFE_ERROR_CODES.has(diagnostic.errorCode) &&
    (diagnostic.traceId === null || isUuid(diagnostic.traceId)) &&
    (diagnostic.sessionId === null || isUuid(diagnostic.sessionId)) &&
    (diagnostic.planVersion === null ||
      (Number.isInteger(diagnostic.planVersion) && diagnostic.planVersion > 0))
  );
}

function normalizeIsoTimestamp(value: string): string {
  if (isCanonicalIsoTimestamp(value)) return value;
  return new Date().toISOString();
}

function isCanonicalIsoTimestamp(value: string): boolean {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isTreeGenerationApiError(
  error: unknown,
): error is TreeGenerationApiError {
  return (
    error instanceof Error &&
    error.name === 'TreeGenerationApiError' &&
    typeof (error as Partial<TreeGenerationApiError>).status === 'number' &&
    typeof (error as Partial<TreeGenerationApiError>).code === 'string'
  );
}
