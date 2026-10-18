import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {getAnnouncements,markAnnouncementRead} from '../../api/announcementsClient';
import {supportKey} from './useFeedback';
export function useAnnouncements(accountId?:string,csrfToken=''){
  const client=useQueryClient();const key=['announcements',accountId??null];
  const query=useQuery({queryKey:key,queryFn:getAnnouncements,enabled:!!accountId,staleTime:60_000,retry:false});
  const read=useMutation({mutationFn:(ids:string[])=>Promise.all(ids.map(id=>markAnnouncementRead(id,csrfToken))),onSettled:()=>Promise.all([client.invalidateQueries({queryKey:key}),client.invalidateQueries({queryKey:[...supportKey(accountId??''),'unread']}),client.invalidateQueries({queryKey:[...supportKey(accountId??''),'notifications']})])});
  return {query,read};
}
