import { memo } from 'react';
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { cn } from '../../lib/cn';
import { DEPTH_LABELS, ICON_EMOJI } from '../../lib/constants';
import type {
  NodeLearningProgress,
  SkillNode as SkillNodeRecord,
  TreeDisplayMode,
} from '../../types/learning';

export interface SkillNodeData extends Record<string, unknown> {
  node: SkillNodeRecord;
  progress: NodeLearningProgress | null;
  isCurrent: boolean;
  displayMode: TreeDisplayMode;
}

export type SkillFlowNode = Node<SkillNodeData, 'skill'>;

function SkillNodeComponent({ data, selected }: NodeProps<SkillFlowNode>) {
  const { node, progress, isCurrent, displayMode } = data;
  const isShowcase = displayMode === 'showcase';
  const status = progress?.status ?? 'not_started';
  const isCompleted = status === 'completed';
  const isMastered = status === 'mastered';
  const isInProgress = status === 'in_progress';

  return (
    <div
      className={cn(
        'relative min-w-[150px] max-w-[200px] cursor-pointer select-none rounded-xl border-2 px-4 py-3 transition-all duration-500',
        isShowcase &&
          'border-cyan-200/80 bg-gradient-to-br from-cyan-400/80 via-sky-400/70 to-violet-400/75 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.48)]',
        !isShowcase && status === 'not_started' &&
          'border-slate-700 bg-slate-900/85 text-slate-400',
        !isShowcase && isInProgress &&
          'animate-pulse-glow border-amber-300 bg-amber-950/85 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.48)]',
        !isShowcase && isCompleted &&
          'border-emerald-100 bg-emerald-300/80 text-emerald-950 shadow-[0_0_32px_rgba(52,211,153,0.72)]',
        !isShowcase && isMastered &&
          'border-yellow-100 bg-amber-200/90 text-amber-950 shadow-[0_0_38px_rgba(250,204,21,0.8)]',
        !isShowcase && isCurrent &&
          'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950',
        selected && 'scale-[1.04]',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !bg-slate-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !bg-slate-500"
      />

      <div className="flex items-center gap-2">
        <span className="text-lg">{ICON_EMOJI[node.icon] ?? '📖'}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{node.title}</h3>
          <span
            className={cn(
              'mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px]',
              isShowcase
                ? 'border-slate-900/20 text-slate-900/75'
                : status === 'not_started'
                ? 'border-slate-600 text-slate-500'
                : 'border-current/40',
            )}
          >
            {DEPTH_LABELS[node.recommended_depth]} · {node.recommended_depth}
          </span>
        </div>
        {!isShowcase && isCompleted && <span className="text-lg font-black">✓</span>}
        {!isShowcase && isMastered && <span className="text-lg font-black">★</span>}
        {isShowcase && <span className="text-lg font-black">✦</span>}
      </div>
      {!isShowcase && isCurrent && (
        <span className="absolute -top-2 left-3 rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-bold text-slate-950">
          当前
        </span>
      )}
    </div>
  );
}

export default memo(SkillNodeComponent);
