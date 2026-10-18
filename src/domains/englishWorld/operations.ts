import { useEffect, useRef, useState } from 'react';
import { EnglishWorldApiError, parseWorldMutationResult, submitWorldMutation, type WorldMutationResponses, type WorldResponseKind } from '../../api/englishWorldClient';
import { PublicUiError } from '../../lib/publicErrors';

interface SavedOperation {
  version: 1; path: string; kind: WorldResponseKind; input: Record<string, unknown>;
  result?: WorldMutationResponses[WorldResponseKind];
}
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const responseKinds: WorldResponseKind[] = ['accepted', 'task', 'translation', 'restore', 'reviewItem', 'reviewResult'];
function withoutCredentials(input: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input, (key, value) => key === 'apiKey' ? undefined : value));
}
function readOperation(key: string): SavedOperation | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!isRecord(saved) || saved.version !== 1 || typeof saved.path !== 'string' || !saved.path.startsWith('/') || !responseKinds.includes(saved.kind as WorldResponseKind)
      || !isRecord(saved.input) || typeof saved.input.clientActionId !== 'string') return null;
    const operation: SavedOperation = { version: 1, path: saved.path, kind: saved.kind as WorldResponseKind, input: withoutCredentials(saved.input) };
    if (saved.result !== undefined) operation.result = parseWorldMutationResult(operation.kind, saved.result);
    return operation;
  } catch { return null; }
}

/** Browser storage preserves explicit retry identity; mounting never dispatches a mutation. */
export function useWorldOperation(accountId: string, scope: string, csrf: string) {
  const key = `mapflow.english-world.operation.v1.${accountId}.${scope}`;
  const [saved, setSaved] = useState(() => readOperation(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const activeKey = useRef(key);
  const alive = useRef(true);
  const lock = useRef(false);
  const credential = useRef('');
  useEffect(() => {
    activeKey.current = key; alive.current = true; credential.current = ''; lock.current = false;
    setSaved(readOperation(key)); setError(null); setBusy(false);
    return () => { alive.current = false; credential.current = ''; };
  }, [key]);

  function remember(operation: SavedOperation) {
    try { sessionStorage.setItem(key, JSON.stringify(operation)); } catch { /* The current page still retains the frozen request. */ }
    setSaved(operation);
  }
  async function dispatch<K extends WorldResponseKind>(operation: SavedOperation & { kind: K }, input: Record<string, unknown>): Promise<WorldMutationResponses[K] | null> {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(null); remember(operation);
    if (isRecord(input.modelAccess) && typeof input.modelAccess.apiKey === 'string') credential.current = input.modelAccess.apiKey;
    try {
      const result = await submitWorldMutation(operation.path, input, operation.kind, csrf);
      if (!alive.current || activeKey.current !== key) return null;
      remember({ ...operation, result });
      return result;
    } catch (failure) {
      if (alive.current && activeKey.current === key) setError(failure instanceof PublicUiError ? failure : new PublicUiError('请求状态尚未确认，请重放原请求核对。'));
      return null;
    } finally {
      if (alive.current && activeKey.current === key) { lock.current = false; setBusy(false); }
    }
  }
  async function perform<K extends WorldResponseKind>(path: string, input: Record<string, unknown>, kind: K): Promise<WorldMutationResponses[K] | null> {
    if (lock.current) return null;
    if (saved && saved.result === undefined) { setError(new PublicUiError('请先重放原请求，核对是否已经接受。')); return null; }
    const body = { ...input, clientActionId: crypto.randomUUID() };
    return dispatch({ version: 1, path, kind, input: withoutCredentials(body) }, body);
  }
  async function replay(apiKey?: string) {
    if (!saved || lock.current) return null;
    const input = { ...saved.input };
    if (isRecord(input.modelAccess)) {
      const originalKey = apiKey?.trim() || credential.current;
      if (!originalKey) { setError(new PublicUiError('请补回原模型的 API Key，再重放原请求。')); return null; }
      input.modelAccess = { ...input.modelAccess, apiKey: originalKey };
    }
    return dispatch(saved, input);
  }
  const canDiscard = error instanceof EnglishWorldApiError && [400, 401, 403, 404, 409, 422].includes(error.status) && error.code !== 'english_world.task_pending';
  function clear() {
    if (lock.current || saved && saved.result === undefined && !canDiscard) return;
    try { sessionStorage.removeItem(key); } catch { /* Optional recovery record. */ }
    setSaved(null); setError(null); credential.current = '';
  }
  return { busy, error, pending: saved && saved.result === undefined ? saved : null, result: saved?.result ?? null, kind: saved?.kind ?? null, saved, canDiscard, clear, perform, replay };
}
