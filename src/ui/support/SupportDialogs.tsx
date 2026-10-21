import {useAnnouncements} from '../../domains/support/useAnnouncements';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {QueryStatus} from '../QueryStatus';
import {NotificationReadButton} from './NotificationReadButton';
import {useReadAllNotifications} from '../../domains/support/useNotificationReads';
export {FeedbackDialog} from './FeedbackDialog';
export function AnnouncementsDialog({accountId,csrfToken,onClose}:{accountId:string;csrfToken:string;onClose:()=>void}){
  const state=useAnnouncements(accountId,csrfToken);
  const allRead=useReadAllNotifications(accountId,csrfToken);
  const busy=state.read.isPending||allRead.isPending;
  const hasUnread=state.query.data?.items.some(announcement=>!announcement.isRead)??false;
  function markOneAnnouncementRead(announcementId:string){allRead.reset();state.read.mutate([announcementId]);}
  function markAllAnnouncementsRead(){state.read.reset();allRead.mutate('announcement');}
  return <Dialog title="全部公告" onClose={onClose} dismissible={!busy} footer={<Button variant="primary" className="mf-notification-read-all" disabled={busy||!hasUnread} onClick={markAllAnnouncementsRead}>{allRead.isPending?'正在标记…':'全部已读'}</Button>}><div className="mf-stack"><QueryStatus pending={state.query.isPending} error={state.query.error??state.read.error} retry={()=>void state.query.refetch()} /><QueryStatus error={allRead.error} />{state.query.data?.items.map(announcement=><article className="mf-card mf-stack" key={announcement.announcementId}><h3>{announcement.title}</h3><p className="mf-muted mf-small">{new Date(announcement.createdAt).toLocaleString('zh-CN')} · {announcement.isRead?'已读':'未读'}</p><p className="mf-prewrap">{announcement.content}</p><NotificationReadButton isRead={announcement.isRead} pending={busy} onRead={()=>markOneAnnouncementRead(announcement.announcementId)} /></article>)}{state.query.isSuccess&&!state.query.data.items.length&&<p className="mf-empty">暂无公告。</p>}</div></Dialog>;
}
