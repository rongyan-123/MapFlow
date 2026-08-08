import type { NodeLearningProgress } from '../../types/learning';

interface ProgressOverviewProps {
  totalNodes: number;
  progress: NodeLearningProgress[];
}

export default function ProgressOverview({
  totalNodes,
  progress,
}: ProgressOverviewProps) {
  const completed = progress.filter((item) => item.status === 'completed').length;
  const mastered = progress.filter((item) => item.status === 'mastered').length;
  const current = progress.filter((item) => item.status === 'in_progress').length;
  const untouched = totalNodes - completed - mastered - current;
  const percentage = totalNodes
    ? Math.round(((completed + mastered) / totalNodes) * 100)
    : 0;

  return (
    <footer className="flex h-12 shrink-0 items-center gap-5 border-t border-slate-800 bg-slate-950 px-5 text-xs text-slate-400">
      <strong className="text-slate-200">总进度 {percentage}%</strong>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="bg-emerald-400 transition-all" style={{ width: `${(completed / totalNodes) * 100}%` }} />
        <div className="bg-yellow-300 transition-all" style={{ width: `${(mastered / totalNodes) * 100}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${(current / totalNodes) * 100}%` }} />
      </div>
      <span className="text-emerald-300">完成 {completed}</span>
      <span className="text-yellow-200">掌握 {mastered}</span>
      <span className="text-amber-300">当前 {current}</span>
      <span>未学习 {untouched}</span>
      <span>共 {totalNodes}</span>
    </footer>
  );
}
