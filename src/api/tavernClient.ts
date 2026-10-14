import { request as apiFetch } from './http';
import { publicHttpErrorMessage } from '../lib/publicErrors';
import {parseAgentCompletion} from './agentExecutionClient';
import { prepareConversationInput, validateId, validateMessage } from '../domains/conversations/conversationInput';
import { TavernApiError, type Character, type CompletedTurn, type Conversation, type ConversationDetail, type ConversationGraph, type CreateConversationInput, type GenerationAction, type GenerationRecord, type GenerationSettings, type GenerationSettingsState, type GraphMutation, type NormalizedCharacterCard, type TavernUserModelAccess, type Turn } from '../domains/conversations/types';
import { isRecord, NORMALIZED_CARD_BYTES, RAW_FILE_BYTES, tooLarge, utf8Bytes } from '../domains/conversations/validation';
import type {CashCharge,CashQuote} from '../domains/conversations/types';

const ROOT = '/api/me/tavern';
export async function openManagementConversation(input: import('../domains/conversations/types').OpenManagementConversationInput, csrfToken: string, signal?: AbortSignal): Promise<ConversationDetail> {
  const detail = parseConversationDetail(await readJson(await request(`${ROOT}/management-conversations`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: JSON.stringify(input), signal,
  })));
  if (detail.conversation.scene !== 'management' || detail.conversation.learningAreaId || detail.conversation.libraryEntryId) throw invalidResponse();
  return detail;
}
export async function fetchLearningAreas(signal?: AbortSignal): Promise<import('../domains/conversations/types').LearningArea[]> {
  return parseList(await getJson('/api/me/learning-areas', signal), 'areas', parseLearningArea);
}
export async function createLearningArea(libraryEntryId: string, csrfToken: string): Promise<import('../domains/conversations/types').LearningArea> {
  return parseLearningArea(await readJson(await request(`/api/me/learning-areas/${pathId(libraryEntryId)}`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: JSON.stringify({}),
  })));
}
export async function fetchLearningAreaConversations(areaId: string, signal?: AbortSignal): Promise<Conversation[]> {
  const conversations = parseList(await getJson(`/api/me/learning-areas/${pathId(areaId)}/conversations`, signal), 'conversations', parseConversation);
  if (conversations.some(item => item.scene !== 'learning' || item.learningAreaId !== areaId)) throw invalidResponse();
  return conversations;
}
export async function createLearningConversation(areaId: string, input: import('../domains/conversations/types').CreateLearningConversationInput, csrfToken: string): Promise<ConversationDetail> {
  const detail = parseConversationDetail(await readJson(await request(`/api/me/learning-areas/${pathId(areaId)}/conversations`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: JSON.stringify(input),
  })));
  if (detail.conversation.scene !== 'learning' || detail.conversation.learningAreaId !== areaId) throw invalidResponse();
  return detail;
}
function parseLearningArea(value: unknown): import('../domains/conversations/types').LearningArea {
  if (!isRecord(value) || typeof value.areaId !== 'string' || !value.areaId.trim()
    || value.libraryEntryId !== value.areaId || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.available !== 'boolean' || typeof value.createdAt !== 'string'
    || !Number.isFinite(Date.parse(value.createdAt))) throw invalidResponse();
  return value as unknown as import('../domains/conversations/types').LearningArea;
}
export async function fetchTeachingCanvas(id: string, signal?: AbortSignal) {
  return parseTeachingCanvas(await getJson(`${ROOT}/conversations/${pathId(id)}/canvas`, signal));
}
export async function saveTeachingCanvas(id: string, state: import('../domains/conversations/types').TeachingCanvasState, csrfToken: string, elements?: Record<string, unknown>[]) {
  return parseTeachingCanvas(await readJson(await request(`${ROOT}/conversations/${pathId(id)}/canvas`, {
    method: 'PATCH', headers: mutationHeaders(csrfToken, true),
    body: JSON.stringify({ expectedRevision: state.revision, enabled: state.enabled, ...(elements ? { elements } : {}) }),
  })));
}
export function parseTeachingCanvas(value: unknown): import('../domains/conversations/types').TeachingCanvasState {
  if (!isRecord(value) || !nonNegativeInteger(value.revision) || typeof value.enabled !== 'boolean'
    || !Array.isArray(value.elements) || !value.elements.every(isRecord)) throw invalidResponse();
  return value as unknown as import('../domains/conversations/types').TeachingCanvasState;
}
export async function testModelConnection(apiKey: string, baseUrl: string, csrfToken: string, signal?: AbortSignal): Promise<{ ok: boolean; models: string[]; message: string }> {
  const result = await readJson(await request(`${ROOT}/model-access/test`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), credentials: 'same-origin',
    body: JSON.stringify({ apiKey, baseUrl }), signal,
  }));
  if (!isRecord(result) || typeof result.ok !== 'boolean' || typeof result.message !== 'string'
    || !Array.isArray(result.models) || result.models.length > 1000
    || !result.models.every(model => typeof model === 'string' && model.trim() && model.length <= 256)) throw invalidResponse();
  return {
    ok: result.ok, models: result.models as string[],
    message: result.ok ? '连接与 Key 验证成功，已获取模型列表；具体模型是否支持聊天以实际调用为准。'
      : publicHttpErrorMessage(typeof result.code === 'string' ? result.code : 'model_access.connection_failed', 400),
  };
}
export async function fetchPlatformModels(signal?: AbortSignal): Promise<{ enabled: boolean; billingMode: 'trial'|'wallet'; policyVersion?:string; models: { id: string; provider: string; contextWindow: number }[] }> {
  const body = await getJson(`${ROOT}/platform-models`, signal);
  if (!isRecord(body) || typeof body.enabled !== 'boolean' || !['trial','wallet'].includes(String(body.billingMode)) || !Array.isArray(body.models)
    || (body.billingMode==='wallet' && body.policyVersion!=='cash-v1-actual-x2')) throw invalidResponse();
  const models = body.models.map(model => {
    if (!isRecord(model) || typeof model.id !== 'string' || !model.id.trim() || typeof model.provider !== 'string' || !positiveInteger(model.contextWindow)) throw invalidResponse();
    return { id: model.id, provider: model.provider, contextWindow: model.contextWindow };
  });
  return { enabled: body.enabled, billingMode: body.billingMode as 'trial'|'wallet', ...(body.billingMode==='wallet'?{policyVersion:'cash-v1-actual-x2'}:{}),models };
}
export async function requestCashQuote(id:string,expectedRevision:number,action:GenerationAction,platformModel:string,historyBytes:number,csrfToken:string,signal?:AbortSignal):Promise<CashQuote> {
  const quote=await readJson(await request(`${ROOT}/conversations/${pathId(id)}/quote`,{method:'POST',headers:mutationHeaders(csrfToken,true),body:JSON.stringify({expectedRevision,action,platformModel,historyBytes}),signal}));
  if (!isRecord(quote) || typeof quote.quoteId!=='string' || !quote.quoteId || !nonNegativeInteger(quote.maximumChargeMicros)
      || quote.policyVersion!=='cash-v1-actual-x2' || !positiveInteger(quote.expiresInSeconds) || quote.expiresInSeconds>60) throw invalidResponse();
  return quote as unknown as CashQuote;
}
function parseCashCharge(value:unknown):CashCharge {
  if (!isRecord(value) || typeof value.generationId!=='string' || typeof value.outputMessageId!=='string'
      || !nonNegativeInteger(value.amountMicros) || !Number.isSafeInteger(value.balanceAfterMicros)
      || typeof value.capped!=='boolean' || typeof value.createdAt!=='string' || !Number.isFinite(Date.parse(value.createdAt))) throw invalidResponse();
  return value as unknown as CashCharge;
}
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
export async function updateCharacter(id: string, expectedHash: string, card: NormalizedCharacterCard, csrfToken: string,
  conversation?: { conversationId: string; expectedRevision: number }): Promise<{ character: Character; conversation: ConversationDetail | null }> {
  const body = await readJson(await request(`${ROOT}/characters/${pathId(id)}`, { method: 'PATCH',
    headers: mutationHeaders(csrfToken, true), body: JSON.stringify({ expectedHash, card, ...(conversation ? { conversation } : {}) }) }));
  if (!isRecord(body)) throw invalidResponse();
  return { character: parseCharacter(body.character), conversation: body.conversation === null ? null : parseConversationDetail(body.conversation) };
}
export async function createConversation(input: CreateConversationInput, csrfToken: string): Promise<Conversation> {
  return parseConversation(await readJson(await request(`${ROOT}/conversations`, { method: 'POST',
    headers: mutationHeaders(csrfToken, true), body: JSON.stringify(prepareConversationInput(input)) })));
}
export async function fetchConversations(signal?: AbortSignal, scene: import('../domains/conversations/types').ConversationScene = 'tavern'): Promise<Conversation[]> {
  return parseList(await getJson(`${ROOT}/conversations${scene === 'tavern' ? '' : `?scene=${scene}`}`, signal), 'conversations', parseConversation);
}
export async function fetchConversationHistory(signal?: AbortSignal, scene: import('../domains/conversations/types').ConversationScene = 'tavern', areaId?: string): Promise<import('../domains/conversations/types').ConversationHistory> {
  const path = areaId ? `/api/me/learning-areas/${pathId(areaId)}/conversations`
    : `${ROOT}/conversations${scene === 'tavern' ? '' : `?scene=${scene}`}`;
  const body = await getJson(path, signal);
  const conversations = parseList(body, 'conversations', parseConversation);
  if (areaId && conversations.some(item => item.scene !== 'learning' || item.learningAreaId !== areaId)) throw invalidResponse();
  if (!isRecord(body)) throw invalidResponse();
  // Older servers cannot delete conversations; retain their first-entry behavior during upgrade.
  const state = body.bootstrapState ?? (conversations.length ? 'has_active' : 'never_created');
  if (state !== 'never_created' && state !== 'has_active' && state !== 'cleared') throw invalidResponse();
  if ((state === 'has_active') !== (conversations.length > 0)) throw invalidResponse();
  return { conversations, bootstrapState: state };
}
export async function deleteConversation(id: string, csrfToken: string): Promise<void> {
  await request(`${ROOT}/conversations/${pathId(id)}`, { method: 'DELETE', headers: mutationHeaders(csrfToken) });
}
export async function fetchConversation(id: string, signal?: AbortSignal): Promise<ConversationDetail> {
  const body = await getJson(`${ROOT}/conversations/${pathId(id)}`, signal);
  return parseConversationDetail(body);
}
export async function updateTreeConnection(id: string, expectedRevision: number, libraryEntryId: string | null, toolsEnabled: boolean, csrfToken: string): Promise<ConversationDetail> {
  return parseConversationDetail(await readJson(await request(`${ROOT}/conversations/${pathId(id)}/tree-connection`, {
    method: 'PATCH', headers: mutationHeaders(csrfToken, true),
    body: JSON.stringify({ expectedRevision, libraryEntryId, toolsEnabled }),
  })));
}
export async function openTreeConversation(libraryEntryId: string, csrfToken: string, signal?: AbortSignal): Promise<ConversationDetail> {
  return parseConversationDetail(await readJson(await request(`${ROOT}/tree-conversations/${pathId(libraryEntryId)}`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: '{}', signal,
  })));
}
export async function resolveTavernToolApproval(conversation: string, approvalId: string, allowed: boolean, destructiveConfirmed: boolean, csrfToken: string): Promise<void> {
  await request(`${ROOT}/conversations/${pathId(conversation)}/tool-approvals/${pathId(approvalId)}`, {
    method: 'POST', headers: mutationHeaders(csrfToken, true), body: JSON.stringify({ allowed, destructiveConfirmed }),
  });
}
export async function switchConversationCharacter(conversation: string, expectedRevision: number, characterId: string, csrfToken: string): Promise<ConversationDetail> {
  return parseConversationDetail(await readJson(await request(`${ROOT}/conversations/${pathId(conversation)}/character`, {
    method: 'PATCH', headers: mutationHeaders(csrfToken, true), body: JSON.stringify({ expectedRevision, characterId }),
  })));
}
export async function updateConversationProfile(id: string, expectedRevision: number, input: CreateConversationInput, csrfToken: string): Promise<ConversationDetail> {
  const { userName, persona, vocabulary, greetingIndex } = prepareConversationInput(input);
  if (!nonNegativeInteger(expectedRevision)) throw new TavernApiError(409, 'tavern.turn_conflict', '请刷新会话后重试。');
  return parseConversationDetail(await readJson(await request(`${ROOT}/conversations/${pathId(id)}/profile`, {
    method: 'PATCH', headers: mutationHeaders(csrfToken, true),
    body: JSON.stringify({ expectedRevision, userName, persona: persona ?? '', vocabulary: vocabulary ?? [], ...(greetingIndex === undefined ? {} : { greetingIndex }) }),
  })));
}
function parseConversationDetail(body: unknown): ConversationDetail {
  if (!isRecord(body)) throw invalidResponse();
  const conversation=parseConversation(body.conversation),graph=parseGraph(body.graph);
  const agentResults=body.agentResults===undefined?undefined:parseList(body,'agentResults',value=>parseAgentCompletion(value,conversation.conversationId));
  if(agentResults&&(new Set(agentResults.map(result=>result.executionId)).size!==agentResults.length
    ||agentResults.some(result=>!graph.messages.some(message=>message.messageId===result.messageId&&message.role==='assistant'))))throw invalidResponse();
  return { conversation, character: parseCharacter(body.character),...(agentResults===undefined?{}:{agentResults}),
    ...(body.roleChanges === undefined ? {} : { roleChanges: parseList(body, 'roleChanges', parseRoleChange) }),
    ...(Array.isArray(body.diagnostics)?{diagnostics:body.diagnostics.filter((record):record is {actionId:string;payload:Record<string,unknown>}=>isRecord(record)&&typeof record.actionId==='string'&&isRecord(record.payload))}:{}),
    ...(body.canvas === undefined ? {} : { canvas: parseTeachingCanvas(body.canvas) }),
    turns: parseList(body, 'turns', parseTurn), generations: parseList(body, 'generations', parseGeneration), graph,
    ...(body.cashCharges===undefined?{}:{cashCharges:parseList(body,'cashCharges',parseCashCharge)}) };
}
function parseRoleChange(value: unknown): import('../domains/conversations/types').RoleChange {
  if (!isRecord(value) || !strings(value, ['changeId', 'characterId', 'characterName', 'createdAt'])
    || (value.afterMessageId !== null && typeof value.afterMessageId !== 'string')) throw invalidResponse();
  if ((value.previousCharacterId != null || value.previousCharacterName != null)
    && (typeof value.previousCharacterId !== 'string' || !value.previousCharacterId.trim()
      || typeof value.previousCharacterName !== 'string' || !value.previousCharacterName.trim())) throw invalidResponse();
  return value as unknown as import('../domains/conversations/types').RoleChange;
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
  historyBytes?: 8192 | 16384 | 32768, platformModel?: string,billing?:{quoteId?:string;policyVersion:string},
  onApproval?: (approval: import('../domains/conversations/types').TavernToolApproval) => Promise<void>,
  onProcess?: (event: import('../domains/conversations/types').TavernLiveProcessEvent) => void): Promise<CompletedTurn> {
  if (modelAccess && platformModel) throw new TavernApiError(400, 'tavern.model_access_invalid', '请选择一种模型线路。');
  validateId(clientActionId);
  if (!nonNegativeInteger(expectedRevision)) throw new TavernApiError(409, 'tavern.turn_conflict', '会话版本已变化，请刷新后重试。');
  if (action.type === 'reply') validateMessage(action.message);
  else validateId(action.assistantMessageId);
  const response = await request(`${ROOT}/conversations/${pathId(id)}/turns`, {
    method: 'POST', headers: { ...mutationHeaders(csrfToken, true), Accept: 'text/event-stream' },
    body: JSON.stringify({ clientActionId, expectedRevision, action,
      ...(modelAccess ? { modelAccess, historyBytes } : platformModel ? { platformModel, historyBytes,...(billing?{billingPolicy:billing.policyVersion,quoteId:billing.quoteId}:{}) } : {}) }), signal,
  });
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw invalidResponse();
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel(); };
  signal?.addEventListener('abort', abort, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  const consume = async (frame: string): Promise<CompletedTurn | undefined> => {
    let event = 'message';
    const lines: string[] = [];
    for (const line of frame.split(/\r\n|\r|\n/u)) {
      if (line.startsWith('event:')) event = line.slice(6).replace(/^ /u, '');
      if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /u, ''));
    }
    if (!lines.length || !['delta', 'completed', 'error', 'approval_required', 'started', 'process', 'process_snapshot'].includes(event)) return;
    let payload: unknown;
    try { payload = JSON.parse(lines.join('\n')) as unknown; } catch { throw invalidResponse(); }
    if (event === 'error') throw parseErrorBody(payload, 502, true);
    if (event === 'started') { onProcess?.({ type: 'status', state: 'generating' }); return; }
    if (event === 'process_snapshot') {
      if (!isRecord(payload)) throw invalidResponse();
      onProcess?.({ type: 'snapshot', process: parseProcess(payload.process) }); return;
    }
    if (event === 'process') {
      if (isRecord(payload) && payload.type === 'canvas') onProcess?.({ type: 'canvas', canvas: parseTeachingCanvas(payload.canvas) });
      else onProcess?.(parseProcessEvent(payload));
      return;
    }
    if (event === 'approval_required') {
      if (!isRecord(payload) || !isRecord(payload.approval)) throw invalidResponse();
      const approval=payload.approval;
      if (!strings(approval,['approvalRequestId','action','target']) || typeof approval.destructive !== 'boolean') throw invalidResponse();
      if (approval.mapTitle !== undefined && typeof approval.mapTitle !== 'string') throw invalidResponse();
      if (approval.proposal !== undefined && !isRecord(approval.proposal)) throw invalidResponse();
      if (onApproval) await onApproval(approval as unknown as import('../domains/conversations/types').TavernToolApproval);
      else await resolveTavernToolApproval(id, approval.approvalRequestId as string, false, false, csrfToken);
      return;
    }
    if (event === 'delta') {
      if (!isRecord(payload) || typeof payload.delta !== 'string') throw invalidResponse();
      onDelta(payload.delta);
      return;
    }
    if (!isRecord(payload) || !nonNegative(payload.creditBalance) || !nonNegative(payload.chargedCredits) || typeof payload.idempotencyHit !== 'boolean') throw invalidResponse();
    const turn = parseTurn(payload.turn);
    const cashCharge=payload.cashCharge===undefined?undefined:parseCashCharge(payload.cashCharge);
    if (cashCharge && (cashCharge.generationId!==turn.turnId || !Number.isSafeInteger(payload.walletBalanceMicros))) throw invalidResponse();
    if (turn.clientTurnId !== clientActionId || (action.type === 'reply' && turn.userMessage !== action.message)) throw invalidResponse();
    return { turn, graph: parseGraph(payload.graph), creditBalance: payload.creditBalance,
      ...(payload.generation === undefined ? {} : { generation: parseGeneration(payload.generation) }),
      ...(payload.process === undefined ? {} : { process: parseProcess(payload.process) }),
      ...(payload.canvas === undefined ? {} : { canvas: parseTeachingCanvas(payload.canvas) }),
      chargedCredits: payload.chargedCredits, idempotencyHit: payload.idempotencyHit,
      ...(cashCharge?{cashCharge,walletBalanceMicros:payload.walletBalanceMicros as number}:{}) };
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
        const completed = await consume(frame);
        if (completed) return completed;
      }
      if (done) {
        const completed = await consume(buffer);
        if (completed) return completed;
        throw interrupted();
      }
    }
  } catch (error) {
    if (error instanceof TavernApiError || signal?.aborted) throw error;
    throw interrupted();
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

function mutationHeaders(csrfToken: string, json = false): Record<string, string> {
  if (!csrfToken) throw new TavernApiError(403, 'identity.csrf_missing', '登录状态已失效，请重新登录。');
  return { Accept: 'application/json', 'X-CSRF-Token': csrfToken, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}
function pathId(id: string): string { validateId(id); return encodeURIComponent(id); }
async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  return readJson(await request(path, { headers: { Accept: 'application/json' }, signal }));
}
const conversationWrites = new Map<string, { count: number; deleting: boolean }>();
function beginConversationRequest(path: string, init: RequestInit): (() => void) | undefined {
  if (!init.method || init.method === 'GET') return;
  const match = path.match(/^\/api\/me\/tavern\/conversations\/([^/?]+)(?:\/|$)/);
  let conversationId = match ? decodeURIComponent(match[1]) : undefined;
  if (!conversationId && path.startsWith(`${ROOT}/characters/`) && init.method === 'PATCH' && typeof init.body === 'string') {
    const body = JSON.parse(init.body);
    if (isRecord(body) && isRecord(body.conversation) && typeof body.conversation.conversationId === 'string') conversationId = body.conversation.conversationId;
  }
  if (!conversationId) return;
  const id = conversationId;
  const current = conversationWrites.get(id);
  if (current?.deleting || (init.method === 'DELETE' && current?.count)) {
    throw new TavernApiError(409, 'tavern.conversation_busy', '会话正在处理或保存，请完成后再删除。');
  }
  conversationWrites.set(id, { count: (current?.count ?? 0) + 1, deleting: init.method === 'DELETE' });
  return () => {
    const active = conversationWrites.get(id);
    if (active && active.count > 1) conversationWrites.set(id, { ...active, count: active.count - 1 });
    else conversationWrites.delete(id);
  };
}
async function request(path: string, init: RequestInit): Promise<Response> {
  const finish = beginConversationRequest(path, init);
  try { return await performRequest(path, init); }
  finally { finish?.(); }
}
async function performRequest(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await apiFetch(path, { ...init, credentials: 'same-origin' }); }
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
function parseErrorBody(body: unknown, status: number, generationFailed = false): TavernApiError {
  if (isRecord(body) && typeof body.code === 'string' && typeof body.message === 'string') {
    const httpStatus = typeof body.httpStatus === 'number' && body.httpStatus >= 400 && body.httpStatus <= 599 ? body.httpStatus : status;
    return new TavernApiError(httpStatus,
      body.code, publicHttpErrorMessage(body.code, httpStatus), typeof body.traceId === 'string' ? body.traceId : undefined,
      generationFailed && !['tavern.turn_conflict', 'tavern.persistence_failed'].includes(body.code));
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
    !(value.libraryEntryId === undefined || nullableString(value.libraryEntryId)) ||
    !(value.treeToolsEnabled === undefined || typeof value.treeToolsEnabled === 'boolean') ||
    !(value.vocabulary === null || (Array.isArray(value.vocabulary) && value.vocabulary.every(entry => isRecord(entry) && typeof entry.term === 'string' && (entry.meaning === undefined || entry.meaning === null || typeof entry.meaning === 'string')))) ||
    !isGenerationSettings(value.generationSettings) || !positiveInteger(value.generationSettingsVersion)) throw invalidResponse();
  if (value.scene === undefined) {
    if (value.learningAreaId !== undefined) throw invalidResponse();
  } else if (!['tavern', 'learning', 'management'].includes(String(value.scene))
    || (value.scene === 'learning'
      ? typeof value.learningAreaId !== 'string' || !value.learningAreaId.trim()
        || (value.libraryEntryId != null && value.libraryEntryId !== value.learningAreaId)
      : value.learningAreaId !== null || value.libraryEntryId != null || value.treeToolsEnabled === true)) throw invalidResponse();
  return value as unknown as Conversation;
}
function parseGenerationSettingsState(value: unknown): GenerationSettingsState {
  if (!isRecord(value) || !isGenerationSettings(value.generationSettings) || !positiveInteger(value.generationSettingsVersion)) throw invalidResponse();
  return value as unknown as GenerationSettingsState;
}
function isGenerationSettings(value: unknown): value is GenerationSettings {
  return isRecord(value) && (value.temperature === undefined || (typeof value.temperature === 'number' && Number.isFinite(value.temperature) && value.temperature >= 0 && value.temperature <= 2)) &&
    (value.maxOutputTokens === null || (typeof value.maxOutputTokens === 'number' && Number.isSafeInteger(value.maxOutputTokens) && value.maxOutputTokens >= 1 && value.maxOutputTokens <= 4294967295)) &&
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
  return { ...value, ...(value.process === undefined ? {} : { process: parseProcess(value.process) }) } as unknown as GenerationRecord;
}
function parseProcessEvent(value: unknown): import('../domains/conversations/types').GenerationProcessEvent {
  if (!isRecord(value)) throw invalidResponse();
  if (value.type === 'reasoning' && typeof value.text === 'string' && utf8Bytes(value.text) <= 1_048_576) return { type: 'reasoning', text: value.text };
  if (value.type === 'tool' && typeof value.name === 'string' && value.name.length <= 100 && ['started', 'completed', 'failed'].includes(String(value.state))) return value as unknown as import('../domains/conversations/types').GenerationProcessEvent;
  throw invalidResponse();
}
function parseProcess(value: unknown): import('../domains/conversations/types').GenerationProcessEvent[] {
  if (!Array.isArray(value) || value.length > 128) throw invalidResponse();
  return value.map(parseProcessEvent);
}
function parseGraph(value: unknown): ConversationGraph {
  if (!isRecord(value) || !nonNegativeInteger(value.revision) || typeof value.activeBranchId !== 'string' ||
    !textArray(value.activePath) || !Array.isArray(value.messages) || !Array.isArray(value.branches)) throw invalidResponse();
  const messages = value.messages;
  if (!messages.every(message => isRecord(message) && strings(message, ['messageId', 'role', 'origin', 'content']) &&
    nullableString(message.parentMessageId) && nullableString(message.characterId) &&
    (message.characterName === undefined || nullableString(message.characterName)) &&
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
