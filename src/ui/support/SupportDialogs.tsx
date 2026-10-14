import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {submitFeedback} from '../../api/feedbackClient';
import {useAnnouncements} from '../../domains/support/useAnnouncements';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {QueryStatus} from '../QueryStatus';
export function FeedbackDialog({csrfToken,onClose}:{csrfToken:string;onClose:()=>void}){
  const [content,setContent]=useState('');const [done,setDone]=useState(false);const submit=useMutation({mutationFn:()=>submitFeedback(content.trim(),csrfToken),onSuccess:()=>{setContent('');setDone(true);}});
  return <Dialog title="意见反馈" onClose={onClose} dismissible={!submit.isPending}>{done?<p role="status" className="mf-status">反馈已提交。</p>:<form className="mf-stack" onSubmit={event=>{event.preventDefault();if(content.trim()&&!submit.isPending)submit.mutate();}}><p className="mf-muted mf-small">功能建议、遇到的问题，或者任何想说的话。</p><label className="mf-field">反馈内容<textarea aria-label="反馈内容" required maxLength={2000} rows={5} value={content} disabled={submit.isPending} onChange={event=>setContent(event.target.value)} placeholder="写点什么…" /></label><QueryStatus error={submit.error} /><Button type="submit" variant="primary" disabled={submit.isPending||!content.trim()}>{submit.isPending?'提交中…':'提交反馈'}</Button></form>}</Dialog>;
}
export function AnnouncementsDialog({accountId,csrfToken,onClose}:{accountId:string;csrfToken:string;onClose:()=>void}){
  const state=useAnnouncements(accountId,csrfToken);
  return <Dialog title="全部公告" onClose={onClose} dismissible={!state.read.isPending}><div className="mf-stack"><QueryStatus pending={state.query.isPending} error={state.query.error??state.read.error} retry={()=>void state.query.refetch()} />{state.query.data?.items.map(announcement=><article className="mf-card mf-stack" key={announcement.announcementId}><h3>{announcement.title}</h3><p className="mf-muted mf-small">{new Date(announcement.createdAt).toLocaleString('zh-CN')} · {announcement.isRead?'已读':'未读'}</p><p className="mf-prewrap">{announcement.content}</p>{!announcement.isRead&&<Button disabled={state.read.isPending} onClick={()=>state.read.mutate([announcement.announcementId])}>标记已读</Button>}</article>)}{state.query.isSuccess&&!state.query.data.items.length&&<p className="mf-empty">暂无公告。</p>}</div></Dialog>;
}
export function UnreadAnnouncements({accountId,csrfToken,suppressed=false}:{accountId?:string;csrfToken?:string;suppressed?:boolean}){
  const state=useAnnouncements(accountId,csrfToken);if(suppressed||state.dismissed||!state.current)return null;
  return <Dialog title={state.current.title} onClose={()=>state.setDismissed(true)} dismissible={!state.read.isPending}><div className="mf-stack"><p className="mf-prewrap">{state.current.content}</p><QueryStatus error={state.read.error} /><div className="mf-row mf-wrap"><Button variant="primary" disabled={state.read.isPending} onClick={()=>state.read.mutate([state.current!.announcementId])}>知道了</Button>{state.unreadIds.length>1&&<Button disabled={state.read.isPending} onClick={()=>state.read.mutate(state.unreadIds)}>全部已读</Button>}</div></div></Dialog>;
}
