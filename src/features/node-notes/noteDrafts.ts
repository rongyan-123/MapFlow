interface NoteDraft { markdown: string; baseMarkdown: string; baseVersion: number; revision: string }
const memoryDrafts = new Map<string, NoteDraft>();
const accountPrefix = (accountId: string) => `mapflow.note-draft.v1.${encodeURIComponent(accountId)}.`;
export const noteDraftKey = (accountId: string, entryId: string, nodeId: string) =>
  `${accountPrefix(accountId)}${encodeURIComponent(entryId)}.${encodeURIComponent(nodeId)}`;

export function readNoteDraft(key: string): NoteDraft | null {
  try {
    const draft: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (validDraft(draft)) { memoryDrafts.set(key, draft); return draft; }
  } catch { /* Use this browser session's memory when storage is unavailable. */ }
  return memoryDrafts.get(key) ?? null;
}
export function writeNoteDraft(key: string, markdown: string, baseMarkdown: string, baseVersion: number): NoteDraft {
  const draft = { markdown, baseMarkdown, baseVersion, revision: crypto.randomUUID() };
  memoryDrafts.set(key, draft);
  try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* Memory still survives navigation. */ }
  return draft;
}
export function clearNoteDraft(key: string, expectedRevision?: string): boolean {
  if (expectedRevision && readNoteDraft(key)?.revision !== expectedRevision) return false;
  memoryDrafts.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Memory is already cleared. */ }
  return true;
}
export function clearAccountNoteDrafts(accountId: string): void {
  const prefix = accountPrefix(accountId);
  for (const key of memoryDrafts.keys()) if (key.startsWith(prefix)) memoryDrafts.delete(key);
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch { /* Private drafts have also been cleared from application memory. */ }
}
function validDraft(value: unknown): value is NoteDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<NoteDraft>;
  return typeof draft.markdown === 'string' && draft.markdown.length <= 30000
    && typeof draft.baseMarkdown === 'string' && draft.baseMarkdown.length <= 30000
    && typeof draft.baseVersion === 'number' && Number.isSafeInteger(draft.baseVersion) && draft.baseVersion >= 0
    && typeof draft.revision === 'string' && draft.revision.length <= 64;
}
