import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPersonalTree } from '../tree-library/treeLibraryClient';
import SkillTreeCanvas from '../skill-tree/SkillTreeCanvas';
import { snapshotFromGraph } from '../skill-tree/snapshotFromGraph';
import { buttonClass, ErrorNotice } from '../tavern/TavernUi';

export default function LearningMapPanel({ accountId, libraryEntryId, onClose }: {
  accountId: string; libraryEntryId: string; onClose: () => void;
}) {
  const tree = useQuery({ queryKey: ['me', accountId, 'tree-library', libraryEntryId], queryFn: () => fetchPersonalTree(libraryEntryId), retry: false });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const snapshot = useMemo(() => tree.data ? snapshotFromGraph(tree.data.graph, tree.data.completed_node_ids, tree.data.node_progress) : null, [tree.data]);
  return <>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <p className="truncate text-sm font-semibold">{snapshot?.tree.title ?? '学习地图'}</p>
      <button type="button" className={buttonClass} onClick={onClose}>收起地图</button>
    </div>
    {tree.isPending && <p role="status" className="p-6 text-sm text-slate-400">正在读取地图…</p>}
    <ErrorNotice error={tree.error} onRetry={() => void tree.refetch()} />
    {snapshot && <div className="min-h-0 flex-1"><SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      viewportStorageKey={`mapflow.map.viewport.v1.${accountId}.${libraryEntryId}`}
      selectedNodeId={selectedNodeId} isGraphVisible onSelectNode={setSelectedNodeId} /></div>}
  </>;
}
