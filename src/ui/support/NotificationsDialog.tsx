import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {getNotificationDetail,type NotificationKind} from '../../api/supportClient';
import {useNotifications} from '../../domains/support/useNotifications';
import {supportKey,useReadNotifications} from '../../domains/support/useFeedback';
import {Button} from '../Button';
import {Dialog} from '../Dialog';
import {Icon} from '../Icon';
import {QueryStatus} from '../QueryStatus';
import {supportTime} from './FeedbackRecords';

export function NotificationsDialog({accountId,csrfToken,onClose,onFeedback}:{accountId:string;csrfToken:string;onClose:()=>void;onFeedback:(id?:string)=>void}){
  const [kind,setKind]=useState<NotificationKind>('all');const [selected,setSelected]=useState<string|null>(null);
  const list=useNotifications(accountId,kind);const read=useReadNotifications(accountId,csrfToken);
  return <Dialog title="消息中心" onClose={onClose} className="mf-support-dialog" footer={<div className="mf-row mf-row--between mf-wrap"><span className="mf-muted mf-small">公告与平台回复，都在这里。</span><Button onClick={()=>onFeedback()}>意见反馈</Button></div>}><div className="mf-stack"><div role="tablist" aria-label="消息分类" className="mf-section-tabs">{([{id:'all',label:'全部'},{id:'announcement',label:'公告'},{id:'feedback_reply',label:'反馈回复'}] as const).map(tab=><button type="button" role="tab" key={tab.id} aria-selected={kind===tab.id} onClick={()=>{setKind(tab.id);setSelected(null);}}>{tab.label}</button>)}</div>{selected?<AnnouncementContent key={selected} accountId={accountId} csrfToken={csrfToken} notificationId={selected} onBack={()=>setSelected(null)} />:<div role="tabpanel" aria-label="消息列表" className="mf-stack"><QueryStatus pending={list.isPending} error={list.error??read.error} retry={()=>void list.refetch()} />{list.data?.pages.flatMap(page=>page.items).map(item=><article className={`mf-notification-record ${item.isRead?'':'is-unread'}`} key={item.notificationId}><button type="button" className="mf-notification-open" aria-label={`查看${item.kind==='announcement'?'公告':'反馈回复'}：${item.title}`} onClick={()=>item.kind==='feedback_reply'?onFeedback(item.targetId):setSelected(item.notificationId)}><span className="mf-notification-type"><Icon name={item.kind==='announcement'?'bell':'chat'} /></span><span className="mf-notification-summary"><span className="mf-row mf-row--between mf-wrap"><strong>{item.title}</strong><span className="mf-muted mf-small">{item.isRead?'已读':'未读'}</span></span><span className="mf-notification-preview">{item.preview}</span><time dateTime={item.createdAt} className="mf-muted mf-small">{supportTime(item.createdAt)}</time></span></button>{!item.isRead&&<Button variant="quiet" className="mf-notification-mark" disabled={read.isPending} onClick={()=>read.mutate([item.notificationId])}>标记已读</Button>}</article>)}{list.isSuccess&&!list.data.pages[0].items.length&&<div className="mf-notification-empty"><Icon name="bell" /><h3>暂时没有消息</h3><p>有新公告或反馈回复时，铃铛会提醒你。</p></div>}{list.hasNextPage&&<Button disabled={list.isFetchingNextPage} onClick={()=>void list.fetchNextPage()}>查看更多消息</Button>}</div>}</div></Dialog>;
}

function AnnouncementContent({accountId,csrfToken,notificationId,onBack}:{accountId:string;csrfToken:string;notificationId:string;onBack:()=>void}){
  const detail=useQuery({queryKey:[...supportKey(accountId),'notification-detail',notificationId],queryFn:()=>getNotificationDetail(notificationId),retry:false});
  const read=useReadNotifications(accountId,csrfToken);const attempted=useRef(false);
  useEffect(()=>{if(detail.data&&!attempted.current){attempted.current=true;read.mutate([notificationId]);}},[detail.data,notificationId,read.mutate]);
  return <article className="mf-stack"><div><Button onClick={onBack}>返回消息列表</Button></div><QueryStatus pending={detail.isPending} error={detail.error} retry={()=>void detail.refetch()} />{detail.data&&<><h3>{detail.data.title}</h3><p className="mf-prewrap mf-notification-content">{detail.data.content}</p><QueryStatus error={read.error} retry={()=>read.mutate([notificationId])} /></>}</article>;
}
