import { request, readFailure } from './http';
import { PublicUiError, publicHttpErrorMessage } from '../lib/publicErrors';
import type { Accepted, TaskPublic, Translation, RestoreResult, ReviewItem, ReviewResult, WorldList, WorldDetail, PlaythroughPublic, HistoryPage, Checkpoints, Debrief, WordList, WordDetail, DueList, WordFilter, Utterance } from '../domains/englishWorld/types';

export interface WorldMutationResponses {
  accepted: Accepted; task: TaskPublic; translation: Translation; restore: RestoreResult; reviewItem: ReviewItem; reviewResult: ReviewResult;
}
export type WorldResponseKind = keyof WorldMutationResponses;
export class EnglishWorldApiError extends PublicUiError {
  constructor(readonly code: string, readonly status: number) { super(englishWorldErrorMessage(code, status)); }
}
export function englishWorldErrorMessage(code: string, status = 400): string {
  const messages: Record<string, string> = {
    'english_world.not_found': '内容不存在或当前账号无法访问。',
    'english_world.disabled': '英语世界暂未开放，请稍后再来。',
    'english_world.invalid_request': '请检查填写的内容后重试。',
    'english_world.operation_conflict': '原请求内容不一致，请核对已保存的结果。',
    'english_world.revision_conflict': '本局已有更新，请重新读取；你的草稿已保留。',
    'english_world.task_pending': '原任务尚未结束，请先核对或停止原任务。',
    'english_world.translation_used': '本段已选择过一个词，请查看原来的翻译。',
    'english_world.review_item_consumed': '这道题已提交，请读取原来的结果。',
    'english_world.review_item_expired': '这道题已过期，请返回待复习列表重新开始。',
    'english_world.review_revision_conflict': '复习记录已更新，请返回列表重新开始。',
    'cash_non_positive': '现金额度不足，请查看额度或选择其他资金通路。',
    'agent_model.not_selectable': '所选模型暂不可用，请重新选择后再发起新请求。',
    'credential_required': '请补回原模型的 API Key，再恢复原任务。',
    'external_outcome_unknown': '原调用结果尚未确认，请核对原任务，避免重复调用。',
  };
  return messages[code] ?? publicHttpErrorMessage(code, status);
}

type Validator = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text: Validator = value => typeof value === 'string';
const uuid: Validator = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
const natural: Validator = value => Number.isSafeInteger(value) && Number(value) >= 0;
const positive: Validator = value => natural(value) && Number(value) > 0;
const bool: Validator = value => typeof value === 'boolean';
const timestamp: Validator = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const version: Validator = value => value === 1;
const choice = (...values: unknown[]): Validator => value => values.includes(value);
const nullable = (validate: Validator): Validator => value => value === null || validate(value);
const optional = (validate: Validator): Validator => value => value === undefined || validate(value);
const array = (validate: Validator): Validator => value => Array.isArray(value) && value.every(validate);
const shape = (fields: Record<string, Validator>): Validator => value => record(value)
  && Object.keys(value).every(key => Object.prototype.hasOwnProperty.call(fields, key))
  && Object.entries(fields).every(([key, validate]) => validate(value[key]));
const branchStatus = choice('active', 'dead', 'completed', 'abandoned');
const translationStatus = choice('reserved', 'ready', 'failed', 'outcome_unknown');
const modality = choice('reading', 'writing');
const accepted = shape({ operationId: uuid, taskId: nullable(uuid), worldId: optional(uuid), worldVersionId: optional(uuid), playthroughId: optional(uuid), branchId: optional(uuid), turnId: optional(uuid), translationUseId: optional(uuid) });
const resultRef = shape({ kind: choice('world_version', 'turn', 'translation', 'debrief'), worldId: optional(uuid), worldVersionId: optional(uuid), playthroughId: optional(uuid), branchId: optional(uuid), turnId: optional(uuid), translationUseId: optional(uuid) });
const task = shape({ schemaVersion: version, taskId: uuid, stage: text, state: choice('queued', 'running', 'validating', 'completed', 'blocked', 'failed', 'stopped'), progress: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, sequence: natural,
  allowedActions: shape({ canCheck: bool, canStop: bool, canResume: bool, needsCredential: bool }), publicResultRef: nullable(resultRef), publicError: nullable(shape({ code: text, message: text })),
  settlement: nullable(shape({ status: text, cashMicros: nullable(natural), pointUnits: nullable(natural), balanceMicros: nullable(value => Number.isSafeInteger(value)) })) });
