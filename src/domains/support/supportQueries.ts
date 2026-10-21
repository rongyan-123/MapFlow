import type {QueryClient} from '@tanstack/react-query';

export const supportKey=(accountId:string)=>['support',accountId] as const;

export function refreshNotificationReads(client:QueryClient,accountId:string){
  return Promise.all([
    client.invalidateQueries({queryKey:[...supportKey(accountId),'unread']}),
    client.invalidateQueries({queryKey:[...supportKey(accountId),'notifications']}),
    client.invalidateQueries({queryKey:['announcements',accountId]}),
  ]);
}
