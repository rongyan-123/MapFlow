import { useState } from 'react';
import { useMapLearningState } from '../../domains/maps/useMapLearningState';
import type { LearningTreeSnapshot } from '../../types/learning';
import { progressPercentForNode } from '../../types/learning';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import NodeNoteDialog from './NodeNoteDialog';
import StudyPlanDialog from './StudyPlanDialog';

export function LearningResources({ tab, accountId, entryId, csrfToken, snapshot, selectedNodeId, onSelectNode }: {
  tab: 'notes' | 'plan'; accountId: string; entryId: string; csrfToken: string; snapshot: LearningTreeSnapshot;
  selectedNodeId?: string; onSelectNode: (node: { id: string; title: string }) => void;
}) {
  const state = useMapLearningState(accountId, entryId, csrfToken);
  const [planning, setPlanning] = useState(false);
  const node = snapshot.nodes.find(item => item.id === selectedNodeId);
  const progress = new Map(snapshot.progress.map(item => [item.node_id, progressPercentForNode(item)]));
  if (tab === 'notes') return <section className="mf-stack" aria-label="当前知识点笔记"><h2>笔记</h2>
    <label className="mf-field">知识点<select aria-label="笔记知识点" value={node?.id ?? ''} onChange={event => { const selected = snapshot.nodes.find(item => item.id === event.target.value); if (selected) onSelectNode(selected); }}><option value="" disabled>选择一个知识点</option>{snapshot.nodes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    {node ? <NodeNoteDialog embedded accountId={accountId} libraryEntryId={entryId} nodeId={node.id} nodeTitle={node.title} csrfToken={csrfToken} onClose={() => {}} /> : <p className="mf-muted">选择地图上的知识点，或从上方选择，查看和编辑对应笔记。</p>}
  </section>;
  const plan = state.plan.data?.plan;
  return <section className="mf-stack" aria-label="当前地图的学习计划"><div className="mf-row mf-row--between"><h2>学习计划</h2><Button disabled={!state.plan.isSuccess} onClick={() => setPlanning(true)}>{plan ? '调整安排' : '制定计划'}</Button></div>
    {state.plan.isPending && <p role="status">正在读取学习计划…</p>}
    {!!state.plan.error && <p role="alert">{describePublicError(state.plan.error)} <Button onClick={() => void state.plan.refetch()}>重试</Button></p>}
    {state.plan.data?.task && !state.plan.data.task.accepted && <div className="mf-status"><p>计划任务：{({ queued: '等待生成', running: '正在生成', recovering: '正在恢复', awaiting_reconciliation: '等待核对', failed: '未完成，原计划保留', stopped: '已停止' } as Record<string, string>)[state.plan.data.task.state] ?? '正在保存'}</p><Button onClick={() => setPlanning(true)}>查看任务</Button></div>}
    {plan ? <><p className="mf-muted">{plan.startDate} 至 {plan.deadline} · {plan.timezone}</p><p>{plan.summary}</p>{plan.days.map(day => <section className="mf-learning-plan-day" key={day.date}><h3>{day.date}</h3>{day.items.map(item => { const plannedNode = snapshot.nodes.find(candidate => candidate.id === item.nodeId); return <div className="mf-learning-plan-item" key={`${item.nodeId}.${item.partIndex}`}><Button variant="quiet" disabled={!plannedNode} onClick={() => plannedNode && onSelectNode(plannedNode)}>{plannedNode?.title ?? '知识点已不可用'}</Button><small className="mf-muted">约 {item.estimatedMinutes} 分钟 · {progress.get(item.nodeId) ?? 0}%{item.partCount > 1 ? ` · 第 ${item.partIndex}/${item.partCount} 段` : ''}</small><p>{item.focus}</p></div>; })}</section>)}</> : state.plan.isSuccess && <p className="mf-muted">还没有学习计划。可以根据这张地图和你的时间安排学习。</p>}
    {planning && state.plan.data && <StudyPlanDialog accountId={accountId} entryId={entryId} csrfToken={csrfToken} title={snapshot.tree.title} total={snapshot.nodes.length} remaining={snapshot.nodes.filter(item => (progress.get(item.id) ?? 0) < 100).length} state={state.plan.data} onChanged={() => void state.plan.refetch()} onClose={() => setPlanning(false)} />}
  </section>;
}
