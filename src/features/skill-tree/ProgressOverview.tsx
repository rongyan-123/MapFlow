import type {
  NodeLearningProgress,
  TreeDisplayMode,
} from '../../types/learning';
import { progressPercentForNode } from '../../types/learning';

interface ProgressOverviewProps {
  totalNodes: number;
  progress: NodeLearningProgress[];
  displayMode: TreeDisplayMode;
}

export default function ProgressOverview({
  totalNodes,
  progress,
  displayMode,
}: ProgressOverviewProps) {
  if (displayMode === 'showcase') {
    return (
      <footer className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-t border-cyan-900/60 bg-cyan-950/20 px-5 text-xs text-cyan-100/80 max-lg:pb-[env(safe-area-inset-bottom)]">
        <strong className="text-cyan-100">示例展示 · 加入后从 0 开始</strong>
        <span>全图共 {totalNodes} 个节点</span>
      </footer>
    );
  }

  const progressValues = progress.map(progressPercentForNode);
  const completed = progressValues.filter((value) => value === 100).length;
  const inProgress = progressValues.filter(
    (value) => value > 0 && value < 100,
  ).length;
  const started = progressValues.filter((value) => value > 0).length;
  const untouched = Math.max(totalNodes - started, 0);
  const percentage = totalNodes
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / totalNodes)
    : 0;

  return (
    <footer className="flex min-h-12 shrink-0 items-center gap-5 border-t border-slate-800 bg-slate-950 px-5 text-xs text-slate-400 max-lg:pb-[env(safe-area-inset-bottom)]">
      <strong className="whitespace-nowrap text-slate-200">总进度 {percentage}%</strong>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="bg-emerald-300 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-emerald-300">已完成 {completed}</span>
      <span className="text-amber-300">进行中 {inProgress}</span>
      <span>未开始 {untouched}</span>
      <span>共 {totalNodes}</span>
    </footer>
  );
}
