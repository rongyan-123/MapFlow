import {useAnnouncements} from '../../domains/support/useAnnouncements';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {QueryStatus} from '../QueryStatus';
export {FeedbackDialog} from './FeedbackDialog';
export function AnnouncementsDialog({accountId,csrfToken,onClose}:{accountId:string;csrfToken:string;onClose:()=>void}){
  const state=useAnnouncements(accountId,csrfToken);
  return <Dialog title="全部公告" onClose={onClose} dismissible={!state.read.isPending}><div className="mf-stack"><QueryStatus pending={state.query.isPending} error={state.query.error??state.read.error} retry={()=>void state.query.refetch()} />{state.query.data?.items.map(announcement=><article className="mf-card mf-stack" key={announcement.announcementId}><h3>{announcement.title}</h3><p className="mf-muted mf-small">{new Date(announcement.createdAt).toLocaleString('zh-CN')} · {announcement.isRead?'已读':'未读'}</p><p className="mf-prewrap">{announcement.content}</p>{!announcement.isRead&&<Button disabled={state.read.isPending} onClick={()=>state.read.mutate([announcement.announcementId])}>标记已读</Button>}</article>)}{state.query.isSuccess&&!state.query.data.items.length&&<p className="mf-empty">暂无公告。</p>}</div></Dialog>;
}
