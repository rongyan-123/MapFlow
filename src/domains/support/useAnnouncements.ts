import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {getAnnouncements,markAnnouncementRead} from '../../api/announcementsClient';
export function useAnnouncements(accountId?:string,csrfToken=''){
  const client=useQueryClient();const key=['announcements',accountId??null];const [dismissed,setDismissed]=useState(false);
  useEffect(()=>setDismissed(false),[accountId]);
  const query=useQuery({queryKey:key,queryFn:getAnnouncements,enabled:!!accountId,staleTime:60_000,retry:false});
  const read=useMutation({mutationFn:(ids:string[])=>Promise.all(ids.map(id=>markAnnouncementRead(id,csrfToken))),onSettled:()=>client.invalidateQueries({queryKey:key})});
  const unreadIds=query.data?.unreadIds??[];const current=query.data?.items.find(item=>item.announcementId===unreadIds[0]);
  return {query,read,current,unreadIds,dismissed,setDismissed};
}
