import type { TavernToolApproval } from './types';

const labels: Record<string,string> = {
  title:'标题', description:'描述', icon:'图标', category:'分类', difficulty:'难度', estimatedMinutes:'预计分钟',
  depthLevel:'层级', positionX:'横向位置', positionY:'纵向位置', orderInLevel:'层内顺序',
  learningObjectives:'学习目标', keyConcepts:'核心概念', recommendedDepth:'学习深度', depthRationale:'深度说明',
  observableEvidence:'验收标准', sourceNodeId:'起点', targetNodeId:'终点', edgeType:'关系类型', label:'标签',
  topic:'主题', difficultyLevel:'难度等级', layoutMode:'布局', name:'名称', color:'颜色', sortOrder:'排序', blockId:'学习块',
  expectedVersion:'笔记版本', markdown:'笔记内容', expectedPercent:'原进度', progressPercent:'新进度',
};
export function approvalSummary(approval:TavernToolApproval):string {
  const target=approval.mapTitle ?? approval.target;
  const heading=approval.destructive ? `请单独确认：${approval.action}（${target}）。确认后才会执行。` : `确认${approval.action}（${target}）？`;
  if(!approval.proposal) return heading;
  const proposal=approval.proposal;
  const changes:string[]=[];
  if(typeof proposal.revision==='number') changes.push(`地图版本：${proposal.revision}`);
  if(typeof proposal.targetId==='string') changes.push(`修改目标：${proposal.targetId}`);
  if(proposal.patch&&typeof proposal.patch==='object'&&!Array.isArray(proposal.patch)) {
    for(const [field,value] of Object.entries(proposal.patch)) {
      changes.push(`${labels[field]??field}：${typeof value==='string'?value:JSON.stringify(value)}`);
    }
  }
  return `${heading}\n\n${changes.join('\n')}`;
}
