import { memo,useId } from 'react';
import {
  Handle,
  Position,
  useStore,
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

function LearningArrow(){
  const id=useId().replace(/:/gu,'');const zoom=useStore(state=>state.transform[2]);
  return <span className="mf-learning-arrow" aria-label="当前学习位置" style={{transform:`scale(${Math.min(2.8,Math.max(.7,1/zoom))})`}}><svg viewBox="0 0 58 76" width="38" height="50" aria-hidden="true"><defs><linearGradient id={id} x1="0" x2="1" y2="1"><stop stopColor="#fff0a6"/><stop offset=".45" stopColor="#efbb42"/><stop offset="1" stopColor="#bb7922"/></linearGradient></defs><path d="M19 4 36 1 36 36 54 33 28 70 3 45 19 42Z" fill="#9b651c"/><path d="M15 7 32 4 32 39 50 36 24 73 0 48 15 45Z" fill={`url(#${id})`} stroke="#f9d77b" strokeWidth="1.3"/><path d="m32 4 4-3v35l-4 3ZM50 36l4-3-26 37-4 3Z" fill="#96601b"/><path d="m15 7 4-3 17-3-4 3ZM0 48l3-3 12-3v3Z" fill="#fff1b1"/></svg></span>;
}

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
    {personal&&isCurrent&&<LearningArrow />}
  </div>;
}
export default memo(MapNode);
