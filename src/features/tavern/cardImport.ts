import { TavernApiError, type CardImport, type CompatibilityWarning, type LoreEntry, type NormalizedCharacterCard } from './types';
import { FIELD_BYTES, NORMALIZED_CARD_BYTES, RAW_FILE_BYTES, hasControls, isRecord, tooLarge, utf8Bytes } from './validation';

const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
const TEXT_FIELDS = {
  description: 'description', personality: 'personality', scenario: 'scenario', firstMessage: 'first_mes',
  exampleDialogue: 'mes_example', systemPrompt: 'system_prompt', postHistoryInstructions: 'post_history_instructions',
  creatorNotes: 'creator_notes',
} as const;

export async function readCardImport(file: File): Promise<CardImport> {
  const card = await normalizeCharacterCard(file);
  return { card, sourceFile: file, sourceInfo: { sourceFormat: card.sourceFormat, fileName: file.name, fileSize: file.size } };
}

export async function normalizeCharacterCard(file: File): Promise<NormalizedCharacterCard> {
  if (file.size > RAW_FILE_BYTES) tooLarge('角色卡文件不能超过 8 MiB。');
  const bytes = await readBytes(file);
  const sourceFormat = PNG_MAGIC.every((byte, index) => bytes[index] === byte) ? 'png' : 'json';
  const source = sourceFormat === 'png' ? await readPngCard(bytes) : parseJson(decodeUtf8(bytes));
  return normalize(source, sourceFormat);
}

function readBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(invalid('文件读取失败。'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

function normalize(source: unknown, sourceFormat: 'json' | 'png'): NormalizedCharacterCard {
  if (!isRecord(source)) throw invalid();
  if (source.spec !== undefined && source.spec !== 'chara_card_v2' && source.spec !== 'chara_card_v3') {
    throw new TavernApiError(400, 'tavern.card_unsupported', '暂不支持这个角色卡版本。');
  }
  const wrapped = source.spec !== undefined;
  const body = wrapped ? source.data : source;
  if (!isRecord(body)) throw invalid();
  const prefix = wrapped ? 'data.' : '';
  const warnings: CompatibilityWarning[] = [];
  let warningCount = 0;
  const warn = (code: string, field: string, message = '本期不支持，已安全忽略；不会执行脚本。') => {
    warningCount += 1;
    if (warnings.length < 256) warnings.push({ code, field: warningPath(field), message });
  };
  const name = textField(body.name, 'name').trim();
  if (!name) throw invalid('角色名称不能为空。');
  if (Array.from(name).length > 200) tooLarge('角色名称最多 200 个字符。');
  const alternateGreetings = textArray(body.alternate_greetings, 'alternate_greetings');
  if (alternateGreetings.length > 64) tooLarge('备选开场白最多 64 条。');
  const textFields = Object.fromEntries(Object.entries(TEXT_FIELDS).map(([target, field]) => [target, textField(body[field], field)])) as Pick<NormalizedCharacterCard, keyof typeof TEXT_FIELDS>;
  const supported = new Set(['name', ...Object.values(TEXT_FIELDS), 'alternate_greetings', 'character_book', 'extensions']);
  for (const key of Object.keys(body)) if (!supported.has(key)) warn('unsupported_field', `${prefix}${key}`);
  if (wrapped) for (const key of Object.keys(source)) {
    if (!['spec', 'spec_version', 'data'].includes(key)) warn('unsupported_field', key);
  }
  warnExtensions(body.extensions, `${prefix}extensions`, warn);
  const lorebook: LoreEntry[] = [];
  if (body.character_book !== undefined && body.character_book !== null) {
    if (!isRecord(body.character_book)) throw invalid('世界书格式无效。');
    const book = body.character_book;
    const entries = book.entries ?? [];
    if (!Array.isArray(entries)) throw invalid('世界书条目必须为数组。');
    if (entries.length > 256) tooLarge('世界书最多 256 条。');
    for (const key of Object.keys(book)) if (key !== 'entries') warn('unsupported_lore', `${prefix}character_book.${key}`);
    entries.forEach((entry: unknown, index) => {
      if (!isRecord(entry)) throw invalid('世界书条目格式无效。');
      const path = `${prefix}character_book.entries.${index}`;
      const fields = ['id', 'keys', 'secondary_keys', 'constant', 'enabled', 'selective', 'content', 'priority', 'insertion_order', 'use_regex'];
      for (const key of Object.keys(entry)) if (!fields.includes(key)) warn('unsupported_lore', `${path}.${key}`);
      // SillyTavern stores use_regex=true even for plain keys. Only /pattern/flags keys
      // require regex matching; never execute them or treat them as literal triggers.
      const plainKeys = (value: unknown, field: string) => textArray(value, field).filter((key, keyIndex) => {
        if (!/^\/[\s\S]*\/[dgimsuvy]*$/u.test(key)) return true;
        warn('unsupported_regex', `${field}.${keyIndex}`, '不支持正则关键词，已安全忽略此键；同条普通关键词仍可匹配。');
        return false;
      });
      const keys = plainKeys(entry.keys, `${path}.keys`);
      const secondaryKeys = plainKeys(entry.secondary_keys, `${path}.secondary_keys`);
      const constant = booleanField(entry.constant, false);
      const selective = booleanField(entry.selective, false);
      if (!constant && ((Array.isArray(entry.keys) && entry.keys.length > 0 && keys.length === 0) ||
        (selective && Array.isArray(entry.secondary_keys) && entry.secondary_keys.length > 0 && secondaryKeys.length === 0))) {
        warn('unsupported_lore', path, '触发条件仅剩不支持的正则关键词，整条世界书已安全忽略，以免扩大触发范围。');
        return;
      }
      const id = entry.id === undefined ? String(index) : typeof entry.id === 'number' && Number.isFinite(entry.id) ? String(entry.id) : textField(entry.id, `${path}.id`);
      if (!id || lorebook.some(item => item.id === id)) throw invalid('世界书标识不能为空或重复。');
      if (utf8Bytes(id) > 200) tooLarge('世界书标识不能超过 200 字节。');
      if (keys.length + secondaryKeys.length > 128) tooLarge('每条世界书最多 128 个关键词。');
      if ([...keys, ...secondaryKeys].some(key => utf8Bytes(key) > 1024)) tooLarge('每个世界书关键词不能超过 1 KiB。');
      lorebook.push({ id, keys, secondaryKeys,
        constant, enabled: booleanField(entry.enabled, true), selective,
        content: textField(entry.content, `${path}.content`), priority: integerField(entry.priority, 0), order: integerField(entry.insertion_order, index) });
    });
  }
  if (warningCount > 256) warnings[255] = { code: 'warnings_truncated', field: 'warnings',
    message: `另有 ${warningCount - 255} 项不支持的字段或功能已安全忽略；报告仅展示前 255 项明细，不代表全部机制兼容。` };
  const card: NormalizedCharacterCard = { schemaVersion: 1, sourceFormat, name, ...textFields,
    alternateGreetings, lorebook, warnings };
  if (utf8Bytes(JSON.stringify(card)) > NORMALIZED_CARD_BYTES) tooLarge('规范化角色卡不能超过 512 KiB，请精简内容。');
  return card;
}

function textField(value: unknown, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || hasControls(value)) throw invalid(`${field} 必须是有效文本。`);
  if (utf8Bytes(value) > FIELD_BYTES) tooLarge(`${field} 不能超过 64 KiB。`);
  return value;
}
function textArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw invalid(`${field} 必须是文本数组。`);
  return value.map((item, index) => textField(item, `${field}.${index}`));
}
function booleanField(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw invalid('世界书开关必须为布尔值。');
  return value;
}
function integerField(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw invalid('世界书优先级和顺序必须为 32 位整数。');
  return value;
}
function warnExtensions(value: unknown, field: string, warn: (code: string, field: string) => void) {
  if (isRecord(value)) for (const key of Object.keys(value)) warn('unsupported_extension', `${field}.${key}`);
  else if (value !== undefined && value !== null) warn('unsupported_extension', field);
}

