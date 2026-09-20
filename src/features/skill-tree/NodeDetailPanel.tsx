import { DEPTH_LABELS, ICON_EMOJI } from '../../lib/constants';
import { useEffect, useState, type RefObject } from 'react';
import { progressPercentForNode } from '../../types/learning';
import type {
  LearningTreeSnapshot,
  TreeDisplayMode,
} from '../../types/learning';

interface NodeDetailPanelProps {
  snapshot: LearningTreeSnapshot;
  selectedNodeId: string | null;
  displayMode: TreeDisplayMode;
  onSetCompleted?: (nodeId: string, completed: boolean) => void;
  completionPending?: boolean;
  onSetProgress?: (nodeId: string, progressPercent: number) => void;
  progressPending?: boolean;
  completionButtonRef?: RefObject<HTMLButtonElement>;
  onOpenChat?: () => void;
  onTogglePanel?: () => void;
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
  displayMode,
  onSetCompleted,
  completionPending = false,
  onSetProgress,
  progressPending = false,
  completionButtonRef,
  onOpenChat,
  onTogglePanel,
}: NodeDetailPanelProps) {
  const node = snapshot.nodes.find((item) => item.id === selectedNodeId);
  const progress = node
    ? snapshot.progress.find((item) => item.node_id === node.id)
    : undefined;
  const status = progress?.status ?? 'not_started';
  const completed = status === 'completed' || status === 'mastered';
  const progressPercent = progressPercentForNode(progress);
  const [detailProgressOpen, setDetailProgressOpen] = useState(false);
  const [progressInput, setProgressInput] = useState(String(progressPercent));
  const [progressInputError, setProgressInputError] = useState<string | null>(null);

  useEffect(() => {
    setProgressInput(String(progressPercent));
    setProgressInputError(null);
  }, [node?.id, progressPercent]);

  if (!node) {
    return (
      <aside className="flex w-full shrink-0 flex-col border-t border-slate-800 bg-slate-950/95 p-5 lg:w-80 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            节点详情
          </span>
          {onTogglePanel && (
            <button
              type="button"
              aria-label="收起节点详情"
              onClick={onTogglePanel}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-500 transition hover:border-cyan-400/60 hover:text-cyan-200"
            >
              收起
            </button>
          )}
        </div>
        <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
          点击节点查看学习目标与掌握证据
        </p>
      </aside>
    );
  }

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
    <aside className="w-full shrink-0 overflow-y-auto border-t border-slate-800 bg-slate-950/95 p-5 lg:w-80 lg:border-l lg:border-t-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="text-3xl">{ICON_EMOJI[node.icon] ?? '📖'}</span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-snug text-slate-100">{node.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{node.category}</span>
              <span className="rounded-full bg-cyan-950 px-2 py-1 text-cyan-300">
                {DEPTH_LABELS[node.recommended_depth]} · {node.recommended_depth}
              </span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                {displayMode === 'showcase' ? '示例节点' : statusLabels[status]}
              </span>
            </div>
          </div>
        </div>
        {onTogglePanel && (
          <button
            type="button"
            aria-label="收起节点详情"
            onClick={onTogglePanel}
            className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-500 transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            收起
          </button>
        )}
      </div>

      {displayMode === 'personal' && onOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/45 bg-cyan-400/10 px-3 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15"
        >
          <span aria-hidden="true">💬</span>
          与这棵树聊天
        </button>
      )}

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

      {displayMode === 'personal' && (onSetCompleted || onSetProgress) ? (
        <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            我的学习进度
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            可直接标记完成，也可以填写当前已经学会的百分比。
          </p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">
            当前完成度：<span>{progressPercent}%</span>
          </p>
          {onSetCompleted && (
            <button
            type="button"
            ref={completionButtonRef}
            disabled={completionPending}
            onClick={() => onSetCompleted(node.id, !completed)}
            className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              completed
                ? 'border border-slate-700 text-slate-300 hover:border-rose-400 hover:text-rose-300'
                : 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'
            }`}
          >
            {completionPending
              ? '正在保存…'
              : completed
                ? '取消完成'
                : '标记为已完成'}
            </button>
          )}
          {onSetProgress && (
            <div className="mt-3 border-t border-slate-800 pt-3">
              <button
                type="button"
                className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-cyan-200"
                onClick={() => {
                  setDetailProgressOpen((current) => !current);
                  setProgressInputError(null);
                }}
              >
                {detailProgressOpen ? '收起详细进度' : '填写详细进度'}
              </button>
              {detailProgressOpen && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs text-slate-500" htmlFor="node-progress-percent">
                    节点完成百分比
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="node-progress-percent"
                      aria-label="节点完成百分比"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={progressInput}
                      onChange={(event) => {
                        setProgressInput(event.target.value);
                        setProgressInputError(null);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      disabled={progressPending}
                      onClick={() => {
                        const trimmed = progressInput.trim();
                        const value = Number(trimmed);
                        if (
                          trimmed === '' ||
                          !Number.isInteger(value) ||
                          value < 0 ||
                          value > 100
                        ) {
                          setProgressInputError('请输入 0–100 的整数。');
                          return;
                        }
                        onSetProgress(node.id, value);
                      }}
                      className="rounded-lg border border-cyan-400/50 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      {progressPending ? '保存中…' : '保存详细进度'}
                    </button>
                  </div>
                  {progressInputError && (
                    <p className="text-xs text-rose-300">{progressInputError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="mb-5 rounded-xl border border-cyan-900/70 bg-cyan-950/20 p-3 text-xs leading-5 text-cyan-200/80">
          当前是官方示例预览。加入个人库后会复制成你的私有副本，从 0 开始独立记录进度。
        </section>
      )}

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
