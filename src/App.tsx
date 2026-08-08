import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLearningTree } from './lib/api';
import NodeDetailPanel from './features/skill-tree/NodeDetailPanel';
import CompletionFlash from './features/skill-tree/CompletionFlash';
import ProgressOverview from './features/skill-tree/ProgressOverview';
import SkillTreeCanvas from './features/skill-tree/SkillTreeCanvas';
import type { LearningStatus, SkillNode } from './types/learning';

export default function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ node: SkillNode; nonce: number } | null>(null);
  const query = useQuery({
    queryKey: ['learning-tree'],
    queryFn: fetchLearningTree,
    refetchInterval: 2000,
  });

  const prevProgressRef = useRef<Map<string, LearningStatus>>(new Map());

  useEffect(() => {
    if (!selectedNodeId && query.data) {
      setSelectedNodeId(query.data.current_node_id ?? query.data.nodes[0]?.id ?? null);
    }
  }, [query.data, selectedNodeId]);

  useEffect(() => {
    if (!query.data) return;
    const prev = prevProgressRef.current;
    const isDone = (s?: LearningStatus) => s === 'completed' || s === 'mastered';
    for (const p of query.data.progress) {
      const before = prev.get(p.node_id);
      if (!isDone(before) && isDone(p.status)) {
        const node = query.data.nodes.find((n) => n.id === p.node_id);
        if (node) {
          setCompletion((c) => (c && c.node.id === node.id ? c : { node, nonce: Date.now() }));
        }
      }
      prev.set(p.node_id, p.status);
    }
  }, [query.data]);

  if (query.isPending) {
    return (
      <main className="grid h-screen place-items-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" />
          正在读取技能树…
        </div>
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="grid h-screen place-items-center bg-slate-950 p-6 text-slate-300">
        <div className="max-w-md rounded-2xl border border-red-900 bg-red-950/30 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-200">学习树暂时无法读取</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {query.error instanceof Error ? query.error.message : '请确认 Nest 服务运行在 3000 端口。'}
          </p>
          <button
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={() => void query.refetch()}
          >
            重新读取
          </button>
        </div>
      </main>
    );
  }

  const snapshot = query.data;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{snapshot.tree.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">由项目学习记录实时生成 · 每 2 秒自动同步</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Legend color="bg-slate-700" label="未学习" />
          <Legend color="bg-amber-400" label="当前" />
          <Legend color="bg-emerald-300" label="完成" />
          <Legend color="bg-yellow-200" label="掌握" />
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <section className="min-w-0 flex-1">
          <SkillTreeCanvas
            snapshot={snapshot}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </section>
        <NodeDetailPanel
          snapshot={snapshot}
          selectedNodeId={selectedNodeId}
        />
      </main>

      <ProgressOverview
        totalNodes={snapshot.nodes.length}
        progress={snapshot.progress}
      />

      {completion && (
        <CompletionFlash
          key={completion.nonce}
          node={completion.node}
          onComplete={() => setCompletion(null)}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
