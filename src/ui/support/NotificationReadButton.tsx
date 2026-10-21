import {Button} from '../Button';
import {Icon} from '../Icon';

export function NotificationReadButton({isRead,pending,onRead,className=''}:{isRead:boolean;pending:boolean;onRead:()=>void;className?:string}){
  return <Button variant="quiet" className={`mf-notification-read-control ${className}`} disabled={isRead||pending} onClick={onRead}>
    {isRead&&<Icon name="check" />}{isRead?'已读':'标记已读'}
  </Button>;
}
