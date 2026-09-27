import { prepareConversationInput, validateId, validateMessage } from './conversationInput';
import { TavernApiError, type Character, type CompletedTurn, type Conversation, type ConversationDetail, type ConversationGraph, type CreateConversationInput, type GenerationAction, type GenerationRecord, type GenerationSettings, type GenerationSettingsState, type GraphMutation, type NormalizedCharacterCard, type TavernUserModelAccess, type Turn } from './types';
import { isRecord, NORMALIZED_CARD_BYTES, RAW_FILE_BYTES, tooLarge, utf8Bytes } from './validation';

const ROOT = '/api/me/tavern';
export async function importCharacter(card: NormalizedCharacterCard, sourceFile: File | undefined, csrfToken: string): Promise<Character> {
  const serialized = JSON.stringify(card);
  if (utf8Bytes(serialized) > NORMALIZED_CARD_BYTES || (sourceFile && sourceFile.size > RAW_FILE_BYTES)) tooLarge('角色卡文件过大。');
  const body = new FormData();
  body.append('normalized_card', serialized);
  if (sourceFile) body.append('source_file', sourceFile);
  return parseCharacter(await readJson(await request(`${ROOT}/characters`, { method: 'POST', headers: mutationHeaders(csrfToken), body })));
}
export async function fetchCharacters(signal?: AbortSignal): Promise<Character[]> {
  return parseList(await getJson(`${ROOT}/characters`, signal), 'characters', parseCharacter);
}
export async function deleteCharacter(id: string, csrfToken: string): Promise<void> {
  await request(`${ROOT}/characters/${pathId(id)}`, { method: 'DELETE', headers: mutationHeaders(csrfToken) });
}
export async function createConversation(input: CreateConversationInput, csrfToken: string): Promise<Conversation> {
  return parseConversation(await readJson(await request(`${ROOT}/conversations`, { method: 'POST',
    headers: mutationHeaders(csrfToken, true), body: JSON.stringify(prepareConversationInput(input)) })));
}
export async function fetchConversations(signal?: AbortSignal): Promise<Conversation[]> {
  return parseList(await getJson(`${ROOT}/conversations`, signal), 'conversations', parseConversation);
}
export async function fetchConversation(id: string, signal?: AbortSignal): Promise<ConversationDetail> {
  const body = await getJson(`${ROOT}/conversations/${pathId(id)}`, signal);
  if (!isRecord(body)) throw invalidResponse();
  return { conversation: parseConversation(body.conversation), character: parseCharacter(body.character),
    turns: parseList(body, 'turns', parseTurn), generations: parseList(body, 'generations', parseGeneration), graph: parseGraph(body.graph) };
}
export async function fetchTurns(id: string, signal?: AbortSignal): Promise<Turn[]> {
  return parseList(await getJson(`${ROOT}/conversations/${pathId(id)}/turns`, signal), 'turns', parseTurn);
}
export async function updateGenerationSettings(id: string, expectedSettingsVersion: number, settings: GenerationSettings, csrfToken: string): Promise<GenerationSettingsState> {
  validateGenerationSettings(settings);
  if (!positiveInteger(expectedSettingsVersion)) throw new TavernApiError(400, 'tavern.generation_settings_invalid', '设置版本无效。');
  const body = await readJson(await request(`${ROOT}/conversations/${pathId(id)}/settings`, {
    method: 'PATCH', headers: mutationHeaders(csrfToken, true), body: JSON.stringify({ expectedSettingsVersion, settings }),
  }));
  return parseGenerationSettingsState(body);
}
export async function mutateGraph(id: string, expectedRevision: number, action: GraphMutation, csrfToken: string): Promise<ConversationGraph> {
  if (!nonNegativeInteger(expectedRevision)) throw new TavernApiError(409, 'tavern.turn_conflict', '会话版本已变化，请刷新后重试。');
  const body = await readJson(await request(`${ROOT}/conversations/${pathId(id)}/actions`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: JSON.stringify({ expectedRevision, action }),
  }));
  return parseGraph(body);
}

