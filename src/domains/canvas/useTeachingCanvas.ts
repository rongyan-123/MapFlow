import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { fetchTeachingCanvas } from '../../api/tavernClient';
import { teachingCanvasPersistence } from './persistence';
import type { TeachingCanvasState } from '../conversations/types';

export function useTeachingCanvas(conversationId: string, csrfToken: string, graphRevision: number, initial?: TeachingCanvasState,
  options?: { readOnly?: boolean; initiallyOpen?: boolean; queryClient?: QueryClient; accountId?: string }) {
  const persistence = useMemo(() => teachingCanvasPersistence(conversationId, csrfToken, initial, options?.queryClient, options?.accountId),
    [conversationId, options?.queryClient, options?.accountId]);
  persistence.setAccess(csrfToken, options?.readOnly === true);
  const snapshot = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot);
  const [open, setOpen] = useState(options?.initiallyOpen ?? !!initial?.enabled);
  const [wide, setWide] = useState(true);
  const [preview, setPreview] = useState<TeachingCanvasState | null>(null);
  useEffect(() => { persistence.retain(); return () => persistence.leave(); }, [persistence]);
  useEffect(() => {
    const previous = persistence.getSnapshot().document;
    if (!previous) return;
    const controller = new AbortController();
    void fetchTeachingCanvas(conversationId, controller.signal).then(saved => {
      if (controller.signal.aborted) return;
      persistence.refresh(previous, saved); setPreview(null);
    }).catch(failure => { if (!controller.signal.aborted) persistence.reportReadError(failure); });
    return () => controller.abort();
  }, [conversationId, graphRevision, persistence]);
  const show = async () => {
    const current = persistence.getSnapshot();
    if (current.deleted || current.deletionPreparing) return;
    // Visibility changes on the user's click, never on an asynchronous read result.
    setOpen(true);
    await persistence.show();
  };
  const enableDrawing = async () => {
    await persistence.show();
    const loaded = persistence.getSnapshot();
    if (!loaded.deleted && loaded.document && !loaded.document.enabled) await persistence.save(undefined, true);
  };
  return { ...snapshot, document: preview ?? snapshot.document, open, wide, show, reload: () => persistence.show(true), enableDrawing,
    save: persistence.save, flush: persistence.flush, queue: persistence.queue,
    prepareDeletion: persistence.prepareDeletion, cancelDeletion: persistence.cancelDeletion,
    markDeleted: persistence.markDeleted, setOpen, setWide, setPreview };
}
