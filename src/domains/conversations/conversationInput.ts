import { TavernApiError, type CreateConversationInput, type VocabularyEntry } from './types';
import { hasControls, tooLarge, utf8Bytes } from './validation';

export function parseVocabulary(text: string): VocabularyEntry[] | undefined {
  const entries = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean).map(line => {
    const separator = /\t|\s+[—–-]\s+/u.exec(line);
    return separator ? { term: line.slice(0, separator.index).trim(), meaning: line.slice(separator.index + separator[0].length).trim() } : { term: line };
  });
  return normalizeVocabulary(entries);
}

export function prepareConversationInput(input: CreateConversationInput): CreateConversationInput {
  validateId(input.characterId);
  const userName = input.userName.trim();
  const persona = input.persona?.trim();
  validateText(userName, '用户称呼', 80, true);
  if (persona) validateText(persona, 'Persona', 4000);
  if (input.greetingIndex !== undefined && (!Number.isSafeInteger(input.greetingIndex) || input.greetingIndex < 0)) {
    throw new TavernApiError(400, 'tavern.card_invalid', '请选择有效的开场白。');
  }
  const vocabulary = normalizeVocabulary(input.vocabulary);
  return { characterId: input.characterId, userName, ...(persona ? { persona } : {}),
    ...(vocabulary ? { vocabulary } : {}), ...(input.greetingIndex === undefined ? {} : { greetingIndex: input.greetingIndex }) };
}

function normalizeVocabulary(entries?: VocabularyEntry[]): VocabularyEntry[] | undefined {
  if (!entries?.length) return undefined;
  if (entries.length > 50) tooLarge('学习词表最多 50 项。');
  const vocabulary = entries.map(entry => {
    const term = entry.term.trim();
    const meaning = entry.meaning?.trim();
    validateText(term, '词或短语', 80, true);
    if (meaning) validateText(meaning, '释义', 500);
    return { term, ...(meaning ? { meaning } : {}) };
  });
  if (utf8Bytes(JSON.stringify(vocabulary)) > 2048) tooLarge('完整学习词表不能超过 2 KiB，请精简词条或释义。');
  return vocabulary;
}
function validateText(text: string, label: string, limit: number, required = false) {
  if ((required && !text) || hasControls(text)) throw new TavernApiError(400, 'tavern.card_invalid', `${label}不能为空或包含控制字符。`);
  if (Array.from(text).length > limit) tooLarge(`${label}最多 ${limit} 个字符。`);
}
export function validateId(id: string) {
  if (!id.trim() || id.length > 128 || /[\u0000-\u001f\u007f]/u.test(id)) throw new TavernApiError(400, 'tavern.card_invalid', '请求标识无效。');
}
export function validateMessage(message: string) {
  validateText(message, '消息', 8000, true);
  if (!message.trim()) throw new TavernApiError(400, 'tavern.card_invalid', '请输入消息。');
  if (utf8Bytes(message) > 8192) tooLarge('消息不能超过 8 KiB，请缩短后重试。');
}
