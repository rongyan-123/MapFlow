import type {
  KnowledgeChatResponse,
  KnowledgeChatUsage,
} from './types';
import { KnowledgeChatApiError } from './types';

export { KnowledgeChatApiError } from './types';

const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_CLIENT_TURN_ID_CHARACTERS = 128;

export async function sendKnowledgeChatMessage(
  libraryEntryId: string,
  message: string,
  clientTurnId: string,
  csrfToken: string,
): Promise<KnowledgeChatResponse> {
  validatePathSegment(libraryEntryId);
  validateMessage(message);
  validateClientTurnId(clientTurnId);

  const response = await request(
    `/api/me/tree-library/${encodeURIComponent(libraryEntryId)}/knowledge-chat/messages`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ message, clientTurnId }),
    },
  );
  return parseChatResponse(await readJson(response));
}

export async function resetKnowledgeChat(
  libraryEntryId: string,
  csrfToken: string,
): Promise<void> {
  validatePathSegment(libraryEntryId);
  await request(
    `/api/me/tree-library/${encodeURIComponent(libraryEntryId)}/knowledge-chat/reset`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    },
  );
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new KnowledgeChatApiError(
      0,
      'knowledge_chat_network_unavailable',
      '知识聊天服务暂时无法连接。',
    );
  }
  if (!response.ok) throw await parseError(response);
  return response;
}

async function parseError(response: Response): Promise<KnowledgeChatApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new KnowledgeChatApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // malformed error bodies are replaced with a stable local message below
  }
  return new KnowledgeChatApiError(
    response.status,
    'knowledge_chat.request_failed',
    '知识聊天请求失败，请稍后重试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function parseChatResponse(value: unknown): KnowledgeChatResponse {
  if (!isRecord(value) || typeof value.answer !== 'string' || !value.answer.trim()) {
    throw invalidResponseError();
  }
  const usage = parseUsage(value.usage);
  if (
    typeof value.chargedCredits !== 'number' ||
    !Number.isFinite(value.chargedCredits) ||
    value.chargedCredits < 0 ||
    !isNonNegativeInteger(value.sandboxRemainingUnits)
  ) {
    throw invalidResponseError();
  }
  return {
    answer: value.answer,
    usage,
    chargedCredits: value.chargedCredits,
    sandboxRemainingUnits: value.sandboxRemainingUnits,
  };
}

function parseUsage(value: unknown): KnowledgeChatUsage {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.inputTokens) ||
    !isNonNegativeInteger(value.outputTokens) ||
    !isNonNegativeInteger(value.cacheHitInputTokens) ||
    !isNonNegativeInteger(value.cacheMissInputTokens)
  ) {
    throw invalidResponseError();
  }
  return {
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
    cacheHitInputTokens: value.cacheHitInputTokens,
    cacheMissInputTokens: value.cacheMissInputTokens,
  };
}

function validatePathSegment(value: string): void {
  if (!value || value.length > MAX_CLIENT_TURN_ID_CHARACTERS) {
    throw new KnowledgeChatApiError(
      400,
      'knowledge_chat_invalid_request',
      '知识聊天请求无效。',
    );
  }
}

function validateMessage(value: string): void {
  if (!value.trim() || value.length > MAX_MESSAGE_CHARACTERS || hasControlCharacter(value)) {
    throw new KnowledgeChatApiError(
      400,
      'knowledge_chat_invalid_message',
      '请输入 1 到 4000 个字符的问题。',
    );
  }
}

function validateClientTurnId(value: string): void {
  if (!value || value.length > MAX_CLIENT_TURN_ID_CHARACTERS || hasControlCharacter(value)) {
    throw new KnowledgeChatApiError(
      400,
      'knowledge_chat_invalid_request',
      '聊天请求标识无效，请重试。',
    );
  }
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function invalidResponseError(): KnowledgeChatApiError {
  return new KnowledgeChatApiError(
    502,
    'knowledge_chat_invalid_response',
    '知识聊天服务返回了无法识别的结果。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
