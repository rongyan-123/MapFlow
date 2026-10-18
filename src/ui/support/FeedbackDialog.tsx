import {useState} from 'react';
import {useFeedbackHistory,useFeedbackSubmission} from '../../domains/support/useFeedback';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {QueryStatus} from '../QueryStatus';
import {FeedbackRecords} from './FeedbackRecords';
import {FeedbackThread} from './FeedbackThread';

export function FeedbackDialog({accountId,csrfToken,initialFeedbackId,onClose}:{accountId:string;csrfToken:string;initialFeedbackId?:string;onClose:()=>void}){
  const [tab,setTab]=useState(initialFeedbackId?'history':'write');const [selected,setSelected]=useState<string|null>(initialFeedbackId??null);
  const history=useFeedbackHistory(accountId,tab==='history'&&!selected);const submit=useFeedbackSubmission(accountId,csrfToken);
  const [content,setContent]=useState('');const [done,setDone]=useState(false);
  return <Dialog title="意见反馈" onClose={onClose} dismissible={!submit.isPending} className="mf-support-dialog"><div className="mf-stack">
    <div role="tablist" aria-label="反馈分区" className="mf-section-tabs">{[{id:'write',label:'写反馈'},{id:'history',label:'已反馈'}].map(item=><button type="button" role="tab" key={item.id} disabled={submit.isPending} aria-selected={tab===item.id} onClick={()=>{setTab(item.id);setSelected(null);}}>{item.label}</button>)}</div>
    {tab==='write'?<form role="tabpanel" aria-label="写反馈" className="mf-stack" onSubmit={event=>{event.preventDefault();if(!content.trim()||submit.isPending)return;submit.mutate(content,{onSuccess:()=>{setContent('');setDone(true);setTab('history');}});}}><p className="mf-muted">功能建议、遇到的问题，或者任何想说的话。提交后可在“已反馈”中查看处理进展。</p><label className="mf-field">反馈内容<textarea aria-label="反馈内容" required maxLength={2000} rows={5} value={content} disabled={submit.isPending} onChange={event=>setContent(event.target.value)} placeholder="写下你的建议或遇到的问题…" /></label><QueryStatus error={submit.error} /><div className="mf-row mf-row--between mf-wrap"><span className="mf-muted mf-small">{content.length} / 2000</span><Button type="submit" variant="primary" disabled={submit.isPending||!content.trim()}>{submit.isPending?'提交中…':'提交反馈'}</Button></div></form>:<div role="tabpanel" aria-label="已反馈" className="mf-stack">{done&&<p role="status" className="mf-status">反馈已提交。</p>}{selected?<FeedbackThread key={selected} accountId={accountId} feedbackId={selected} csrfToken={csrfToken} onBack={()=>setSelected(null)} />:<><p className="mf-muted mf-small">回复会保留在这里，有新消息时铃铛会出现红点。</p><QueryStatus pending={history.isPending} error={history.error} retry={()=>void history.refetch()} /><FeedbackRecords items={history.data?.pages.flatMap(page=>page.items)??[]} onOpen={setSelected} />{history.isSuccess&&!history.data.pages[0].items.length&&<p className="mf-empty">还没有提交过反馈。</p>}{history.hasNextPage&&<Button disabled={history.isFetchingNextPage} onClick={()=>void history.fetchNextPage()}>查看更多反馈</Button>}</>}</div>}
  </div></Dialog>;
}