const worldSummary = shape({ worldId: uuid, title: text, summary: text, difficulty: choice('beginner', 'intermediate', 'advanced'), status: choice('preparing', 'ready', 'failed', 'archived'), currentVersionId: nullable(uuid), activeTaskId: nullable(uuid), createdAt: timestamp });
const playSummary = shape({ playthroughId: uuid, worldId: uuid, worldTitle: text, branchId: uuid, branchStatus, location: text, updatedAt: timestamp });
const worldList = shape({ schemaVersion: version, worlds: array(worldSummary), recentPlaythroughs: array(playSummary), reviewCount: natural });
const worldDetail = shape({ schemaVersion: version, world: worldSummary, versions: array(shape({ worldVersionId: uuid, versionNo: positive, status: text })), playthroughs: array(playSummary), allowedActions: shape({ canStart: bool, canGenerateVersion: bool }) });
const publicState = shape({ location: shape({ id: text, name: text, description: text }), worldTime: text, goal: text, characters: array(shape({ id: text, name: text, description: text })), clues: array(shape({ id: text, text })), inventory: array(shape({ id: text, name: text })) });
const playthrough = shape({ schemaVersion: version, playthroughId: uuid, worldId: uuid, worldTitle: text, worldVersionId: uuid, activeBranchId: uuid, viewedBranchId: uuid, revision: natural, branchStatus, publicState, activeTaskId: nullable(uuid), debriefTaskId: nullable(uuid), allowedActions: shape({ canAct: bool, canRestore: bool, canReadDebrief: bool }) });
const token = shape({ tokenId: text, text, start: natural, end: natural, canTranslate: bool });
const utteranceFields = shape({ utteranceId: uuid, turnId: uuid, sequence: natural, ordinal: natural, speakerKind: choice('narrator', 'npc'), actorKey: nullable(text), speakerName: text, textEn: text, tokens: array(token), translationUse: nullable(shape({ selectedTokenId: text, status: translationStatus, glossZh: nullable(text) })) });
const utterance: Validator = value => {
  if (!utteranceFields(value)) return false;
  const sentence = value as Utterance;
  const points = Array.from(sentence.textEn);
  let end = 0;
  const identities = new Set<string>();
  for (const word of sentence.tokens) {
    if (word.start < end || word.end <= word.start || word.end > points.length || identities.has(word.tokenId)
      || points.slice(word.start, word.end).join('') !== word.text || sentence.speakerKind !== 'npc' && word.canTranslate) return false;
    identities.add(word.tokenId); end = word.end;
  }
  return !sentence.translationUse || identities.has(sentence.translationUse.selectedTokenId);
};
const history = shape({ schemaVersion: version, utterances: array(utterance), nextCursor: nullable(text) });
const checkpoints = shape({ schemaVersion: version, checkpoints: array(shape({ checkpointId: uuid, branchId: uuid, sequence: natural, location: text, worldTime: text, summary: text, createdAt: timestamp })) });
const translation = shape({ schemaVersion: version, translationUseId: uuid, selectedTokenId: text, status: translationStatus, glossZh: nullable(text), taskId: nullable(uuid) });
const restore = shape({ schemaVersion: version, operationId: uuid, branchId: uuid, revision: natural });
const debrief = shape({ schemaVersion: version, status: choice('pending', 'ready'), taskId: nullable(uuid), deathReason: nullable(text), lastNpcText: nullable(text), lastNpcTranslation: nullable(text), playerText: nullable(text), playerMeaning: nullable(text), explanation: nullable(text), category: nullable(choice('language', 'world_rule', 'dangerous_choice', 'mixed')) });
const word = shape({ learnerWordId: uuid, lemma: text, senseId: nullable(text), glossZh: nullable(text), meaningStatus: choice('unresolved', 'resolved'), firstSeenAt: timestamp, lastSeenAt: timestamp, exposureCount: natural, lookupCount: natural, dueAt: nullable(timestamp), source: nullable(shape({ worldId: uuid, playthroughId: uuid, branchId: uuid, utteranceId: nullable(uuid), textEn: text, speakerName: text })) });
const words = shape({ schemaVersion: version, words: array(word), total: natural, nextCursor: nullable(text) });
const wordDetail = shape({ schemaVersion: version, word, occurrences: array(shape({ occurrenceId: uuid, textEn: text, senseId: nullable(text), assignmentRevision: natural })) });
const reviewTarget: Validator = value => record(value) && (value.modality === 'reading' ? text(value.lemma) : value.modality === 'writing' && value.lemma === null);
const dueItem = shape({ learnerWordId: uuid, lemma: nullable(text), modality, dueAt: timestamp, revision: natural });
const due = shape({ schemaVersion: version, items: array(value => dueItem(value) && reviewTarget(value)), dueCount: natural });
const reviewItemFields = shape({ schemaVersion: version, reviewItemId: uuid, learnerWordId: uuid, lemma: nullable(text), modality, prompt: text, expiresAt: timestamp });
const reviewItem: Validator = value => reviewItemFields(value) && reviewTarget(value);
const reviewResult = shape({ schemaVersion: version, reviewItemId: uuid, rating: choice(1, 2, 3, 4), glossZh: nullable(text), dueAt: timestamp, counted: bool });
const mutationSchemas: Record<WorldResponseKind, Validator> = { accepted, task, translation, restore, reviewItem, reviewResult };
export function parseWorldMutationResult<K extends WorldResponseKind>(kind: K, value: unknown): WorldMutationResponses[K] {
  if (!mutationSchemas[kind](value)) invalid(); return value as WorldMutationResponses[K];
}
const root = '/api/me/english-world';
function invalid(): never { throw new PublicUiError('英语世界响应无效，请重新读取。'); }
function pathId(id: string): string { if (!uuid(id)) invalid(); return encodeURIComponent(id); }
function query(values: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') search.set(key, value);
  return search.size ? '?' + search.toString() : '';
}
async function read<T>(path: string, validate: Validator, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await request(root + path, { cache: 'no-store', ...options }); }
  catch (failure) { if (failure instanceof DOMException && failure.name === 'AbortError') throw failure; throw new PublicUiError('连接暂时中断，请核对原请求后重试。'); }
  if (!response.ok) { const failure = await readFailure(response); throw new EnglishWorldApiError(failure.code, failure.status); }
  let body: unknown;
  try { body = await response.json(); } catch { invalid(); }
  if (!validate(body)) invalid();
  return body as T;
}
export function fetchWorlds(signal?: AbortSignal) { return read<WorldList>('/worlds', worldList, { signal }); }
export async function fetchWorldDetail(id: string, signal?: AbortSignal) {
  const response = await read<WorldDetail>(`/worlds/${pathId(id)}`, worldDetail, { signal });
  if (response.world.worldId !== id) invalid(); return response;
}
export async function fetchTask(id: string, signal?: AbortSignal) {
  const response = await read<TaskPublic>(`/tasks/${pathId(id)}`, task, { signal });
  if (response.taskId !== id) invalid(); return response;
}
export async function fetchPlaythrough(id: string, branchId?: string, signal?: AbortSignal) {
  const response = await read<PlaythroughPublic>(`/playthroughs/${pathId(id)}${query({ branch: branchId })}`, playthrough, { signal });
  if (response.playthroughId !== id || branchId && response.viewedBranchId !== branchId) invalid(); return response;
}
export function fetchHistory(id: string, branchId?: string, cursor?: string, signal?: AbortSignal) { return read<HistoryPage>(`/playthroughs/${pathId(id)}/history${query({ branch: branchId, cursor })}`, history, { signal }); }
export function fetchCheckpoints(id: string, signal?: AbortSignal) { return read<Checkpoints>(`/playthroughs/${pathId(id)}/checkpoints`, checkpoints, { signal }); }
export function fetchDebrief(id: string, branchId?: string, signal?: AbortSignal) { return read<Debrief>(`/playthroughs/${pathId(id)}/debrief${query({ branch: branchId })}`, debrief, { signal }); }
export function fetchWords(filters: { q?: string; filter?: WordFilter; cursor?: string } = {}, signal?: AbortSignal) { return read<WordList>('/words' + query(filters), words, { signal }); }
export async function fetchWordDetail(id: string, signal?: AbortSignal) {
  const response = await read<WordDetail>(`/words/${pathId(id)}`, wordDetail, { signal });
  if (response.word.learnerWordId !== id) invalid(); return response;
}
export function fetchDueReviews(signal?: AbortSignal) { return read<DueList>('/reviews/due', due, { signal }); }
export async function submitWorldMutation<K extends WorldResponseKind>(path: string, input: Record<string, unknown>, kind: K, csrf: string): Promise<WorldMutationResponses[K]> {
  if (!/^\/(?:worlds(?:\/[0-9a-f-]{36}\/(?:versions|playthroughs))?|tasks\/[0-9a-f-]{36}\/(?:stop|resume)|playthroughs\/[0-9a-f-]{36}\/(?:turns|translations|restores)|reviews(?:\/items)?)$/iu.test(path) || !uuid(input.clientActionId)) invalid();
  const response = await read<WorldMutationResponses[K]>(path, mutationSchemas[kind], { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(input) });
  const value = response as unknown as Record<string, unknown>;
  const taskId = /^\/tasks\/([^/]+)\//u.exec(path)?.[1];
  if (taskId && value.taskId !== taskId
    || kind === 'translation' && input.tokenId !== undefined && value.selectedTokenId !== input.tokenId
    || kind === 'reviewResult' && input.reviewItemId !== undefined && value.reviewItemId !== input.reviewItemId
    || kind === 'reviewItem' && (input.learnerWordId !== undefined && value.learnerWordId !== input.learnerWordId || input.modality !== undefined && value.modality !== input.modality)) invalid();
  return response;
}
