import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDueReviews } from '../../api/englishWorldClient';
import { useWorldOperation } from '../../domains/englishWorld/operations';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { DueList, ReviewItem, ReviewModality, ReviewResult } from '../../domains/englishWorld/types';
import { Button } from '../Button';
import { QueryStatus } from '../QueryStatus';
import { OperationNotice, type WorldPageContext } from './shared';

const ratingLabels = ['忘记了', '想得很吃力', '想起来了', '很轻松'];
const directionLabels = { reading: '阅读识别', writing: '主动表达' };
export function ReviewWorkspace({ context }: { context: WorldPageContext }) {
  const queryClient = useQueryClient();
  const due = useQuery({ queryKey: worldKeys.due(context.accountId), queryFn: ({ signal }) => fetchDueReviews(signal), retry: false });
  const issue = useWorldOperation(context.accountId, 'review.issue', context.csrfToken);
  const submission = useWorldOperation(context.accountId, 'review.submit', context.csrfToken);
  const [direction, setDirection] = useState<ReviewModality | null>(null);
  const [answer, setAnswer] = useState('');
  const [rating, setRating] = useState<1 | 2 | 3 | 4>(3);
  const [usedHint, setUsedHint] = useState(false);
  const item: ReviewItem | null = issue.result && 'prompt' in issue.result ? issue.result : null;
  const result: ReviewResult | null = item && submission.result && 'rating' in submission.result && submission.result.reviewItemId === item.reviewItemId ? submission.result : null;
  const busy = issue.busy || submission.busy || !!issue.pending || !!submission.pending;
  const candidates = due.data?.items.filter(candidate => candidate.modality === direction) ?? [];
  const expired = !!item && Date.parse(item.expiresAt) <= Date.now();
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: worldKeys.due(context.accountId) });
    void queryClient.invalidateQueries({ queryKey: worldKeys.worlds(context.accountId) });
    void queryClient.invalidateQueries({ queryKey: [...worldKeys.root(context.accountId), 'words'] });
  }
  async function start(candidate: DueList['items'][number]) {
    const next = await issue.perform('/reviews/items', { learnerWordId: candidate.learnerWordId, modality: candidate.modality }, 'reviewItem');
    if (next) { submission.clear(); setAnswer(''); setRating(3); setUsedHint(false); }
  }
  async function submit() {
    if (!item || busy || result || expired || !answer.trim()) return;
    const recorded = await submission.perform('/reviews', { reviewItemId: item.reviewItemId, answer: answer.trim(), rating, usedHint }, 'reviewResult');
    if (recorded) refresh();
  }
  function back() { if (busy) return; issue.clear(); submission.clear(); setAnswer(''); refresh(); }
  return <div className="mf-content"><div className="mf-page ew-review-page"><section className="ew-intro"><div><p className="mf-eyebrow">RECALL, THEN REVEAL</p><h2>先回忆，再看答案。</h2><p>阅读识别和主动表达分别记录。用自己的感受自评，并如实标记是否看过提示。</p></div></section>
    <OperationNotice operation={issue} apiKey={context.apiKey} /><OperationNotice operation={submission} apiKey={context.apiKey} onResult={response => { if ('rating' in response) refresh(); }} />
    {item ? <section className="ew-review-card"><div className="ew-card-meta"><span className="ew-tag">{directionLabels[item.modality]}</span><span>自评复习</span></div><h3 lang={item.modality === 'reading' ? 'en' : undefined}>{item.modality === 'reading' ? item.lemma : '回忆英文表达'}</h3><p className="ew-review-prompt">{item.prompt}</p>
      {result ? <div className="ew-stack"><p role="status">{result.counted ? '本次回忆已记录。' : '已读取原提交结果，未重复记录。'}</p><p className="ew-word-meaning">{result.glossZh ?? '本次未开放额外释义。'}</p><p>自评：{ratingLabels[result.rating - 1]}</p><p>下次复习：{new Date(result.dueAt).toLocaleString('zh-CN')}</p><Button onClick={back}>返回待复习列表</Button></div>
        : expired ? <div className="ew-stack"><p role="alert">题目已过期，请返回列表重新开始。</p><Button disabled={busy} onClick={back}>返回待复习列表</Button></div>
        : <form className="ew-stack" onSubmit={event => { event.preventDefault(); void submit(); }}><label className="mf-field">你的回忆<textarea required rows={3} maxLength={4000} value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} placeholder={item.modality === 'reading' ? '用自己的话写出你回忆到的意思' : '用英文写一句你的表达'} /></label><fieldset className="ew-rating" disabled={busy}><legend>这次回忆有多顺利？</legend>{ratingLabels.map((label, index) => <label key={label}><input type="radio" name="review-rating" value={index + 1} checked={rating === index + 1} onChange={() => setRating(index + 1 as 1 | 2 | 3 | 4)} />{label}</label>)}</fieldset><label className="ew-hint"><input type="checkbox" checked={usedHint} disabled={busy} onChange={event => setUsedHint(event.target.checked)} />本次看过提示或词义</label><p className="mf-muted">使用提示的情况会和原作答一起保存；普通遇见与查词不会当作成功回忆。</p><Button type="submit" variant="primary" disabled={busy || !answer.trim()}>提交本次回忆</Button><Button disabled={busy} onClick={back}>返回待复习列表</Button></form>}
    </section> : <section className="ew-section ew-stack"><h2>待复习词语{due.data ? ` · ${due.data.dueCount}` : ''}</h2><QueryStatus pending={due.isPending} error={due.error} retry={() => void due.refetch()} />
      {due.data && !due.data.items.length && <div className="ew-empty"><h3>现在没有到期的词。</h3><p>下次到期后再来，也可以继续在故事中遇见新词。</p><Button onClick={() => context.navigate('/english-world')}>回到我的世界</Button></div>}
      {due.data && !!due.data.items.length && !direction && <><p>先选择这次练习的能力方向。</p><div className="ew-world-grid">{(['reading', 'writing'] as const).map(modality => <article className="ew-world-card" key={modality}><h3>{directionLabels[modality]}</h3><p>{modality === 'reading' ? '看英文，回忆它在语境中的意思。' : '看中文提示，自己回忆英文表达。'}</p><Button disabled={busy} onClick={() => setDirection(modality)}>选择{directionLabels[modality]}</Button></article>)}</div></>}
      {direction && <><div className="mf-row mf-wrap"><span className="ew-tag">{directionLabels[direction]}</span><Button disabled={busy} onClick={() => setDirection(null)}>重新选择能力方向</Button></div>{due.data && !!due.data.items.length && !candidates.length && <p>这项能力现在没有到期的词，可以选择另一项。</p>}<div className="ew-world-grid">{candidates.map((candidate, index) => <article className="ew-world-card" key={candidate.learnerWordId + '.' + candidate.modality}><span className="ew-tag">{directionLabels[candidate.modality]}</span><h3 lang={candidate.modality === 'reading' ? 'en' : undefined}>{candidate.modality === 'reading' ? candidate.lemma : `表达复习 ${index + 1}`}</h3><Button aria-label={candidate.modality === 'reading' ? `开始阅读复习 ${candidate.lemma}` : `开始表达复习 第 ${index + 1} 题`} disabled={busy} onClick={() => void start(candidate)}>开始{candidate.modality === 'reading' ? '阅读' : '表达'}复习</Button></article>)}</div></>}
    </section>}
  </div></div>;
}
