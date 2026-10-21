import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {getNotificationDetail,type NotificationKind} from '../../api/supportClient';
import {useNotificationCount,useNotifications} from '../../domains/support/useNotifications';
import {useReadAllNotifications,useReadNotifications} from '../../domains/support/useNotificationReads';
import {supportKey} from '../../domains/support/supportQueries';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {Icon} from '../Icon';
import {QueryStatus} from '../QueryStatus';
import {supportTime} from './FeedbackRecords';
import {NotificationReadButton} from './NotificationReadButton';

export function NotificationsDialog({accountId,csrfToken,onClose,onFeedback}:{accountId:string;csrfToken:string;onClose:()=>void;onFeedback:(id?:string)=>void}){
  const [kind,setKind]=useState<NotificationKind>('all');const [selected,setSelected]=useState<string|null>(null);
  const list=useNotifications(accountId,kind);const read=useReadNotifications(accountId,csrfToken);
  const unread=useNotificationCount(accountId);const allRead=useReadAllNotifications(accountId,csrfToken);
  const noUnread=unread.data===0&&!list.data?.pages.some(page=>page.items.some(item=>!item.isRead));
  function markMessageRead(notificationId:string){allRead.reset();read.mutate([notificationId]);}
  function markEveryMessageRead(){read.reset();allRead.mutate('all');}
  return <Dialog title="消息中心" onClose={onClose} dismissible={!allRead.isPending&&!read.isPending} className="mf-support-dialog" footer={<div className="mf-row mf-row--between mf-wrap mf-notification-footer"><Button variant="primary" className="mf-notification-read-all" disabled={list.isPending||allRead.isPending||read.isPending||noUnread} onClick={markEveryMessageRead}>{allRead.isPending?'正在标记…':'全部已读'}</Button><Button onClick={()=>onFeedback()}>意见反馈</Button></div>}><div className="mf-stack"><QueryStatus error={allRead.error} /><div role="tablist" aria-label="消息分类" className="mf-section-tabs">{([{id:'all',label:'全部'},{id:'announcement',label:'公告'},{id:'feedback_reply',label:'反馈回复'}] as const).map(tab=><button type="button" role="tab" key={tab.id} aria-selected={kind===tab.id} onClick={()=>{setKind(tab.id);setSelected(null);}}>{tab.label}</button>)}</div>{selected?<AnnouncementContent key={selected} accountId={accountId} csrfToken={csrfToken} notificationId={selected} onBack={()=>setSelected(null)} />:<div role="tabpanel" aria-label="消息列表" className="mf-stack"><QueryStatus pending={list.isPending} error={list.error??read.error} retry={()=>void list.refetch()} />{list.data?.pages.flatMap(page=>page.items).map(item=><article className={`mf-notification-record ${item.isRead?'':'is-unread'}`} key={item.notificationId}><button type="button" className="mf-notification-open" aria-label={`查看${item.kind==='announcement'?'公告':'反馈回复'}：${item.title}`} onClick={()=>item.kind==='feedback_reply'?onFeedback(item.targetId):setSelected(item.notificationId)}><span className="mf-notification-type"><Icon name={item.kind==='announcement'?'bell':'chat'} /></span><span className="mf-notification-summary"><span className="mf-row mf-row--between mf-wrap"><strong>{item.title}</strong><span className="mf-muted mf-small">{item.isRead?'已读':'未读'}</span></span><span className="mf-notification-preview">{item.preview}</span><time dateTime={item.createdAt} className="mf-muted mf-small">{supportTime(item.createdAt)}</time></span></button><NotificationReadButton className="mf-notification-mark" isRead={item.isRead} pending={read.isPending||allRead.isPending} onRead={()=>markMessageRead(item.notificationId)} /></article>)}{list.isSuccess&&!list.data.pages[0].items.length&&<div className="mf-notification-empty"><Icon name="bell" /><h3>暂时没有消息</h3><p>有新公告或反馈回复时，铃铛会提醒你。</p></div>}{list.hasNextPage&&<Button disabled={list.isFetchingNextPage} onClick={()=>void list.fetchNextPage()}>查看更多消息</Button>}</div>}</div></Dialog>;
}

function AnnouncementContent({accountId,csrfToken,notificationId,onBack}:{accountId:string;csrfToken:string;notificationId:string;onBack:()=>void}){
  const detail=useQuery({queryKey:[...supportKey(accountId),'notification-detail',notificationId],queryFn:()=>getNotificationDetail(notificationId),retry:false});
  const read=useReadNotifications(accountId,csrfToken);const attempted=useRef(false);
  useEffect(()=>{if(detail.data&&!attempted.current){attempted.current=true;read.mutate([notificationId]);}},[detail.data,notificationId,read.mutate]);
  return <article className="mf-stack"><div><Button onClick={onBack}>返回消息列表</Button></div><QueryStatus pending={detail.isPending} error={detail.error} retry={()=>void detail.refetch()} />{detail.data&&<><h3>{detail.data.title}</h3><p className="mf-prewrap mf-notification-content">{detail.data.content}</p><QueryStatus error={read.error} retry={()=>read.mutate([notificationId])} /></>}</article>;
}
