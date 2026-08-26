import type {
  KnowledgeChatHistoryResponse,
  KnowledgeChatMessage,
  KnowledgeChatResponse,
  KnowledgeChatUsage,
} from './types';
import { KnowledgeChatApiError } from './types';

export { KnowledgeChatApiError } from './types';

const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_CLIENT_TURN_ID_CHARACTERS = 128;

export async function fetchKnowledgeChatHistory(
  libraryEntryId: string,
): Promise<KnowledgeChatHistoryResponse> {
  validatePathSegment(libraryEntryId);
  const response = await request(
    `/api/me/tree-library/${encodeURIComponent(libraryEntryId)}/knowledge-chat/history`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    },
  );
  const body = await readJson(response);
  if (!isRecord(body) || !Array.isArray(body.messages)) throw invalidResponseError();
  return { messages: body.messages.map(parseHistoryMessage) };
}

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

export async function sendKnowledgeChatMessageStream(
  libraryEntryId: string,
  message: string,
  clientTurnId: string,
  csrfToken: string,
  onDelta: (delta: string) => void,
): Promise<KnowledgeChatResponse> {
  validatePathSegment(libraryEntryId);
  validateMessage(message);
  validateClientTurnId(clientTurnId);

  const response = await request(
    `/api/me/tree-library/${encodeURIComponent(libraryEntryId)}/knowledge-chat/messages/stream`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ message, clientTurnId }),
    },
  );

  if (!response.body) throw invalidResponseError();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: KnowledgeChatResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = findSseFrameBoundary(buffer);
        if (!boundary) break;
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;

        if (parsed.event === 'delta') {
          const data = parseSseJson(parsed.data);
          if (!isRecord(data) || typeof data.delta !== 'string') {
            throw invalidResponseError();
          }
          onDelta(data.delta);
        } else if (parsed.event === 'complete') {
          finalResponse = parseChatResponse(parseSseJson(parsed.data));
        } else if (parsed.event === 'error') {
          throw parseSseError(parsed.data);
        }
      }
    }

    buffer += decoder.decode();
    const trailingFrame = buffer.trim();
    if (trailingFrame) {
      const parsed = parseSseFrame(trailingFrame);
      if (parsed?.event === 'complete') {
        finalResponse = parseChatResponse(parseSseJson(parsed.data));
      } else if (parsed?.event === 'error') {
        throw parseSseError(parsed.data);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResponse) throw invalidResponseError();
  return finalResponse;
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

function findSseFrameBoundary(value: string): { index: number; length: number } | null {
  const candidates = ['\n\n', '\r\n\r\n', '\r\r'];
  let match: { index: number; length: number } | null = null;
  for (const candidate of candidates) {
    const index = value.indexOf(candidate);
    if (index >= 0 && (!match || index < match.index)) {
      match = { index, length: candidate.length };
    }
  }
  return match;
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  const normalizedFrame = frame.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of normalizedFrame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const rawValue = separator < 0 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'event') event = value;
    if (field === 'data') dataLines.push(value);
  }
  return dataLines.length > 0 ? { event, data: dataLines.join('\n') } : null;
}

function parseSseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw invalidResponseError();
  }
}

function parseSseError(value: string): KnowledgeChatApiError {
  const body = parseSseJson(value);
  if (isRecord(body) && typeof body.code === 'string' && typeof body.message === 'string') {
    return new KnowledgeChatApiError(
      502,
      body.code,
      body.message,
      typeof body.traceId === 'string' ? body.traceId : undefined,
    );
  }
  return invalidResponseError();
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
    (value.creditBalance !== undefined &&
      (typeof value.creditBalance !== 'number' ||
        !Number.isFinite(value.creditBalance) ||
        value.creditBalance < 0))
  ) {
    throw invalidResponseError();
  }
  const creditBalance =
    typeof value.creditBalance === 'number' ? value.creditBalance : undefined;
  return {
    answer: value.answer,
    usage,
    chargedCredits: value.chargedCredits,
    ...(creditBalance === undefined ? {} : { creditBalance }),
  };
}

function parseHistoryMessage(value: unknown): KnowledgeChatMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    (value.role !== 'user' && value.role !== 'assistant') ||
    typeof value.content !== 'string'
  ) {
    throw invalidResponseError();
  }
  return {
    id: value.id,
    role: value.role,
    content: value.content,
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
