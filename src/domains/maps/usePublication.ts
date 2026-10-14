import { useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { executeTreePublication,fetchPublicationStatus,prepareTreePublication } from '../../api/treeLibraryClient';
import type { PublicationPrepare } from './types';

export function usePublication(entry:string,csrfToken:string,onPublished:()=>void){
  const queryClient=useQueryClient();
  const status=useQuery({queryKey:['tree-publication',entry],queryFn:()=>fetchPublicationStatus(entry),retry:false});
  const [prepared,setPrepared]=useState<PublicationPrepare|null>(null);
  const requestId=useRef<string|null>(null);
  const prepare=useMutation({mutationFn:(unpublish:boolean)=>prepareTreePublication(entry,csrfToken,unpublish),onSuccess:receipt=>{requestId.current=crypto.randomUUID();setPrepared(receipt);}});
  const execute=useMutation({mutationFn:()=>executeTreePublication(entry,prepared!.confirmation_token,csrfToken,requestId.current!,prepared!.action==='unpublish'),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['trees','public']});void queryClient.invalidateQueries({queryKey:['tree-publication',entry]});setPrepared(null);onPublished();}});
  return {status,prepared,prepare,execute};
}
