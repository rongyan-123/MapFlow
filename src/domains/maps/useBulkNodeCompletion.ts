import { useEffect, useRef, useState } from 'react';
import { progressPercentForNode, type LearningTreeSnapshot } from '../../types/learning';
import { describePublicError, PublicUiError } from '../../lib/publicErrors';

interface SavedProgress { nodeId: string; percent: number }
interface Owner {
  key: string | undefined;
  active: boolean;
  running: boolean;
  entries: SavedProgress[];
  processed: number;
  total: number;
  notice: string;
  error: string;
}
interface Props {
  snapshot: LearningTreeSnapshot;
  storageKey?: string;
  blocked: boolean;
  onSetCompleted?: (nodeId: string, completed: boolean) => Promise<unknown>;
  onSetProgress?: (nodeId: string, percent: number) => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
}

function readProgress(key: string | undefined, snapshot: LearningTreeSnapshot): SavedProgress[] {
  if (!key) return [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!Array.isArray(saved)) return [];
    const nodes = new Set(snapshot.nodes.map(node => node.id));
    const seen = new Set<string>();
    return saved.filter((entry): entry is SavedProgress => {
      if (!entry || typeof entry !== 'object' || typeof entry.nodeId !== 'string'
        || !nodes.has(entry.nodeId) || seen.has(entry.nodeId)
        || !Number.isInteger(entry.percent) || entry.percent < 0 || entry.percent >= 100) return false;
      seen.add(entry.nodeId);
      return true;
    });
  } catch { return []; }
}

function createOwner(key: string | undefined, snapshot: LearningTreeSnapshot): Owner {
  return { key, active: true, running: false, entries: readProgress(key, snapshot), processed: 0, total: 0, notice: '', error: '' };
}

/** The undo journal contains only this operation's original percentages, never notes or credentials. */
export function useBulkNodeCompletion({ snapshot, storageKey, blocked, onSetCompleted, onSetProgress, onBusyChange }: Props) {
  const owner = useRef<Owner>();
  if (!owner.current || owner.current.key !== storageKey) {
    if (owner.current) owner.current.active = false;
    owner.current = createOwner(storageKey, snapshot);
  }
  const [view, setView] = useState(() => ({ ...owner.current! }));
  const current = view.key === storageKey ? view : owner.current;
  useEffect(() => {
    const source = owner.current!;
    source.active = true;
    setView({ ...source });
    return () => { source.active = false; };
  }, [storageKey]);

  function publish(source: Owner) {
    if (source.active && owner.current === source) setView({ ...source });
  }
  function checkpoint(source: Owner, entries: SavedProgress[]) {
    if (!source.key) return;
    try {
      if (entries.length) localStorage.setItem(source.key, JSON.stringify(entries));
      else localStorage.removeItem(source.key);
    } catch { throw new PublicUiError('无法保存撤销记录，请检查浏览器存储后重试。'); }
    source.entries = entries;
    publish(source);
  }

  async function run(undo: boolean) {
    const source = owner.current!;
    if (!source.key || source.running || blocked || !onSetCompleted || !onSetProgress) return;
    const progress = new Map(snapshot.progress.map(item => [item.node_id, progressPercentForNode(item)]));
    const pending = undo ? [...source.entries] : snapshot.nodes
      .filter(node => (progress.get(node.id) ?? 0) < 100)
      .map(node => ({ nodeId: node.id, percent: progress.get(node.id) ?? 0 }));
    if (!pending.length) return;
    source.running = true;
    source.processed = 0;
    source.total = pending.length;
    source.error = '';
    source.notice = undo ? '正在恢复原进度' : '正在点亮节点';
    onBusyChange(true);
    publish(source);
    let preservedChanges = false;
    try {
      for (const entry of pending) {
        if (!source.active || owner.current !== source) break;
        if (undo) {
          const currentPercent = progress.get(entry.nodeId) ?? 0;
          const changedAfterLighting = currentPercent !== 100 && currentPercent !== entry.percent;
          if (changedAfterLighting) preservedChanges = true;
          if (!changedAfterLighting && snapshot.nodes.some(node => node.id === entry.nodeId)) await onSetProgress(entry.nodeId, entry.percent);
          checkpoint(source, source.entries.filter(item => item.nodeId !== entry.nodeId));
        } else {
          // Persist before the request: even a response lost after a successful write remains recoverable.
          if (!source.entries.some(item => item.nodeId === entry.nodeId)) checkpoint(source, [...source.entries, entry]);
          await onSetCompleted(entry.nodeId, true);
        }
        source.processed += 1;
        publish(source);
      }
      if (source.active && owner.current === source) source.notice = undo
        ? preservedChanges ? '已撤销本次点亮，保留之后调整的进度。' : '已恢复点亮前的学习进度。'
        : '已点亮全部节点，可撤销本次点亮。';
    } catch (error) {
      source.notice = '';
      source.error = `${undo ? '恢复' : '点亮'}在处理 ${source.processed}/${source.total} 个节点后停止。${describePublicError(error)} 可重试，或使用撤销入口恢复原进度。`;
    } finally {
      source.running = false;
      if (source.active && owner.current === source) onBusyChange(false);
      publish(source);
    }
  }

  function forgetNode(nodeId: string) {
    const source = owner.current!;
    if (!source.entries.some(entry => entry.nodeId === nodeId)) return;
    try { checkpoint(source, source.entries.filter(entry => entry.nodeId !== nodeId)); }
    catch (error) { source.error = describePublicError(error); publish(source); }
  }

  return {
    busy: current.running, undoCount: current.entries.length,
    processed: current.processed, total: current.total, notice: current.notice, error: current.error,
    light: () => run(false), undo: () => run(true), forgetNode,
  };
}
