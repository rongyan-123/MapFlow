import {useRef} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {markAnnouncementRead} from '../../api/announcementsClient';
import {markAllNotificationsRead,markNotificationsRead,type NotificationKind} from '../../api/supportClient';
import {refreshNotificationReads} from './supportQueries';

function useNotificationReadAction<Argument>(accountId:string,send:(argument:Argument)=>Promise<void>){
  const client=useQueryClient();
  const pendingRequests=useRef(new Map<string,Promise<void>>());
  return useMutation({
    mutationFn:(argument:Argument)=>{
      const requestKey=JSON.stringify([accountId,argument]);
      const existing=pendingRequests.current.get(requestKey);
      if(existing)return existing;
      const request=Promise.resolve().then(()=>send(argument)).finally(()=>pendingRequests.current.delete(requestKey));
      pendingRequests.current.set(requestKey,request);
      return request;
    },
    onSettled:()=>refreshNotificationReads(client,accountId),
  });
}

export function useReadNotifications(accountId:string,csrfToken:string){
  return useNotificationReadAction(accountId,async(ids:string[])=>{
    for(let offset=0;offset<ids.length;offset+=20)await markNotificationsRead(ids.slice(offset,offset+20),csrfToken);
  });
}

export function useReadAnnouncements(accountId:string,csrfToken:string){
  return useNotificationReadAction(accountId,async(ids:string[])=>{
    await Promise.all(ids.map(id=>markAnnouncementRead(id,csrfToken)));
  });
}

export function useReadAllNotifications(accountId:string,csrfToken:string){
  return useNotificationReadAction(accountId,(kind:NotificationKind)=>markAllNotificationsRead(kind,csrfToken));
}
