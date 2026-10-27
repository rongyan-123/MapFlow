import { memo } from 'react';
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { DEPTH_LABELS, ICON_EMOJI } from '../../lib/constants';
import { progressPercentForNode } from '../../types/learning';
import { Icon } from '../Icon';
import type { BranchTone } from '../../domains/maps/branchColors';
import type {
  NodeLearningProgress,
  SkillNode as SkillNodeRecord,
  TreeLayoutMode,
  TreeDisplayMode,
} from '../../types/learning';

export interface SkillNodeData extends Record<string, unknown> {
  node: SkillNodeRecord;
  progress: NodeLearningProgress | null;
  isCurrent: boolean;
  displayMode: TreeDisplayMode;
  layoutMode?: TreeLayoutMode;
  blockName?: string;
  connectionRole?: 'focus' | 'incoming' | 'outgoing';
  ready?: boolean;
  branchTone?: BranchTone;
}

export type SkillFlowNode = Node<SkillNodeData, 'skill'>;

function MapNode({data,selected}:NodeProps<SkillFlowNode>){
  const {node,progress,isCurrent,displayMode,layoutMode,blockName}=data;
  const status=progress?.status??'not_started';const personal=displayMode==='personal';
  const percent=progressPercentForNode(progress);
  const waiting=personal&&data.ready===false;
  return <div data-mapflow-skill-node="true" data-branch-tone={data.branchTone??'blue'} data-mapflow-lit={!personal||percent===100} data-mapflow-display-mode={displayMode} data-mapflow-node-status={status} data-mapflow-readiness={personal?(waiting?'waiting':'ready'):undefined} data-connection-role={data.connectionRole} className={`mf-map-node ${selected?'mf-map-node--selected':''} ${isCurrent?'mf-map-node--current':''}`}>
    <span className="mf-node-color-fill" aria-hidden="true" />
    {layoutMode==='blocks'&&blockName&&<span className="mf-node-block">{blockName}</span>}
    <Handle type="target" position={Position.Top} className="mf-node-handle" />
    <Handle type="source" position={Position.Bottom} className="mf-node-handle" />
    <div className="mf-map-node-body"><span className="mf-node-icon">{ICON_EMOJI[node.icon]??'📖'}</span><div className="mf-node-title"><h3 title={node.title} className="mf-node-heading">{node.title}</h3><span className="mf-node-depth">{DEPTH_LABELS[node.recommended_depth]} · {node.recommended_depth}</span>{personal&&<span className="mf-node-progress">{percent}%</span>}</div></div>
    {personal&&(waiting||percent<100)&&<span className="mf-node-readiness" title={waiting?'前置未完成，仍可查看与提前学习':'前置已满足，可以开始学习'}><Icon name={waiting?'lock':'unlock'} />{waiting?'前置未完成':'可开始'}</span>}
    {personal&&status!=='not_started'&&<span className="mf-node-state"><Icon name={status==='in_progress'?'clock':status==='mastered'?'spark':'check'} />{status==='in_progress'?'进行中':status==='mastered'?'已掌握':'已完成'}</span>}
    {personal&&<div className="mf-node-progress-line" aria-hidden="true"><span style={{width:`${percent}%`}} /></div>}
    {personal&&isCurrent&&<span className="mf-node-current">当前</span>}
  </div>;
}
export default memo(MapNode);
