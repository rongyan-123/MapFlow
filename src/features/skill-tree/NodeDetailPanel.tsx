import { DEPTH_LABELS, ICON_EMOJI } from '../../lib/constants';
import type { LearningTreeSnapshot } from '../../types/learning';

interface NodeDetailPanelProps {
  snapshot: LearningTreeSnapshot;
  selectedNodeId: string | null;
}

function parseStringList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export default function NodeDetailPanel({
  snapshot,
  selectedNodeId,
}: NodeDetailPanelProps) {
  const node = snapshot.nodes.find((item) => item.id === selectedNodeId);
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 items-center justify-center border-l border-slate-800 bg-slate-950/95 p-6">
        <p className="text-center text-sm text-slate-500">点击节点查看学习目标与掌握证据</p>
      </aside>
    );
  }

  const progress = snapshot.progress.find((item) => item.node_id === node.id);
  const status = progress?.status ?? 'not_started';
  const objectives = parseStringList(node.learning_objectives);
  const expectedEvidence = parseStringList(node.observable_evidence);
  const prerequisites = snapshot.edges
    .filter((edge) => edge.target_node_id === node.id)
    .map((edge) => snapshot.nodes.find((item) => item.id === edge.source_node_id))
    .filter((item) => item !== undefined)
    .slice(0, 5);

  const statusLabels = {
    not_started: '未学习',
    in_progress: '正在学习',
    completed: '已完成',
    mastered: '已掌握',
  };

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-950/95 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="text-3xl">{ICON_EMOJI[node.icon] ?? '📖'}</span>
        <div>
          <h2 className="font-semibold leading-snug text-slate-100">{node.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{node.category}</span>
            <span className="rounded-full bg-cyan-950 px-2 py-1 text-cyan-300">
              {DEPTH_LABELS[node.recommended_depth]} · {node.recommended_depth}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
              {statusLabels[status]}
            </span>
          </div>
        </div>
      </div>

      {node.description && <p className="mb-5 text-sm leading-6 text-slate-400">{node.description}</p>}

      <section className="mb-5 rounded-xl border border-cyan-900/70 bg-cyan-950/25 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">目标深度</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{node.depth_rationale}</p>
      </section>

      {objectives.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">学习目标</h3>
          <ul className="space-y-2 text-sm leading-5 text-slate-300">
            {objectives.map((objective) => (
              <li key={objective} className="flex gap-2"><span className="text-cyan-400">•</span>{objective}</li>
            ))}
          </ul>
        </section>
      )}

      {expectedEvidence.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">通过标准</h3>
          <ul className="space-y-2 text-sm leading-5 text-slate-300">
            {expectedEvidence.map((evidence) => (
              <li key={evidence} className="flex gap-2"><span className="text-emerald-400">✓</span>{evidence}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">我的掌握证据</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {progress?.evidence || '尚未记录学习证据。'}
        </p>
      </section>

      {prerequisites.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">直接前置节点</h3>
          <div className="space-y-2">
            {prerequisites.map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400">{item.title}</div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
