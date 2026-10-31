import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { BranchTone } from '../../domains/maps/branchColors';
import type { TreeDisplayMode } from '../../types/learning';

export interface LearningGroupData extends Record<string, unknown> {
  title: string;
  count: number;
  percent: number;
  readyCount: number;
  expanded: boolean;
  frameExpanded: boolean;
  displayMode: TreeDisplayMode;
  branchTone?: BranchTone;
  onToggle: () => void;
}
export type LearningGroupFlowNode = Node<LearningGroupData, 'learningGroup'>;

function LearningGroupNode({data}: NodeProps<LearningGroupFlowNode>) {
  const personal = data.displayMode === 'personal';
  return <div className="mf-map-node mf-learning-group" data-learning-group="true" data-expanded={data.frameExpanded}
    data-branch-tone={data.branchTone ?? 'blue'} data-mapflow-lit={!personal || data.percent === 100}>
    <span className="mf-node-color-fill" aria-hidden="true" />
    {!data.frameExpanded && <><Handle type="target" position={Position.Top} className="mf-node-handle" /><Handle type="source" position={Position.Bottom} className="mf-node-handle" /></>}
    <div className="mf-learning-group-heading"><span className="mf-node-icon" aria-hidden="true">▤</span>
      <div className="mf-node-title"><h3 className="mf-node-heading" title={data.title}>{data.title}</h3>
        <span className="mf-node-depth">{data.count} 个知识点{personal ? ` · ${data.percent}%` : ''}</span></div>
      <button type="button" className="nodrag nopan mf-group-toggle" aria-label={`${data.expanded ? '收起' : '展开'} ${data.title}`}
        aria-expanded={data.expanded} onClick={event => {event.stopPropagation();data.onToggle();}}>{data.expanded ? '−' : '+'}</button>
    </div>
    {personal && !data.frameExpanded && <><span className="mf-node-readiness">{data.readyCount > 0 ? `${data.readyCount} 个可开始` : data.percent === 100 ? '已完成' : '可查看前置'}</span>
      <div className="mf-node-progress-line" aria-hidden="true"><span style={{width:`${data.percent}%`}} /></div></>}
    {data.frameExpanded && <svg className="mf-group-trace" aria-hidden="true" width="100%" height="100%"><rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="12" pathLength="1" /></svg>}
  </div>;
}
export default memo(LearningGroupNode);
