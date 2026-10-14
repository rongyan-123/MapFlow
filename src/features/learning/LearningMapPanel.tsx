import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPersonalTree, setNodeCompletion, setNodeProgress } from '../../api/treeLibraryClient';
import SkillTreeCanvas from '../skill-tree/SkillTreeCanvas';
import NodeDetailPanel from '../skill-tree/NodeDetailPanel';
import TreeRestoreControl from '../tree-library/TreeRestoreControl';
import NodeNoteDialog from '../node-notes/NodeNoteDialog';
import { snapshotFromGraph } from '../skill-tree/snapshotFromGraph';
import { buttonClass, ErrorNotice } from '../tavern/TavernUi';

export default function LearningMapPanel({ accountId, libraryEntryId, csrfToken, onClose, onReference }: {
  accountId: string; libraryEntryId: string; csrfToken: string; onClose: () => void;
  onReference: (node: { id: string; title: string }) => void;
}) {
  const queryClient = useQueryClient();
  const tree = useQuery({ queryKey: ['me', accountId, 'tree-library', libraryEntryId], queryFn: () => fetchPersonalTree(libraryEntryId), retry: false });
  const selectionKey = `mapflow.learning.map-node.v1.${accountId}.${libraryEntryId}`;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    try { return localStorage.getItem(selectionKey); } catch { return null; }
  });
  const [noteNodeId, setNoteNodeId] = useState<string | null>(null);
  const snapshot = useMemo(() => tree.data ? snapshotFromGraph(tree.data.graph, tree.data.completed_node_ids, tree.data.node_progress) : null, [tree.data]);
  const selectedNode = snapshot?.nodes.find(node => node.id === selectedNodeId);
  useEffect(() => {
    if (!snapshot) return;
    try { if (selectedNode) localStorage.setItem(selectionKey, selectedNode.id); else localStorage.removeItem(selectionKey); }
    catch { /* Node selection does not depend on optional browser storage. */ }
  }, [snapshot, selectedNode, selectionKey]);
  const refreshTree = () => queryClient.invalidateQueries({ queryKey: ['me', accountId, 'tree-library'] });
  const completion = useMutation({ mutationFn: ({ nodeId, completed }: { nodeId: string; completed: boolean }) =>
    setNodeCompletion(libraryEntryId, nodeId, completed, csrfToken), onSuccess: refreshTree });
  const progress = useMutation({ mutationFn: ({ nodeId, percent }: { nodeId: string; percent: number }) =>
    setNodeProgress(libraryEntryId, nodeId, percent, csrfToken), onSuccess: refreshTree });
  return <>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={snapshot?.tree.title}>{snapshot?.tree.title ?? '学习地图'}</p>
      <button type="button" className={`${buttonClass} shrink-0 whitespace-nowrap`} onClick={onClose}>收起地图</button>
    </div>
    <TreeRestoreControl key={`${accountId}.${libraryEntryId}`} accountId={accountId} libraryEntryId={libraryEntryId} csrfToken={csrfToken} onRestored={() => setNoteNodeId(null)} />
    {tree.isPending && <p role="status" className="p-6 text-sm text-slate-400">正在读取地图…</p>}
    <ErrorNotice error={tree.error} onRetry={() => void tree.refetch()} />
    {snapshot && <div className="relative min-h-0 flex-1"><SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      viewportStorageKey={`mapflow.map.viewport.v1.${accountId}.${libraryEntryId}`}
      selectedNodeId={selectedNodeId} isGraphVisible onSelectNode={setSelectedNodeId} />
      {selectedNode && <section aria-label="学习节点详情" className="absolute inset-y-0 right-0 z-10 flex w-full max-w-80 flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          <button type="button" className={buttonClass} onClick={() => onReference({ id: selectedNode.id, title: selectedNode.title })}>加入聊天参考</button>
          <button type="button" className={buttonClass} onClick={() => setNoteNodeId(selectedNode.id)}>
            {(tree.data?.noted_node_ids ?? []).includes(selectedNode.id) ? '查看 / 编辑笔记' : '写下我的总结'}</button>
        </div>
        <ErrorNotice error={completion.error ?? progress.error} />
        <NodeDetailPanel snapshot={snapshot} selectedNodeId={selectedNode.id} displayMode="personal"
          onTogglePanel={() => setSelectedNodeId(null)} completionPending={completion.isPending} progressPending={progress.isPending}
          onSetCompleted={(nodeId, completed) => completion.mutate({ nodeId, completed })}
          onSetProgress={(nodeId, percent) => progress.mutate({ nodeId, percent })} />
      </section>}
    </div>}
    {noteNodeId && <NodeNoteDialog accountId={accountId} libraryEntryId={libraryEntryId} nodeId={noteNodeId}
      nodeTitle={snapshot?.nodes.find(node => node.id === noteNodeId)?.title ?? '节点'} csrfToken={csrfToken} onClose={() => setNoteNodeId(null)} />}
  </>;
}
