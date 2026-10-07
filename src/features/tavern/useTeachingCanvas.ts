import { useEffect, useRef, useState } from 'react';
import { fetchTeachingCanvas, saveTeachingCanvas } from './tavernClient';
import type { TeachingCanvasState } from './types';

export function useTeachingCanvas(conversationId: string, csrfToken: string, graphRevision: number, initial?: TeachingCanvasState) {
  const [document, setDocument] = useState<TeachingCanvasState | null>(initial?.enabled || initial?.elements.length ? initial : null);
  const [open, setOpen] = useState(!!initial?.enabled);
  const [wide, setWide] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [preview, setPreview] = useState<TeachingCanvasState | null>(null);
  const current = useRef(document); current.current = document;
  const pendingSave = useRef<Promise<void> | null>(null);
  const queuedElements = useRef<Record<string, unknown>[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flushLatest = useRef<() => Promise<void>>(() => Promise.resolve());
  useEffect(() => () => { clearTimeout(timer.current); void flushLatest.current().catch(() => undefined); }, []);
  useEffect(() => {
    if (!current.current) return;
    const documentAtRead = current.current;
    const controller = new AbortController();
    void fetchTeachingCanvas(conversationId, controller.signal).then(saved => {
      if (controller.signal.aborted || current.current !== documentAtRead || queuedElements.current || pendingSave.current) return;
      current.current = saved; setDocument(saved); setPreview(null);
    }).catch(failure => { if (!controller.signal.aborted) setError(failure); });
    return () => controller.abort();
  }, [conversationId, graphRevision]);
  async function show() {
    try {
      setSaving(true); setError(null);
      const saved = current.current ?? await fetchTeachingCanvas(conversationId);
      const enabled = saved.revision > 0 ? saved : await saveTeachingCanvas(conversationId, { ...saved, enabled: true }, csrfToken);
      setDocument(enabled); setOpen(true);
    } catch (failure) { setError(failure); }
    finally { setSaving(false); }
  }
  async function persist(enabled?: boolean) {
    if (pendingSave.current) await pendingSave.current;
    if (!current.current || (!queuedElements.current && enabled === undefined)) return;
    const elements = queuedElements.current ?? undefined; queuedElements.current = null;
    const snapshot = current.current;
    setSaving(true); setError(null);
    const writing = (async () => {
      try {
        const saved = await saveTeachingCanvas(conversationId, { ...snapshot, enabled: enabled ?? snapshot.enabled }, csrfToken, elements);
        current.current = saved; setDocument(saved);
      } catch (failure) { queuedElements.current ??= elements ?? null; setError(failure); throw failure; }
      finally { pendingSave.current = null; setSaving(false); }
    })();
    pendingSave.current = writing;
    await writing;
    if (queuedElements.current) await persist();
  }
  async function flush() { clearTimeout(timer.current); await persist(); }
  flushLatest.current = flush;
  function queue(elements: Record<string, unknown>[]) {
    queuedElements.current = elements;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushLatest.current().catch(() => undefined); }, 800);
  }
  async function save(elements?: Record<string, unknown>[], enabled?: boolean) {
    if (elements) queuedElements.current = elements;
    try { await persist(enabled); } catch { /* The canvas keeps the unsaved draft and displays the API error. */ }
  }
  return { document: preview ?? document, open, wide, saving, error, show, save, flush, queue, setOpen, setWide, setPreview };
}
