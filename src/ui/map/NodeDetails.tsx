import { useEffect, useRef, useState, type RefObject } from 'react';
import { DEPTH_LABELS } from '../../lib/constants';
import { progressPercentForNode, type LearningTreeSnapshot, type TreeDisplayMode } from '../../types/learning';
import { Button } from '../Button';
import SafeMarkdown from '../SafeMarkdown';

interface Props {
  snapshot: LearningTreeSnapshot;
  selectedNodeId: string | null;
  displayMode: TreeDisplayMode;
  onSetCompleted?: (id: string, done: boolean) => void;
  completionPending?: boolean;
  onSetProgress?: (id: string, percent: number) => void;
  progressPending?: boolean;
  completionButtonRef?: RefObject<HTMLButtonElement>;
  onOpenChat?: () => void;
  onOpenNote?: () => void;
  onTogglePanel?: () => void;
}

function TextList({ text }: { text: string | null }) {
  if (!text) return null;
  let lines: string[] = [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) lines = parsed.filter((line): line is string => typeof line === 'string');
  } catch { /* Plain text is also a valid node description. */ }
  return lines.length ? <ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul> : <SafeMarkdown markdown={text} />;
}

export default function NodeDetails(props: Props) {
  const node = props.snapshot.nodes.find(item => item.id === props.selectedNodeId);
  const progress = props.snapshot.progress.find(item => item.node_id === node?.id);
  const percent = progressPercentForNode(progress);
  const [detailed, setDetailed] = useState(false);
  const [input, setInput] = useState(String(percent));
  const [error, setError] = useState<string | null>(null);
  const progressInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setInput(String(percent)); setError(null); }, [node?.id, percent]);
  useEffect(() => {
    if (!detailed) return;
    progressInput.current?.focus();
    progressInput.current?.scrollIntoView?.({ block: 'nearest' });
  }, [detailed]);
  const busy = props.completionPending || props.progressPending;
  if (!node) return <p className="mf-status">点击节点查看学习目标与掌握证据</p>;
  const completed = percent === 100;
  const prerequisites = props.snapshot.edges.filter(edge => edge.target_node_id === node.id)
    .map(edge => props.snapshot.nodes.find(item => item.id === edge.source_node_id))
    .filter(item => item !== undefined).slice(0, 5);

  return <section className="mf-node-details">
    <div className="mf-node-detail-scroll" role="region" aria-label="节点内容" tabIndex={0}>
      <h2 className="mf-node-detail-title">{node.title}</h2>
      <div className="mf-row mf-wrap mf-node-detail-meta">
        <span className="mf-pill">{node.category}</span>
        <span className="mf-pill mf-pill--green">{DEPTH_LABELS[node.recommended_depth]} · {node.recommended_depth}</span>
        <span className="mf-pill">约 {node.estimated_minutes} 分钟</span>
      </div>
      {props.displayMode === 'personal' && detailed && <div className="mf-node-progress-form">
        <label className="mf-field">节点完成百分比<input ref={progressInput} type="number" min={0} max={100} step={1}
          value={input} disabled={busy} onChange={event => { setInput(event.target.value); setError(null); }} /></label>
        <Button disabled={busy} onClick={() => {
          const value = Number(input.trim());
          if (!input.trim() || !Number.isInteger(value) || value < 0 || value > 100) {
            setError('请输入 0–100 的整数。');
            return;
          }
          props.onSetProgress?.(node.id, value);
        }}>保存详细进度</Button>
        {error && <p role="alert" className="mf-status mf-status--error">{error}</p>}
      </div>}
      {node.description && <SafeMarkdown markdown={node.description} />}
      {node.learning_objectives && <div><h3>学习目标</h3><TextList text={node.learning_objectives} /></div>}
      {node.key_concepts && <div><h3>关键概念</h3><TextList text={node.key_concepts} /></div>}
      <div><h3>为什么学到这个深度</h3><SafeMarkdown markdown={node.depth_rationale} /></div>
      <div><h3>掌握证据</h3><TextList text={node.observable_evidence} /></div>
      {prerequisites.length > 0 && <div><h3>直接前置节点</h3><div className="mf-row mf-wrap">{prerequisites.map(item => <span className="mf-pill" key={item.id}>{item.title}</span>)}</div></div>}
    </div>
    {props.displayMode === 'personal' && <div className="mf-node-detail-actions" role="group" aria-label="节点操作">
      <div className="mf-node-detail-primary"><span className="mf-node-detail-progress">学习进度<strong>{percent}%</strong></span>
        {props.onSetCompleted && <button type="button" ref={props.completionButtonRef} className="mf-button mf-button--primary" disabled={busy}
          onClick={() => props.onSetCompleted!(node.id, !completed)}>{props.completionPending ? '正在保存…' : completed ? '取消完成' : '标记为已完成'}</button>}
      </div>
      <div className="mf-node-detail-secondary">
        {props.onSetProgress && <Button variant="quiet" disabled={busy} aria-expanded={detailed}
          onClick={() => { setDetailed(!detailed); setError(null); }}>{detailed ? '收起详细进度' : '填写详细进度'}</Button>}
        {props.onOpenChat && <Button variant="quiet" onClick={props.onOpenChat} aria-label="进入学习区，向 AI 提问">向助手提问</Button>}
        {props.onOpenNote && <Button variant="quiet" onClick={props.onOpenNote}>节点笔记</Button>}
      </div>
    </div>}
  </section>;
}
