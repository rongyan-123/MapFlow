import type { QueryClient } from '@tanstack/react-query';
import { fetchTeachingCanvas, saveTeachingCanvas } from '../../api/tavernClient';
import type { TeachingCanvasState } from '../conversations/types';

export interface CanvasPersistenceSnapshot {
  document: TeachingCanvasState | null;
  saving: boolean;
  dirty: boolean;
  deletionPreparing: boolean;
  deleted: boolean;
  error: unknown;
}

const sessions = new WeakMap<QueryClient, Map<string, TeachingCanvasPersistence>>();
const sessionKey = (accountId: string, conversationId: string) => accountId + '/' + conversationId;

export function findTeachingCanvasPersistence(client: QueryClient, accountId: string, conversationId: string) {
  return sessions.get(client)?.get(sessionKey(accountId, conversationId));
}

export function teachingCanvasPersistence(conversationId: string, csrfToken: string, initial?: TeachingCanvasState,
  client?: QueryClient, accountId = '') {
  const create = (release?: () => void) => new TeachingCanvasPersistence(conversationId, csrfToken, initial, release);
  if (!client) return create();
  let accountSessions = sessions.get(client);
  if (!accountSessions) { accountSessions = new Map(); sessions.set(client, accountSessions); }
  const key = sessionKey(accountId, conversationId);
  const existing = accountSessions.get(key);
  if (existing) return existing;
  const created = create(() => { if (accountSessions?.get(key) === created) accountSessions.delete(key); });
  accountSessions.set(key, created);
  return created;
}

/** Keeps outstanding drafts alive while their chat component is not mounted. */
export class TeachingCanvasPersistence {
  private snapshot: CanvasPersistenceSnapshot;
  private savedDocument: TeachingCanvasState | null;
  private listeners = new Set<() => void>();
  private queuedElements: Record<string, unknown>[] | null = null;
  private pendingSave: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private mounts = 0;
  private readOnly = false;
  private loading = false;

  constructor(private conversationId: string, private csrfToken: string, initial?: TeachingCanvasState, private release?: () => void) {
    this.snapshot = { document: initial?.enabled || initial?.elements.length ? initial : null,
      saving: false, dirty: false, deletionPreparing: false, deleted: false, error: null };
    this.savedDocument = this.snapshot.document;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setAccess(csrfToken: string, readOnly: boolean) { this.csrfToken = csrfToken; this.readOnly = readOnly; }
  private publish(patch: Partial<CanvasPersistenceSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch, saving: this.loading || this.pendingSave !== null,
      dirty: this.queuedElements !== null || this.pendingSave !== null };
    this.listeners.forEach(listener => listener());
  }
  retain() { this.mounts++; }
  leave() {
    this.mounts--; clearTimeout(this.timer);
    if (this.snapshot.deleted) { this.releaseIfClean(); return; }
    if (this.snapshot.deletionPreparing) return;
    void this.flush().catch(() => undefined).finally(() => this.releaseIfClean());
  }
  private releaseIfClean() {
    if (!this.mounts && !this.snapshot.dirty && !this.snapshot.deletionPreparing) this.release?.();
  }
  refresh(previous: TeachingCanvasState, saved: TeachingCanvasState) {
    if (!this.snapshot.deleted && !this.snapshot.deletionPreparing && !this.snapshot.dirty && this.snapshot.document === previous) {
      this.savedDocument = saved;
      this.publish({ document: saved });
    }
  }
  async show() {
    if (this.snapshot.deleted || this.snapshot.deletionPreparing) return;
    this.loading = true; this.publish({ error: null });
    try {
      const saved = this.snapshot.document ?? await fetchTeachingCanvas(this.conversationId);
      if (!this.snapshot.deleted) { this.savedDocument ??= saved; this.publish({ document: saved }); }
    } catch (failure) { if (!this.snapshot.deleted) this.publish({ error: failure }); }
    finally { this.loading = false; this.publish(); }
  }
  reportReadError(failure: unknown) { if (!this.snapshot.deleted) this.publish({ error: failure }); }
  private async persist(enabled?: boolean) {
    if (this.readOnly || this.snapshot.deleted) return;
    if (this.pendingSave) await this.pendingSave;
    if (this.readOnly || this.snapshot.deleted || !this.savedDocument || (!this.queuedElements && enabled === undefined)) return;
    const elements = this.queuedElements ?? undefined; this.queuedElements = null;
    const document = this.savedDocument;
    const writing = saveTeachingCanvas(this.conversationId, { ...document, enabled: enabled ?? document.enabled }, this.csrfToken, elements)
      .then(saved => {
        if (!this.snapshot.deleted) {
          this.savedDocument = saved;
          this.publish({ document: this.queuedElements ? { ...saved, elements: this.queuedElements } : saved });
        }
      })
      .catch(failure => {
        if (!this.snapshot.deleted) { this.queuedElements ??= elements ?? null; this.publish({ error: failure }); }
        throw failure;
      }).finally(() => { this.pendingSave = null; this.publish(); });
    this.pendingSave = writing; this.publish({ error: null });
    await writing;
    if (this.queuedElements) await this.persist();
  }
  flush = async () => { clearTimeout(this.timer); await this.persist(); };
  queue = (elements: Record<string, unknown>[]) => {
    if (this.readOnly || this.snapshot.deleted || this.snapshot.deletionPreparing) return;
    this.queuedElements = elements;
    this.publish({ document: this.snapshot.document ? { ...this.snapshot.document, elements } : null }); clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => undefined); }, 800);
  };
  save = async (elements?: Record<string, unknown>[], enabled?: boolean) => {
    if (this.readOnly || this.snapshot.deleted || this.snapshot.deletionPreparing) return;
    if (elements) {
      this.queuedElements = elements;
      this.publish({ document: this.snapshot.document ? { ...this.snapshot.document, elements } : null });
    }
    try { await this.persist(enabled); } catch { /* Retain the draft and expose the failed write. */ }
  };
  prepareDeletion = async () => {
    if (this.snapshot.deleted) return;
    clearTimeout(this.timer); this.publish({ deletionPreparing: true });
    try {
      await this.flush();
      if (this.snapshot.dirty) throw new Error('画布尚未保存。');
    }
    catch (failure) { this.publish({ deletionPreparing: false }); throw failure; }
  };
  cancelDeletion = () => {
    if (this.snapshot.deleted) return;
    this.publish({ deletionPreparing: false });
    if (this.queuedElements && !this.snapshot.error) this.timer = setTimeout(() => { void this.flush().catch(() => undefined); }, 800);
    this.releaseIfClean();
  };
  markDeleted = () => {
    clearTimeout(this.timer); this.queuedElements = null; this.savedDocument = null;
    this.publish({ deleted: true, deletionPreparing: false, document: null, error: null });
    this.releaseIfClean();
  };
}
