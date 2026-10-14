import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {createLearningArea,fetchLearningAreas} from '../../api/tavernClient';
import {usePersonalCatalog} from '../maps/useMapCatalog';
import type {LearningArea} from '../conversations/types';
export function useLearningWorkspace(accountId:string,csrfToken:string,requestedAreaId?:string){
  const storageKey=`mapflow.learning.area.v1.${accountId}`;const client=useQueryClient();
  const [selection,setSelection]=useState<string|null>(()=>{try{return requestedAreaId??localStorage.getItem(storageKey);}catch{return requestedAreaId??null;}});
  const [mapVisible,setMapVisible]=useState(false);
  useEffect(()=>{setSelection(requestedAreaId??null);setMapVisible(false);},[requestedAreaId]);
  const areasKey=['me',accountId,'learning','areas'] as const;
  const areas=useQuery({queryKey:areasKey,queryFn:({signal})=>fetchLearningAreas(signal),staleTime:30_000,retry:false});
  const area=areas.data?.find(item=>item.areaId===selection);
  const maps=usePersonalCatalog(accountId,area?.available?area.libraryEntryId:undefined);
  function select(areaId:string|null){setSelection(areaId);setMapVisible(false);try{if(areaId)localStorage.setItem(storageKey,areaId);else localStorage.removeItem(storageKey);}catch{/* Optional preference; server membership controls access. */}}
  const creation=useMutation({mutationFn:(entryId:string)=>createLearningArea(entryId,csrfToken),onSuccess:async(saved)=>{
    await client.cancelQueries({queryKey:areasKey,exact:true});client.setQueryData<LearningArea[]>(areasKey,previous=>[saved,...(previous??[]).filter(item=>item.areaId!==saved.areaId)]);select(saved.areaId);
  }});
  const canCreate=areas.isSuccess&&maps.catalog.isSuccess&&!creation.isPending&&area?.available!==false;
  return {areas,area,maps,canCreate,creation,select,mapVisible,setMapVisible};
}
