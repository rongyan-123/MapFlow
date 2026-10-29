import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { progressPercentForNode, type LearningTreeSnapshot, type TreeLayoutMode, type TreeDisplayMode } from '../../types/learning';
import { Button, IconButton } from '../Button';
import MapCanvas from './MapCanvas';
import NodeDetails from './NodeDetails';
import NodeNoteDialog from './NodeNoteDialog';
import MapProgressOverview from './MapProgressOverview';
import CompletionCelebration from './CompletionCelebration';
import { describePublicError } from '../../lib/publicErrors';
import { useBulkNodeCompletion,type SaveBatchProgress,type CancelBatchProgress } from '../../domains/maps/useBulkNodeCompletion';
import MapBulkActions from './MapBulkActions';
import { Icon } from '../Icon';

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
  onSetBatchProgress?: SaveBatchProgress;
  onCancelBatchProgress?: CancelBatchProgress;
  progressPending?: boolean;
  completionPending?: boolean;
  error?: unknown;
  toolbarTarget?: HTMLElement | null;
  toolbarHostRef?: RefObject<HTMLElement>;
}

function MapFeedback({ text, isError, pending }: { text: string; isError: boolean; pending: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <div className={`mf-map-feedback ${isError ? 'mf-map-feedback--error' : ''}`} aria-label={text} data-pending={pending} role={isError ? 'alert' : 'status'}>
    <span title={text}>{text}</span>
    {pending && <span className="mf-map-feedback-count" aria-hidden="true">{text.match(/\d+\/\d+/)?.[0] ?? '保存中'}</span>}
    {!pending && <IconButton icon="close" label="关闭地图提示" onClick={event => {
      const toolbar = event.currentTarget.closest('[role="toolbar"]');
      setDismissed(true);
      toolbar?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }} />}
  </div>;
}

export default function MapView({
  snapshot, displayMode, accountId, entryId, csrfToken, initialNodeId, initialLayout,
  onLearn, onSetCompleted, onSetProgress,onSetBatchProgress,onCancelBatchProgress, progressPending, completionPending, error, toolbarTarget, toolbarHostRef,
}: Props) {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const target = toolbarHostRef?.current ?? null;
    if (headerTarget !== target) setHeaderTarget(target);
  });
  const target = toolbarHostRef ? headerTarget : toolbarTarget;
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
  const bulkAvailable = displayMode === 'personal' && Boolean(onSetBatchProgress && onCancelBatchProgress);
  const bulkKey = bulkAvailable ? `mapflow.bulk-completion.v1.${accountId}.${entryId ?? snapshot.tree.id}.${snapshot.tree.id}` : undefined;
  const bulkScope = saveScope.current;
  const bulk = useBulkNodeCompletion({ snapshot, storageKey: bulkKey,onSetBatchProgress,onCancelBatchProgress,
    blocked: Boolean(saving || completionPending || progressPending),
    onBusyChange: busy => {
      if (!bulkScope.active || saveScope.current !== bulkScope) return;
      bulkScope.saving = busy;
      setSaving(busy);
    },
  });
  const displayedSnapshot={...snapshot,progress:bulk.progress};
  const feedback = bulk.uncertain ? {text:bulk.error,isError:true,pending:false}
    : bulk.busy ? { text:bulk.notice, isError: false, pending: true }
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
    const previousPercent = progressPercentForNode(bulk.progress.find(progress => progress.node_id === nodeId));
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

  const toolbar = <div className="mf-map-controls" role="toolbar" aria-label="地图工具">
      <div className="mf-map-toolbar-actions"><Button className="mf-block-sort-button" variant={layout === 'blocks' ? 'primary' : 'secondary'}
        aria-label="按块排序" aria-pressed={layout === 'blocks'} title={layout === 'blocks' ? '再次点击恢复知识关系' : '按学习块整理地图节点'}
        onClick={() => setLayout(previous => previous === 'blocks' ? 'relationship' : 'blocks')}><Icon name="map" /><span className="mf-map-action-label">按块排序</span></Button>
      {bulkAvailable && <MapBulkActions key={bulkKey} disabled={Boolean(saving || completionPending || progressPending || !snapshot.nodes.length)}
        allCompleted={snapshot.nodes.every(node => progressPercentForNode(bulk.progress.find(item => item.node_id === node.id)) === 100)}
        undoCount={bulk.undoCount} onLight={bulk.light} onUndo={bulk.undo} busy={bulk.busy} checking={bulk.checking} uncertain={bulk.uncertain} onCancel={bulk.cancel} />}</div>
      {feedback && <MapFeedback key={`${accountId}.${entryId ?? ''}.${snapshot.tree.id}.${feedback.text}`} {...feedback} />}
      {selected ? <div className="mf-map-selection">
        <button ref={detailButton} type="button" className="mf-map-selection-title" aria-expanded={detailsOpen}
          aria-label={`查看节点详情：${selected.title}`} onClick={() => setDetailsOpen(true)}>{selected.title}</button>
        <IconButton icon="close" label="取消选择" onClick={() => { setSelectedId(null); setNoteOpen(false); }} />
      </div> : <span className="mf-muted mf-small">{snapshot.nodes.length} 个节点 · {layout === 'blocks'
        ? (snapshot.node_block_assignments?.length ? '再次点击恢复知识关系' : '暂无节点分组，仍显示知识关系')
        : '点击节点查看内容'}</span>}
    </div>;
  return <div className="mf-map-view">
    {target ? createPortal(toolbar, target) : target === undefined ? toolbar : null}
    <div className="mf-map-stage">
      <div className="mf-map-canvas">{snapshot.nodes.length
        ? <MapCanvas snapshot={displayedSnapshot} displayMode={displayMode} layoutMode={layout} selectedNodeId={selectedId}
          onSelectNode={selectNode} isGraphVisible viewportStorageKey={`mapflow.map-viewport.v1.${accountId}.${snapshot.tree.id}`} />
        : <p className="mf-empty">这张地图还没有节点。</p>}</div>
      {selected && detailsOpen && <aside ref={detailPanel} className="mf-map-detail-panel" aria-label="节点详情" tabIndex={-1}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setDetailsOpen(false); } }}>
        <div className="mf-map-detail-header"><span>节点详情</span><div className="mf-map-detail-header-actions"><IconButton icon="close" label="取消节点选择" onClick={() => { setSelectedId(null); setNoteOpen(false); }} /><IconButton icon="down" label="收起节点详情" onClick={() => setDetailsOpen(false)} /></div></div>
        <div className="mf-map-detail-content"><NodeDetails key={`${accountId}.${entryId ?? ''}.${snapshot.tree.id}.${selected.id}`} snapshot={displayedSnapshot} selectedNodeId={selected.id}
          displayMode={displayMode}
          onSetCompleted={onSetCompleted ? (nodeId, completed) => void saveNodeProgress(nodeId, completed ? 100 : 0, () => onSetCompleted(nodeId, completed)) : undefined}
          onSetProgress={onSetProgress ? (nodeId, percent) => void saveNodeProgress(nodeId, percent, () => onSetProgress(nodeId, percent)) : undefined}
          progressPending={progressPending || saving} completionPending={completionPending || saving}
          onOpenChat={onLearn ? () => onLearn({ id: selected.id, title: selected.title }) : undefined}
          onOpenNote={entryId && csrfToken ? () => setNoteOpen(true) : undefined} /></div>
      </aside>}
      {celebration && <CompletionCelebration key={celebration.sequence} title={celebration.title} onDismiss={dismissCelebration} />}
    </div>
    {displayMode === 'personal' && <MapProgressOverview snapshot={displayedSnapshot} />}
    {selected && noteOpen && entryId && csrfToken && <NodeNoteDialog accountId={accountId} libraryEntryId={entryId}
      nodeId={selected.id} nodeTitle={selected.title} csrfToken={csrfToken} onClose={() => setNoteOpen(false)} />}
  </div>;
}