export async function generateStream(id: string, clientActionId: string, expectedRevision: number, action: GenerationAction, csrfToken: string,
  onDelta: (delta: string) => void, signal?: AbortSignal, modelAccess?: TavernUserModelAccess,
  historyBytes?: 8192 | 16384 | 32768): Promise<CompletedTurn> {
  validateId(clientActionId);
  if (!nonNegativeInteger(expectedRevision)) throw new TavernApiError(409, 'tavern.turn_conflict', '会话版本已变化，请刷新后重试。');
  if (action.type === 'reply') validateMessage(action.message);
  else validateId(action.assistantMessageId);
  const response = await request(`${ROOT}/conversations/${pathId(id)}/turns`, {
    method: 'POST', headers: { ...mutationHeaders(csrfToken, true), Accept: 'text/event-stream' },
    body: JSON.stringify({ clientActionId, expectedRevision, action,
      ...(modelAccess ? { modelAccess, historyBytes } : {}) }), signal,
  });
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw invalidResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const consume = (frame: string): CompletedTurn | undefined => {
    let event = 'message';
    const lines: string[] = [];
    for (const line of frame.split(/\r\n|\r|\n/u)) {
      if (line.startsWith('event:')) event = line.slice(6).replace(/^ /u, '');
      if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /u, ''));
    }
    if (!lines.length || !['delta', 'completed', 'error'].includes(event)) return;
    let payload: unknown;
    try { payload = JSON.parse(lines.join('\n')) as unknown; } catch { throw invalidResponse(); }
    if (event === 'error') throw parseErrorBody(payload, 502);
    if (event === 'delta') {
      if (!isRecord(payload) || typeof payload.delta !== 'string') throw invalidResponse();
      onDelta(payload.delta);
      return;
    }
    if (!isRecord(payload) || !nonNegative(payload.creditBalance) || !nonNegative(payload.chargedCredits) || typeof payload.idempotencyHit !== 'boolean') throw invalidResponse();
    const turn = parseTurn(payload.turn);
    if (turn.clientTurnId !== clientActionId || (action.type === 'reply' && turn.userMessage !== action.message)) throw invalidResponse();
    return { turn, graph: parseGraph(payload.graph), creditBalance: payload.creditBalance,
      chargedCredits: payload.chargedCredits, idempotencyHit: payload.idempotencyHit };
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 2 * 1024 * 1024) throw invalidResponse();
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r\n\r\n|\n\n|\r\r/u.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const completed = consume(frame);
        if (completed) return completed;
      }
      if (done) {
        const completed = consume(buffer);
        if (completed) return completed;
        throw interrupted();
      }
    }
  } catch (error) {
    if (error instanceof TavernApiError || signal?.aborted) throw error;
    throw interrupted();
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

function mutationHeaders(csrfToken: string, json = false): Record<string, string> {
  if (!csrfToken) throw new TavernApiError(403, 'identity.csrf_missing', '登录状态已失效，请重新登录。');
  return { Accept: 'application/json', 'X-CSRF-Token': csrfToken, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}
function pathId(id: string): string { validateId(id); return encodeURIComponent(id); }
async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  return readJson(await request(path, { headers: { Accept: 'application/json' }, signal }));
}
async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: 'same-origin' }); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw new TavernApiError(0, 'tavern.network_unavailable', '酒馆服务暂时无法连接，请重试。');
  }
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* Never expose an HTML response or stack trace. */ }
    throw parseErrorBody(isRecord(body) ? body.error : undefined, response.status);
  }
  return response;
}
function parseErrorBody(body: unknown, status: number): TavernApiError {
  if (isRecord(body) && typeof body.code === 'string' && typeof body.message === 'string') {
    return new TavernApiError(typeof body.httpStatus === 'number' && body.httpStatus >= 400 && body.httpStatus <= 599 ? body.httpStatus : status,
      body.code, body.message, typeof body.traceId === 'string' ? body.traceId : undefined);
  }
  return new TavernApiError(status, 'tavern.request_failed', '酒馆请求失败，请稍后重试。');
}
async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; } catch { throw invalidResponse(); }
}
function parseList<T>(body: unknown, field: string, parse: (value: unknown) => T): T[] {
  if (!isRecord(body) || !Array.isArray(body[field])) throw invalidResponse();
  return (body[field] as unknown[]).map(parse);
}
function parseCharacter(value: unknown): Character {
  if (!isRecord(value) || !strings(value, ['characterId', 'normalizedHash', 'createdAt']) ||
    !nullableString(value.sourceHash) || !nullableString(value.avatarUrl) || !isCard(value.card)) throw invalidResponse();
  return value as unknown as Character;
}
function isCard(value: unknown): value is NormalizedCharacterCard {
  return isRecord(value) && value.schemaVersion === 1 && ['json', 'png'].includes(String(value.sourceFormat)) &&
    strings(value, ['name', 'description', 'personality', 'scenario', 'firstMessage', 'exampleDialogue', 'systemPrompt', 'postHistoryInstructions', 'creatorNotes']) &&
    textArray(value.alternateGreetings) && Array.isArray(value.warnings) && value.warnings.every(warning => isRecord(warning) && strings(warning, ['code', 'field', 'message'])) &&
    Array.isArray(value.lorebook) && value.lorebook.every(entry => isRecord(entry) && strings(entry, ['id', 'content']) &&
      textArray(entry.keys) && textArray(entry.secondaryKeys) && ['constant', 'enabled', 'selective'].every(field => typeof entry[field] === 'boolean') && Number.isSafeInteger(entry.priority) && Number.isSafeInteger(entry.order));
}
function parseConversation(value: unknown): Conversation {
  if (!isRecord(value) || !strings(value, ['conversationId', 'characterId', 'title', 'userName', 'openingMessage', 'createdAt']) || !nullableString(value.persona) ||
    !(value.vocabulary === null || (Array.isArray(value.vocabulary) && value.vocabulary.every(entry => isRecord(entry) && typeof entry.term === 'string' && (entry.meaning === undefined || entry.meaning === null || typeof entry.meaning === 'string')))) ||
    !isGenerationSettings(value.generationSettings) || !positiveInteger(value.generationSettingsVersion)) throw invalidResponse();
  return value as unknown as Conversation;
}
function parseGenerationSettingsState(value: unknown): GenerationSettingsState {
  if (!isRecord(value) || !isGenerationSettings(value.generationSettings) || !positiveInteger(value.generationSettingsVersion)) throw invalidResponse();
  return value as unknown as GenerationSettingsState;
}
function isGenerationSettings(value: unknown): value is GenerationSettings {
  return isRecord(value) && (value.temperature === undefined || (typeof value.temperature === 'number' && Number.isFinite(value.temperature) && value.temperature >= 0 && value.temperature <= 2)) &&
    typeof value.maxOutputTokens === 'number' && Number.isSafeInteger(value.maxOutputTokens) && value.maxOutputTokens >= 1 && value.maxOutputTokens <= 8192 &&
    Array.isArray(value.stopSequences) && value.stopSequences.length <= 4 && value.stopSequences.every(item => typeof item === 'string' && item.length > 0 && utf8Bytes(item) <= 1024);
}
function validateGenerationSettings(settings: GenerationSettings) {
  if (!isGenerationSettings(settings)) throw new TavernApiError(400, 'tavern.generation_settings_invalid', '生成参数无效或当前模型不支持该参数。');
}
function parseTurn(value: unknown): Turn {
  if (!isRecord(value) || !strings(value, ['turnId', 'clientTurnId', 'userMessage', 'assistantMessage', 'createdAt']) ||
    !nonNegativeInteger(value.chargedCreditUnits) || !isRecord(value.usage) ||
    !['inputTokens', 'outputTokens', 'cacheHitInputTokens', 'cacheMissInputTokens'].every(key => nonNegativeInteger((value.usage as Record<string, unknown>)[key]))) throw invalidResponse();
  return value as unknown as Turn;
}
function parseGeneration(value: unknown): GenerationRecord {
  if (!isRecord(value) || !strings(value, ['generationId', 'branchId', 'clientActionId', 'outputMessageId', 'promptFingerprint', 'modelId', 'createdAt']) ||
    !['reply', 'regenerate', 'continue', 'migration'].includes(String(value.intent)) || !nullableString(value.anchorMessageId) || !nullableString(value.inputMessageId) ||
    !/^[0-9a-f]{64}$/u.test(value.promptFingerprint as string) || !isGenerationSettings(value.settingsSnapshot) || !nonNegativeInteger(value.chargedCreditUnits) ||
    !isRecord(value.usage) || !['inputTokens', 'outputTokens', 'cacheHitInputTokens', 'cacheMissInputTokens'].every(key => nonNegativeInteger((value.usage as Record<string, unknown>)[key]))) throw invalidResponse();
  return value as unknown as GenerationRecord;
}
function parseGraph(value: unknown): ConversationGraph {
  if (!isRecord(value) || !nonNegativeInteger(value.revision) || typeof value.activeBranchId !== 'string' ||
    !textArray(value.activePath) || !Array.isArray(value.messages) || !Array.isArray(value.branches)) throw invalidResponse();
  const messages = value.messages;
  if (!messages.every(message => isRecord(message) && strings(message, ['messageId', 'role', 'origin', 'content']) &&
    nullableString(message.parentMessageId) && nullableString(message.characterId) &&
    ['user', 'assistant', 'system'].includes(message.role as string) &&
    ['opening', 'user', 'model', 'continue', 'edit', 'migration'].includes(message.origin as string))) throw invalidResponse();
  const branches = value.branches;
  if (!branches.every(branch => isRecord(branch) && strings(branch, ['branchId', 'name', 'kind']) &&
    nullableString(branch.leafMessageId) && ['main', 'branch', 'checkpoint'].includes(branch.kind as string))) throw invalidResponse();
  const ids = new Set(messages.map(message => message.messageId));
  if (!value.activePath.every(id => ids.has(id)) || !branches.some(branch => branch.branchId === value.activeBranchId)) throw invalidResponse();
  return value as unknown as ConversationGraph;
}
function strings(record: Record<string, unknown>, keys: string[]) { return keys.every(key => typeof record[key] === 'string'); }
function nullableString(value: unknown) { return value === null || typeof value === 'string'; }
function textArray(value: unknown) { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function nonNegative(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function nonNegativeInteger(value: unknown): value is number { return nonNegative(value) && Number.isSafeInteger(value); }
function positiveInteger(value: unknown): value is number { return nonNegativeInteger(value) && value > 0; }
function invalidResponse() { return new TavernApiError(502, 'tavern.invalid_response', '酒馆服务返回了无法识别的结果。'); }
function interrupted() { return new TavernApiError(0, 'tavern.stream_interrupted', '连接中断，尚未确认保存。请重试同一条消息以核对结果。'); }