function warningPath(field: string): string {
  const escaped = field.replace(/[\u0000-\u001f\u007f]/gu, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (utf8Bytes(escaped) <= 256) return escaped;
  let prefix = '';
  let bytes = 0;
  for (const character of escaped) {
    bytes += utf8Bytes(character);
    if (bytes > 253) break;
    prefix += character;
  }
  return `${prefix}…`;
}

async function readPngCard(bytes: Uint8Array): Promise<unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const candidates: { keyword: string; kind: string; payload: Uint8Array; start: number }[] = [];
  let cursor = 8;
  let ended = false;
  let imageSeen = false;
  while (cursor < bytes.length) {
    if (cursor + 12 > bytes.length) throw invalid('PNG 数据不完整。');
    const length = view.getUint32(cursor);
    const end = cursor + 12 + length;
    if (end > bytes.length) throw invalid('PNG 数据块长度无效。');
    const kind = String.fromCharCode(...bytes.subarray(cursor + 4, cursor + 8));
    if (crc32(bytes.subarray(cursor + 4, end - 4)) !== view.getUint32(end - 4)) throw invalid('PNG 校验失败。');
    const payload = bytes.subarray(cursor + 8, end - 4);
    if (cursor === 8 && (kind !== 'IHDR' || length !== 13 || view.getUint32(cursor + 8) === 0 || view.getUint32(cursor + 12) === 0)) throw invalid('PNG 图片头无效。');
    if (kind === 'IDAT') imageSeen = true;
    if (kind === 'tEXt' || kind === 'iTXt' || kind === 'zTXt') {
      const separator = payload.indexOf(0);
      if (separator < 1 || separator > 79) throw invalid('PNG 文本块无效。');
      const keyword = String.fromCharCode(...payload.subarray(0, separator));
      if (keyword === 'chara' || keyword === 'ccv3') candidates.push({ keyword, kind, payload, start: separator + 1 });
    }
    cursor = end;
    if (kind === 'IEND') { if (length !== 0 || cursor !== bytes.length) throw invalid('PNG 结束块无效。'); ended = true; break; }
  }
  if (!ended || !imageSeen) throw invalid('PNG 图片不完整。');
  const selected = candidates.find(candidate => candidate.keyword === 'ccv3') ?? candidates.find(candidate => candidate.keyword === 'chara');
  if (!selected) throw new TavernApiError(400, 'tavern.card_unsupported', 'PNG 中没有 chara 或 ccv3 角色卡元数据。');
  let { start } = selected;
  let compressed = false;
  if (selected.kind === 'zTXt') {
    if (selected.payload[start++] !== 0) throw invalid('PNG 压缩格式无效。');
    compressed = true;
  } else if (selected.kind === 'iTXt') {
    const flag = selected.payload[start++];
    if ((flag !== 0 && flag !== 1) || selected.payload[start++] !== 0) throw invalid('PNG 国际文本块无效。');
    compressed = flag === 1;
    for (let field = 0; field < 2; field++) {
      const separator = selected.payload.indexOf(0, start);
      if (separator < 0) throw invalid('PNG 国际文本块不完整。');
      start = separator + 1;
    }
  }
  const encoded = compressed ? await inflate(selected.payload.slice(start)) : selected.payload.subarray(start);
  const base64 = decodeUtf8(encoded).replace(/\s/gu, '');
  if (!base64 || base64.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(base64)) throw invalid('角色卡元数据不是有效的 Base64。');
  try {
    const binary = atob(base64);
    return parseJson(decodeUtf8(Uint8Array.from(binary, character => character.charCodeAt(0))));
  } catch (error) {
    if (error instanceof TavernApiError) throw error;
    throw invalid('角色卡元数据解码失败。');
  }
}
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new TavernApiError(400, 'tavern.card_unsupported', '当前浏览器不支持压缩 PNG 文本块，请使用 JSON 卡。');
  const stream = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(new Uint8Array(bytes)); controller.close(); } }).pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > RAW_FILE_BYTES) tooLarge('PNG 解压后的元数据不能超过 8 MiB。');
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof TavernApiError) throw error;
    throw invalid('PNG 文本解压失败。');
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const block of chunks) { output.set(block, offset); offset += block.length; }
  return output;
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function decodeUtf8(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw invalid('角色卡包含无效的 UTF-8 文本。'); }
}
function parseJson(text: string): unknown {
  try { return JSON.parse(text.replace(/^\uFEFF/u, '')) as unknown; }
  catch { throw invalid('角色卡必须是有效的 JSON 或带元数据的 PNG。'); }
}
function invalid(message = '角色卡格式无效。'): TavernApiError {
  return new TavernApiError(400, 'tavern.card_invalid', message);
}
