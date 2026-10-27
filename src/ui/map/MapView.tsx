import { useCallback, useEffect, useRef, useState } from 'react';
import { progressPercentForNode, type LearningTreeSnapshot, type TreeLayoutMode, type TreeDisplayMode } from '../../types/learning';
import { Button, IconButton } from '../Button';
import MapCanvas from './MapCanvas';
import NodeDetails from './NodeDetails';
import NodeNoteDialog from './NodeNoteDialog';
import MapProgressOverview from './MapProgressOverview';
import CompletionCelebration from './CompletionCelebration';
import { describePublicError } from '../../lib/publicErrors';
import { useBulkNodeCompletion } from '../../domains/maps/useBulkNodeCompletion';
import MapBulkActions from './MapBulkActions';

interface Props {
  snapshot: LearningTreeSnapshot;
  displayMode: TreeDisplayMode;
  accountId: string;
  entryId?: string;
  csrfToken?: string;
  initialNodeId?: string;
  initialLayout?: TreeLayoutMode;
  onLearn?: (node?: { id: string; title: string }) => void;
  onSetCompleted?: (nodeId: string, completed: boolean) => Promise<unknown>;
  onSetProgress?: (nodeId: string, percent: number) => Promise<unknown>;
  progressPending?: boolean;
  completionPending?: boolean;
  error?: unknown;
}

