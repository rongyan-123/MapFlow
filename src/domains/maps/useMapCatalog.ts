import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import { fetchPublicTrees,fetchPublicTree,fetchPersonalLibrary,fetchPersonalTree } from '../../api/treeLibraryClient';

export function usePublicCatalog(_accountId:string|undefined,treeId?:string) {
  const catalog=useInfiniteQuery({queryKey:['trees','public'],queryFn:({pageParam})=>fetchPublicTrees({cursor:pageParam,limit:50}),initialPageParam:null as string|null,getNextPageParam:page=>page.next_cursor??undefined,staleTime:5*60_000,retry:false});
  const detail=useQuery({queryKey:['trees','public',treeId],queryFn:()=>fetchPublicTree(treeId!),enabled:!!treeId,staleTime:5*60_000,retry:false});
  const trees=[...new Map((catalog.data?.pages??[]).flatMap(page=>page.trees).map(tree=>[tree.id,tree])).values()];
  const attributions=Object.assign({},...(catalog.data?.pages??[]).map(page=>page.attributions));
  return {catalog,detail,trees,attributions};
}
export function usePersonalCatalog(accountId:string|undefined,entryId?:string) {
  const key=['me',accountId,'tree-library'] as const;
  const catalog=useQuery({queryKey:key,queryFn:fetchPersonalLibrary,enabled:!!accountId,staleTime:30_000,retry:false});
  const owned=catalog.data?.entries.some(entry=>entry.library_entry_id===entryId)===true;
  const detail=useQuery({queryKey:[...key,entryId],queryFn:()=>fetchPersonalTree(entryId!),enabled:!!accountId&&!!entryId&&owned,staleTime:15_000,retry:false});
  return {catalog,detail,owned,key};
}
