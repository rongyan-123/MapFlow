import { useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import type { Difficulty, WorldConfiguration } from '../../domains/englishWorld/types';
import { difficultyLabels } from './shared';

export function WorldConfigurationDialog({ title = '创建英语世界', busy, onClose, onSubmit, error }: { title?: string; busy: boolean; onClose: () => void; onSubmit: (configuration: WorldConfiguration) => void; error?: string }) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [targetWordCount, setTargetWordCount] = useState(8);
  return <Dialog title={title} onClose={onClose}><form className="mf-stack" onSubmit={event => { event.preventDefault(); if (!busy && topic.trim()) onSubmit({ topic: topic.trim(), difficulty, targetWordCount }); }}>
    <p className="mf-muted">选择一段你想走进的故事。准备完成后，检查通过的版本会保存到你的世界。</p>
    <label className="mf-field">世界题材<textarea required maxLength={2000} rows={3} value={topic} disabled={busy} placeholder="例如：海边灯塔里失踪的一封信" onChange={event => setTopic(event.target.value)} /></label>
    <div className="ew-form-row"><label className="mf-field">英语难度<select value={difficulty} disabled={busy} onChange={event => setDifficulty(event.target.value as Difficulty)}>{Object.entries(difficultyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label className="mf-field">目标词数<input type="number" min={6} max={20} required value={targetWordCount} disabled={busy} onChange={event => setTargetWordCount(Number(event.target.value))} /><small>本次选用 6–20 个目标词。</small></label></div>
    <p className="mf-muted">使用页面中选定的模型与资金通路。实际用量和费用由服务端结算。</p>
    {error && <p role="alert" className="mf-status mf-status--error">{error}</p>}
    <Button type="submit" variant="primary" disabled={busy || !topic.trim() || !Number.isInteger(targetWordCount) || targetWordCount < 6 || targetWordCount > 20}>{busy ? '正在接受请求…' : '确认并开始准备'}</Button>
  </form></Dialog>;
}
