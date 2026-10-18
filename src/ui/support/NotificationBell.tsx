import {Icon} from '../Icon';
export function NotificationBell({unreadCount=0,onClick,showLabel=false,className=''}:{unreadCount?:number;onClick:()=>void;showLabel?:boolean;className?:string}){
  const label=unreadCount>0?`消息，${unreadCount} 条未读`:'消息';
  return <button type="button" className={`mf-notification-bell ${showLabel?'mf-notification-bell--label':''} ${className}`} aria-label={label} title={label} onClick={onClick}><span className="mf-notification-bell-icon"><Icon name="bell" />{unreadCount>0&&<span className="mf-notification-dot" aria-hidden="true" />}</span>{showLabel&&<><span>消息</span>{unreadCount>0&&<span className="mf-notification-count" aria-hidden="true">{unreadCount>99?'99+':unreadCount}</span>}</>}</button>;
}
