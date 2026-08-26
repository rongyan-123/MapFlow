import type {
  TreeGenerationApiError,
  TreeGenerationErrorDetails,
} from './treeGenerationClient';

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
  'generation.feedback_invalid',
  'generation.engine_failed',
  'generation.input_invalid',
  'generation.insufficient_balance',
  'generation.invalid_model_output',
  'generation.invalid_response',
  'generation.model_access_invalid',
  'generation.model_access_required',
  'generation.platform_model_access_forbidden',
  'generation.planning_follow_up_not_allowed',
  'generation.projection_failed',
  'generation.rate_limited',
  'generation.request_failed',
  'generation.request_malformed',
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
  'generation.feedback_invalid': '请检查你填写的修改或补充信息。',
  'generation.engine_failed': '技能树生成暂时失败，请稍后重试。',
  'generation.input_invalid': '请检查生成表单中的学习需求。',
  'generation.insufficient_balance': 'DeepSeek 账户余额不足，请充值或更换 API Key 后重试。',
  'generation.invalid_model_output': 'DeepSeek 返回的内容格式异常，请重新尝试生成。',
  'generation.invalid_response': '技能树生成服务返回了无法识别的结果。',
  'generation.model_access_invalid': '请检查 DeepSeek API Key 和模型配置。',
  'generation.model_access_required': '请提供 DeepSeek API Key 和模型配置。',
  'generation.platform_model_access_forbidden':
    '平台代付模式不接受自定义模型配置，请刷新页面后重试。',
  'generation.planning_follow_up_not_allowed':
    'DeepSeek 未按当前规划阶段返回结果，本次修改未保存，请重试。',
  'generation.projection_failed': '技能树结果无法转换为页面格式。',
  'generation.rate_limited': 'DeepSeek 请求过于频繁，请稍后再试。',
  'generation.request_failed': '技能树生成请求失败，请稍后重试。',
  'generation.request_malformed':
    '生成请求缺少必要字段或包含不支持的字段，请刷新页面后重新填写。',
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
  const detailedMessage = readableGenerationValidationError(error);
  if (detailedMessage) return detailedMessage;
  return SAFE_ERROR_MESSAGES[error.code] ?? '技能树生成请求失败，请稍后重试。';
}

const GENERATION_INPUT_FIELD_LABELS: Readonly<Record<string, string>> = {
  topic: '想学习什么知识？',
  role: '希望走什么职业或应用方向？',
  goalDescription: '希望最终达到什么目标？',
  learnerContextSummary: '当前基础、限制和学习偏好是什么？',
};

function readableGenerationValidationError(
  error: TreeGenerationApiError,
): string | null {
  if (error.code === 'generation.input_invalid') {
    const details = safeGenerationDetails(error.details, GENERATION_INPUT_FIELD_LABELS);
    return details ? generationFieldMessage(details.label, details.reason, details.maxChars) : null;
  }
  if (error.code === 'generation.feedback_invalid') {
    const details = safeGenerationDetails(error.details, { feedback: '修改或补充信息' });
    return details ? generationFieldMessage(details.label, details.reason, details.maxChars) : null;
  }
  if (error.code === 'generation.model_access_invalid') {
    const details = safeGenerationDetails(error.details, {
      apiKey: 'DeepSeek API Key',
      model: '模型',
      thinking: '思考模式',
      reasoningEffort: '思考强度',
    });
    if (!details) return null;
    if (details.field === 'apiKey') {
      return generationFieldMessage(details.label, details.reason, details.maxChars);
    }
    return details.reason === 'unsupported_value'
      ? `请选择支持的${details.label}。`
      : `“${details.label}”配置无效，请重新选择后再试。`;
  }
  return null;
}

function safeGenerationDetails(
  details: TreeGenerationErrorDetails | undefined,
  fields: Readonly<Record<string, string>>,
): { field: string; label: string; reason: string; maxChars?: number } | null {
  if (!details || !(details.field in fields)) return null;
  if (
    !['empty', 'too_long', 'control_character', 'unsupported_value'].includes(details.reason)
  ) {
    return null;
  }
  if (
    details.maxChars !== undefined &&
    (!Number.isInteger(details.maxChars) || details.maxChars <= 0 || details.maxChars > 10_000)
  ) {
    return null;
  }
  return {
    field: details.field,
    label: fields[details.field],
    reason: details.reason,
    ...(details.maxChars === undefined ? {} : { maxChars: details.maxChars }),
  };
}

function generationFieldMessage(
  label: string,
  reason: string,
  maxChars: number | undefined,
): string {
  switch (reason) {
    case 'empty':
      return `请填写“${label}”。`;
    case 'too_long':
      return `“${label}”不能超过 ${maxChars ?? 10_000} 个字，请缩短后再试。`;
    case 'control_character':
      return `“${label}”不能包含换行或不可见控制字符，请删除后再试。`;
    default:
      return `“${label}”格式不支持，请修改后再试。`;
  }
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
