import {useInfiniteQuery,useQuery} from '@tanstack/react-query';
import {getNotificationPage,getUnreadNotificationCount,type NotificationKind} from '../../api/supportClient';
import {supportKey} from './useFeedback';
export function useNotificationCount(accountId?:string){return useQuery({queryKey:[...supportKey(accountId??''),'unread'],queryFn:getUnreadNotificationCount,enabled:!!accountId,staleTime:15_000,refetchInterval:30_000,refetchIntervalInBackground:false,refetchOnWindowFocus:'always',retry:false});}
export function useNotifications(accountId:string,kind:NotificationKind){return useInfiniteQuery({queryKey:[...supportKey(accountId),'notifications',kind],queryFn:({pageParam})=>getNotificationPage(kind,pageParam),initialPageParam:undefined as string|undefined,getNextPageParam:page=>page.nextCursor??undefined,retry:false});}
