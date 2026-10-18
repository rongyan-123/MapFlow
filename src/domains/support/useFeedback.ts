import {useRef} from 'react';
import {useInfiniteQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {getFeedbackDetail,getFeedbackPage,markNotificationsRead,submitFeedbackThread,replyToFeedback} from '../../api/supportClient';
export const supportKey=(accountId:string)=>['support',accountId] as const;
export function useFeedbackHistory(accountId:string,enabled:boolean,adminState?:string){return useInfiniteQuery({queryKey:[...supportKey(accountId),'feedback',adminState??'mine'],queryFn:({pageParam})=>getFeedbackPage(pageParam,adminState),initialPageParam:undefined as string|undefined,getNextPageParam:page=>page.nextCursor??undefined,enabled,refetchInterval:30_000,refetchIntervalInBackground:false,retry:false});}
export function useFeedbackDetail(accountId:string,feedbackId:string,admin=false){return useInfiniteQuery({queryKey:[...supportKey(accountId),'thread',admin,feedbackId],queryFn:({pageParam})=>getFeedbackDetail(feedbackId,pageParam,admin),initialPageParam:undefined as string|undefined,getNextPageParam:page=>page.nextCursor??undefined,refetchInterval:30_000,refetchIntervalInBackground:false,retry:false});}
export function useReadNotifications(accountId:string,csrfToken:string){const client=useQueryClient();return useMutation({mutationFn:async(ids:string[])=>{for(let offset=0;offset<ids.length;offset+=20)await markNotificationsRead(ids.slice(offset,offset+20),csrfToken);},onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:[...supportKey(accountId),'unread']}),client.invalidateQueries({queryKey:[...supportKey(accountId),'notifications']})]);}});}
function useSubmission<T>(accountId:string,send:(content:string,requestId:string)=>Promise<T>){
  const client=useQueryClient();const pending=useRef<{content:string;requestId:string}|null>(null);
  return useMutation({mutationFn:(value:string)=>{const content=value.trim();if(!pending.current||pending.current.content!==content)pending.current={content,requestId:crypto.randomUUID()};return send(content,pending.current.requestId);},onSuccess:()=>{pending.current=null;void client.invalidateQueries({queryKey:supportKey(accountId)});}});
}
export function useFeedbackSubmission(accountId:string,csrfToken:string){return useSubmission(accountId,(content,requestId)=>submitFeedbackThread(content,requestId,csrfToken));}
export function useFeedbackReply(accountId:string,feedbackId:string,csrfToken:string){return useSubmission(accountId,(content,requestId)=>replyToFeedback(feedbackId,content,requestId,csrfToken));}
