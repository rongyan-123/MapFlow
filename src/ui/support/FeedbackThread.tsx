import {useEffect,useRef,useState} from 'react';
import {useFeedbackDetail,useFeedbackReply,useReadNotifications} from '../../domains/support/useFeedback';
import {Button} from '../Button';
import {QueryStatus} from '../QueryStatus';
import {FeedbackStatus,supportTime} from './FeedbackRecords';

export function FeedbackThread({accountId,feedbackId,csrfToken,admin=false,onBack}:{accountId:string;feedbackId:string;csrfToken:string;admin?:boolean;onBack:()=>void}){
  const detail=useFeedbackDetail(accountId,feedbackId,admin);const read=useReadNotifications(accountId,csrfToken);
  const attempted=useRef(new Set<string>());const summary=detail.data?.pages[0];
  const replies=detail.data?.pages.flatMap(page=>page.replies)??[];const replyIds=replies.map(reply=>'feedback_reply:'+reply.replyId).join('|');
  useEffect(()=>{
    if(admin||!replyIds)return;
    const ids=replyIds.split('|').filter(id=>!attempted.current.has(id));if(!ids.length)return;
    ids.forEach(id=>attempted.current.add(id));read.mutate(ids);
  },[admin,replyIds,read.mutate]);
  return <section className="mf-stack" aria-label="反馈详情"><div className="mf-row mf-row--between mf-wrap"><Button onClick={onBack}>返回反馈列表</Button>{summary&&<FeedbackStatus replyCount={summary.replyCount} />}</div><QueryStatus pending={detail.isPending} error={detail.error} retry={()=>void detail.refetch()} />{summary&&<><article className="mf-feedback-original mf-stack"><div className="mf-row mf-row--between mf-wrap"><strong>{admin?summary.username:'我的反馈'}</strong><time className="mf-muted mf-small" dateTime={summary.createdAt}>{supportTime(summary.createdAt)}</time></div><p className="mf-prewrap">{summary.content}</p></article><div className="mf-section-title"><h3>平台回复</h3><span className="mf-muted mf-small">{summary.replyCount} 条</span></div>{detail.hasNextPage&&<Button disabled={detail.isFetchingNextPage} onClick={()=>void detail.fetchNextPage()}>查看更早回复</Button>}{!replies.length&&<p className="mf-feedback-waiting">反馈已收到，平台回复后会通过消息铃铛提醒你。</p>}<div className="mf-feedback-replies">{[...replies].reverse().map(reply=><article className="mf-feedback-reply mf-stack" key={reply.replyId}><div className="mf-row mf-row--between mf-wrap"><strong>平台回复</strong><time className="mf-muted mf-small" dateTime={reply.createdAt}>{supportTime(reply.createdAt)}</time></div><p className="mf-prewrap">{reply.content}</p></article>)}</div>{!admin&&<QueryStatus error={read.error} retry={()=>read.mutate(replyIds.split('|').filter(Boolean).slice(0,20))} />}{admin&&<ReplyComposer key={feedbackId} accountId={accountId} feedbackId={feedbackId} csrfToken={csrfToken} />}</>}</section>;
}

function ReplyComposer({accountId,feedbackId,csrfToken}:{accountId:string;feedbackId:string;csrfToken:string}){
  const [content,setContent]=useState('');const [sent,setSent]=useState(false);const reply=useFeedbackReply(accountId,feedbackId,csrfToken);
  return <form className="mf-feedback-composer mf-stack" onSubmit={event=>{event.preventDefault();if(!content.trim()||reply.isPending)return;reply.mutate(content,{onSuccess:()=>{setContent('');setSent(true);}});}}><label className="mf-field">回复用户<textarea aria-label="回复用户" rows={4} maxLength={2000} required disabled={reply.isPending} value={content} onChange={event=>{setContent(event.target.value);setSent(false);}} placeholder="说明处理进展，或告诉用户接下来可以怎么做。" /></label><p className="mf-muted mf-small">发送后，用户会在消息铃铛和自己的反馈记录中看到回复。</p><QueryStatus error={reply.error} />{sent&&<p role="status">回复已发送。</p>}<Button type="submit" variant="primary" disabled={reply.isPending||!content.trim()}>{reply.isPending?'发送中…':'发送回复'}</Button></form>;
}
