import { isRecord, RAW_FILE_BYTES } from './validation';

export interface OfficialCard {
  type: 'character'; id: string; name: string; description: string; url: string; highlight: boolean;
}

const base = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/';
const catalogUrl = `${base}index.json`;
const cardBase = `${base}assets/character/`;
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('Content-Length'));
  if (declared > limit) throw new Error(`下载内容超过 ${limit === RAW_FILE_BYTES ? '8 MiB' : '1 MiB'} 限制。`);
  if (!response.body) throw new Error('下载内容为空，请稍后重试。');
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error(`下载内容超过 ${limit === RAW_FILE_BYTES ? '8 MiB' : '1 MiB'} 限制。`);
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function validCard(entry: unknown): entry is OfficialCard {
  if (!isRecord(entry)) return false;
  return entry.type === 'character' && typeof entry.id === 'string' && /^[a-zA-Z0-9_.-]+\.png$/u.test(entry.id)
    && typeof entry.name === 'string' && entry.name.length > 0 && entry.name.length <= 160
    && typeof entry.description === 'string' && entry.description.length <= 2000
    && typeof entry.highlight === 'boolean' && entry.url === `${cardBase}${entry.id}`;
}

export async function fetchOfficialCards(signal?: AbortSignal): Promise<OfficialCard[]> {
  const response = await fetch(catalogUrl, { signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('酒馆精选角色目录暂时无法连接，请稍后重试。');
  let entries: unknown;
  try { entries = JSON.parse(new TextDecoder().decode(await readBounded(response, 1024 * 1024))); }
  catch (error) { if (error instanceof Error && error.message.includes('1 MiB')) throw error; throw new Error('酒馆精选角色目录格式有误。'); }
  if (!Array.isArray(entries)) throw new Error('酒馆精选角色目录格式有误。');
  const seen = new Set<string>();
  return entries.filter((entry): entry is OfficialCard => {
    if (!validCard(entry) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, 100);
}

export async function downloadOfficialCard(card: OfficialCard, signal?: AbortSignal): Promise<File> {
  if (!validCard(card)) throw new Error('角色卡下载地址不受信任。');
  const response = await fetch(`${cardBase}${card.id}`, { signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('角色卡下载失败，请稍后重试。');
  const bytes = await readBounded(response, RAW_FILE_BYTES);
  if (!pngHeader.every((byte, index) => bytes[index] === byte)) throw new Error('下载的文件不是有效 PNG 角色卡。');
  // readBounded creates a fresh Uint8Array backed by an ArrayBuffer.
  return new File([bytes.buffer as ArrayBuffer], card.id, { type: 'image/png' });
}
