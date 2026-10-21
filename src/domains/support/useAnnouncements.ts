import {useQuery} from '@tanstack/react-query';
import {getAnnouncements} from '../../api/announcementsClient';
import {useReadAnnouncements} from './useNotificationReads';
export function useAnnouncements(accountId?:string,csrfToken=''){
  const key=['announcements',accountId??null];
  const query=useQuery({queryKey:key,queryFn:getAnnouncements,enabled:!!accountId,staleTime:60_000,retry:false});
  const read=useReadAnnouncements(accountId??'',csrfToken);
  return {query,read};
}
