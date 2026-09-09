import { useState } from 'react';
import { DEPTH_LABELS, ICON_EMOJI } from '../../lib/constants';
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
  onOpenChat?: (prompt?: string) => void;
  onJoinPersonal?: () => void;
  onTogglePanel?: () => void;
  explorationQuestion?: string | null;
  onUseExplorationQuestion?: () => void;
  isAuthenticated?: boolean;
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
  onOpenChat,
  onJoinPersonal,
  onTogglePanel,
  explorationQuestion = null,
  onUseExplorationQuestion,
  isAuthenticated = false,
}: NodeDetailPanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const node = snapshot.nodes.find((item) => item.id === selectedNodeId);
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

  const progress = snapshot.progress.find((item) => item.node_id === node.id);
  const status = progress?.status ?? 'not_started';
  const completed = status === 'completed' || status === 'mastered';
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
        <section className="mb-5 rounded-xl border border-cyan-400/25 bg-cyan-950/25 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">从一个问题开始</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">选一个问题填入聊天草稿，确认后再发送。</p>
          <div className="mt-3 space-y-2">
            {suggestedQuestions(node.title).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onOpenChat(prompt)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100"
              >
                {prompt}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-mapflow-onboarding-target="chat-entry"
            onClick={() => onOpenChat()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/45 bg-cyan-400/10 px-3 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15"
          >
            <span aria-hidden="true">💬</span>
            与这棵树聊天
          </button>
        </section>
      )}

      <section className="mb-5 rounded-xl border border-cyan-900/70 bg-cyan-950/25 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">你现在可以探索</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {node.description ?? `先用自己的话说说「${node.title}」解决了什么问题。`}
        </p>
      </section>

      {displayMode === 'showcase' && explorationQuestion && onUseExplorationQuestion && (
        <section className="mb-5 rounded-xl border border-amber-300/30 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">推荐问题</p>
          <p className="mt-2 text-sm leading-6 text-amber-50">{explorationQuestion}</p>
          <button
            type="button"
            onClick={onUseExplorationQuestion}
            className="mt-3 w-full rounded-lg border border-amber-200/35 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-100 hover:bg-amber-200/10"
          >
            {isAuthenticated ? '加入我的学习并带入聊天草稿' : '登录后带入聊天草稿'}
          </button>
        </section>
      )}

      {displayMode === 'showcase' && onJoinPersonal && (
        <section className="mb-5 rounded-xl border border-amber-300/25 bg-amber-950/15 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">下一步</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            加入我的学习后，你可以从这个节点提问，或用自己的话实践一次。
          </p>
          <button
            type="button"
            data-mapflow-onboarding-target="join-personal"
            onClick={onJoinPersonal}
            className="mt-3 w-full rounded-lg border border-amber-200/35 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-100 hover:bg-amber-200/10"
          >
            {isAuthenticated ? '加入我的学习' : '登录并加入我的学习'}
          </button>
        </section>
      )}

      <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/45 p-3">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="node-learning-details"
          onClick={() => setDetailsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-300 transition hover:text-cyan-200"
        >
          <span>{detailsOpen ? '收起学习细节' : '展开学习细节'}</span>
          <span aria-hidden="true">{detailsOpen ? '−' : '+'}</span>
        </button>
        {detailsOpen && (
          <div id="node-learning-details" className="mt-4 space-y-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">目标深度</h3>
              <p className="text-sm leading-6 text-slate-300">{node.depth_rationale}</p>
            </section>

            {objectives.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">学习目标</h3>
                <ul className="space-y-2 text-sm leading-5 text-slate-300">
                  {objectives.map((objective) => (
                    <li key={objective} className="flex gap-2"><span className="text-cyan-400">•</span>{objective}</li>
                  ))}
                </ul>
              </section>
            )}

            {expectedEvidence.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">通过标准</h3>
                <ul className="space-y-2 text-sm leading-5 text-slate-300">
                  {expectedEvidence.map((evidence) => (
                    <li key={evidence} className="flex gap-2"><span className="text-emerald-400">✓</span>{evidence}</li>
                  ))}
                </ul>
              </section>
            )}

            {prerequisites.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">直接前置节点</h3>
                <div className="space-y-2">
                  {prerequisites.map((item) => (
                    <div key={item.id} className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-slate-400">{item.title}</div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </section>

      {displayMode === 'personal' && onSetCompleted ? (
        <section className="mb-5 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">我的学习进度</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">完成记录只代表你手动留下的状态，不自动证明掌握。</p>
          <button
            type="button"
            data-mapflow-onboarding-target="progress"
            disabled={completionPending}
            onClick={() => onSetCompleted(node.id, !completed)}
            className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              completed
                ? 'border border-slate-700 text-slate-300 hover:border-rose-400 hover:text-rose-300'
                : 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'
            }`}
          >
            {completionPending ? '正在保存…' : completed ? '取消完成' : '标记为已完成'}
          </button>
        </section>
      ) : (
        <section className="mb-5 rounded-xl border border-cyan-900/70 bg-cyan-950/20 p-3 text-xs leading-5 text-cyan-200/80">
          当前是全亮示例预览。加入个人库后，这棵树会从 0 开始，节点默认全部未完成。
        </section>
      )}
    </aside>
  );
}

function suggestedQuestions(nodeTitle: string): string[] {
  return [
    `请用一个具体例子解释「${nodeTitle}」。`,
    `「${nodeTitle}」在真实项目里什么时候会派上用场？`,
    `它和前置节点之间是怎样连接的？`,
  ];
}