function MapFeedback({ text, isError, pending }: { text: string; isError: boolean; pending: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <div className={`mf-map-feedback ${isError ? 'mf-map-feedback--error' : ''}`} role={isError ? 'alert' : 'status'}>
    <span title={text}>{text}</span>
    {!pending && <IconButton icon="close" label="关闭地图提示" onClick={event => {
      const toolbar = event.currentTarget.closest('[role="toolbar"]');
      setDismissed(true);
      toolbar?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }} />}
  </div>;
}

export default function MapView({
  snapshot, displayMode, accountId, entryId, csrfToken, initialNodeId, initialLayout,
  onLearn, onSetCompleted, onSetProgress, progressPending, completionPending, error,
}: Props) {
  const [layout, setLayout] = useState<TreeLayoutMode>(initialLayout ?? 'relationship');
  const [selectedId, setSelectedId] = useState<string | null>(initialNodeId ?? null);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialNodeId));
  const [noteOpen, setNoteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; sequence: number } | null>(null);
  const celebrationSequence = useRef(0);
  const saveScope = useRef({ accountId, entryId, treeId: snapshot.tree.id, active: true, saving: false });
  if (saveScope.current.accountId !== accountId || saveScope.current.entryId !== entryId || saveScope.current.treeId !== snapshot.tree.id) {
    saveScope.current.active = false;
    saveScope.current = { accountId, entryId, treeId: snapshot.tree.id, active: true, saving: false };
  }
  useEffect(() => {
    const source = saveScope.current;
    source.active = true;
    setSaving(false);
    setCelebration(null);
    return () => { source.active = false; };
  }, [accountId, entryId, snapshot.tree.id]);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const detailPanel = useRef<HTMLElement>(null);
  const detailButton = useRef<HTMLButtonElement>(null);
  const selected = snapshot.nodes.find(node => node.id === selectedId);
  const bulkAvailable = displayMode === 'personal' && Boolean(onSetCompleted && onSetProgress);
  const bulkKey = bulkAvailable ? `mapflow.bulk-completion.v1.${accountId}.${entryId ?? snapshot.tree.id}.${snapshot.tree.id}` : undefined;
  const bulkScope = saveScope.current;
  const bulk = useBulkNodeCompletion({ snapshot, storageKey: bulkKey, onSetCompleted, onSetProgress,
    blocked: Boolean(saving || completionPending || progressPending),
    onBusyChange: busy => {
      if (!bulkScope.active || saveScope.current !== bulkScope) return;
      bulkScope.saving = busy;
      setSaving(busy);
    },
  });
  const feedback = bulk.busy ? { text: `${bulk.notice} · ${bulk.processed}/${bulk.total}`, isError: false, pending: true }
    : saving || completionPending || progressPending ? { text: '正在保存进度…', isError: false, pending: true }
    : bulk.error ? { text: bulk.error, isError: true, pending: false }
    : error ? { text: describePublicError(error), isError: true, pending: false }
    : bulk.notice ? { text: bulk.notice, isError: false, pending: false } : null;

  useEffect(() => {
    setSelectedId(initialNodeId ?? null);
    setLayout(initialLayout ?? 'relationship');
    setDetailsOpen(Boolean(initialNodeId));
    setNoteOpen(false);
  }, [accountId, entryId, snapshot.tree.id, initialNodeId, initialLayout]);

  useEffect(() => {
    if (!selected) return;
    const target = detailsOpen ? detailPanel.current : detailButton.current;
    target?.focus({ preventScroll: true });
  }, [selected?.id, detailsOpen]);

  function selectNode(nodeId: string) {
    setSelectedId(nodeId);
    setDetailsOpen(true);
    setNoteOpen(false);
  }

  async function saveNodeProgress(nodeId: string, nextPercent: number, persist: () => Promise<unknown>) {
    const source = saveScope.current;
    const node = snapshot.nodes.find(item => item.id === nodeId);
    if (!node || source.saving || completionPending || progressPending) return;
    const previousPercent = progressPercentForNode(snapshot.progress.find(progress => progress.node_id === nodeId));
    source.saving = true;
    setSaving(true);
    try {
      await persist();
      if (source.active && saveScope.current === source) bulk.forgetNode(nodeId);
      if (source.active && saveScope.current === source && nextPercent === 100 && previousPercent < 100) {
        setCelebration({ title: node.title, sequence: ++celebrationSequence.current });
      }
    } catch {
      // The page presents the mutation error; a failed save never produces a success cue.
    } finally {
      source.saving = false;
      if (source.active && saveScope.current === source) setSaving(false);
    }
  }

  return <div className="mf-map-view">
    <div className="mf-map-controls" role="toolbar" aria-label="地图工具">
      <div className="mf-map-toolbar-actions"><Button className="mf-block-sort-button" variant={layout === 'blocks' ? 'primary' : 'secondary'}
        aria-pressed={layout === 'blocks'} title={layout === 'blocks' ? '再次点击恢复知识关系' : '按学习块整理地图节点'}
        onClick={() => setLayout(previous => previous === 'blocks' ? 'relationship' : 'blocks')}>按块排序</Button>
      {bulkAvailable && <MapBulkActions key={bulkKey} disabled={Boolean(saving || completionPending || progressPending || !snapshot.nodes.length)}
        allCompleted={snapshot.nodes.every(node => progressPercentForNode(snapshot.progress.find(item => item.node_id === node.id)) === 100)}
        undoCount={bulk.undoCount} onLight={bulk.light} onUndo={bulk.undo} />}</div>
      {feedback && <MapFeedback key={`${accountId}.${entryId ?? ''}.${snapshot.tree.id}.${feedback.text}`} {...feedback} />}
      {selected ? <div className="mf-map-selection">
        <button ref={detailButton} type="button" className="mf-map-selection-title" aria-expanded={detailsOpen}
          aria-label={`查看节点详情：${selected.title}`} onClick={() => setDetailsOpen(true)}>{selected.title}</button>
        <IconButton icon="close" label="取消选择" onClick={() => { setSelectedId(null); setNoteOpen(false); }} />
      </div> : <span className="mf-muted mf-small">{snapshot.nodes.length} 个节点 · {layout === 'blocks'
        ? (snapshot.node_block_assignments?.length ? '再次点击恢复知识关系' : '暂无节点分组，仍显示知识关系')
        : '点击节点查看内容'}</span>}
    </div>
    <div className="mf-map-stage">
      <div className="mf-map-canvas">{snapshot.nodes.length
        ? <MapCanvas snapshot={snapshot} displayMode={displayMode} layoutMode={layout} selectedNodeId={selectedId}
          onSelectNode={selectNode} isGraphVisible viewportStorageKey={`mapflow.map-viewport.v1.${accountId}.${snapshot.tree.id}`} />
        : <p className="mf-empty">这张地图还没有节点。</p>}</div>
      {selected && detailsOpen && <aside ref={detailPanel} className="mf-map-detail-panel" aria-label="节点详情" tabIndex={-1}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setDetailsOpen(false); } }}>
        <div className="mf-map-detail-header"><span>节点详情</span><IconButton icon="down" label="收起节点详情" onClick={() => setDetailsOpen(false)} /></div>
        <div className="mf-map-detail-content"><NodeDetails key={`${accountId}.${entryId ?? ''}.${snapshot.tree.id}.${selected.id}`} snapshot={snapshot} selectedNodeId={selected.id}
          displayMode={displayMode}
          onSetCompleted={onSetCompleted ? (nodeId, completed) => void saveNodeProgress(nodeId, completed ? 100 : 0, () => onSetCompleted(nodeId, completed)) : undefined}
          onSetProgress={onSetProgress ? (nodeId, percent) => void saveNodeProgress(nodeId, percent, () => onSetProgress(nodeId, percent)) : undefined}
          progressPending={progressPending || saving} completionPending={completionPending || saving}
          onOpenChat={onLearn ? () => onLearn({ id: selected.id, title: selected.title }) : undefined}
          onOpenNote={entryId && csrfToken ? () => setNoteOpen(true) : undefined} /></div>
      </aside>}
      {celebration && <CompletionCelebration key={celebration.sequence} title={celebration.title} onDismiss={dismissCelebration} />}
    </div>
    {displayMode === 'personal' && <MapProgressOverview snapshot={snapshot} />}
    {selected && noteOpen && entryId && csrfToken && <NodeNoteDialog accountId={accountId} libraryEntryId={entryId}
      nodeId={selected.id} nodeTitle={selected.title} csrfToken={csrfToken} onClose={() => setNoteOpen(false)} />}
  </div>;
}
