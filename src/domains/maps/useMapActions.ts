import { useEffect,useRef } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { deletePersonalTree,renamePersonalTree,setNodeCompletion,setNodeProgress,setNodeProgressBatch,cancelNodeProgressBatch } from '../../api/treeLibraryClient';
import type { BatchProgressResult,NodeProgressChange,PersonalTreeDetail } from './types';
import { createLearningArea } from '../../api/tavernClient';
import type { LearningArea } from '../conversations/types';
import { PublicUiError } from '../../lib/publicErrors';
type NodeReference={id:string;title:string};
interface Owner{accountId:string;csrfToken:string;entryId?:string;onLearning:(area:LearningArea,node?:NodeReference)=>void;onDeleted:()=>void}
export function useMapActions({accountId,csrfToken,entryId,onLearning,onDeleted}:Owner){
  const client=useQueryClient();const learningLock=useRef(false);
  const origin=useRef({active:true,accountId,entryId});
  if(origin.current.accountId!==accountId||origin.current.entryId!==entryId){origin.current.active=false;origin.current={active:true,accountId,entryId};}
  useEffect(()=>{const current=origin.current;current.active=true;return()=>{current.active=false;};},[accountId,entryId]);
  const ownedEntry=()=>{if(!entryId)throw new PublicUiError('请先选择一张地图。');return entryId;};
  const refresh=()=>client.invalidateQueries({queryKey:['me',accountId,'tree-library']});
  function publishBatch(entry:string,result:BatchProgressResult){
    client.setQueryData<PersonalTreeDetail>(['me',accountId,'tree-library',entry],previous=>{
      if(!previous)return previous;
      const nodes=new Set(previous.graph.nodes.map(node=>node.id));
      const progress=result.node_progress.filter(item=>nodes.has(item.node_id));
      return {...previous,node_progress:progress,completed_node_ids:progress.filter(item=>item.progress_percent===100).map(item=>item.node_id),
        progress_percent:nodes.size?Math.round(progress.reduce((total,item)=>total+item.progress_percent,0)/nodes.size):0};
    });
    void client.invalidateQueries({queryKey:['me',accountId,'tree-library'],exact:true});
  }
  async function saveProgressBatch(changes:NodeProgressChange[],signal:AbortSignal,operationId:string){
    const entry=ownedEntry(),result=await setNodeProgressBatch(entry,changes,operationId,csrfToken,signal);
    publishBatch(entry,result);return result;
  }
  async function cancelProgressBatch(operationId:string,signal:AbortSignal){
    const entry=ownedEntry(),result=await cancelNodeProgressBatch(entry,operationId,csrfToken,signal);
    publishBatch(entry,result);return result;
  }
  const rename=useMutation({mutationFn:(title:string)=>renamePersonalTree(ownedEntry(),title,csrfToken),onSuccess:refresh});
  const removal=useMutation({mutationFn:()=>deletePersonalTree(ownedEntry(),csrfToken),onMutate:()=>origin.current,onSuccess:async(_receipt,_input,source)=>{await refresh();if(source?.active&&origin.current===source)onDeleted();}});
  const completion=useMutation({mutationFn:({nodeId,completed}:{nodeId:string;completed:boolean})=>setNodeCompletion(ownedEntry(),nodeId,completed,csrfToken),onSuccess:refresh});
  const progress=useMutation({mutationFn:({nodeId,percent}:{nodeId:string;percent:number})=>setNodeProgress(ownedEntry(),nodeId,percent,csrfToken),onSuccess:refresh});
  const learning=useMutation({mutationFn:({entry}:{entry:string;node?:NodeReference;source:typeof origin.current})=>createLearningArea(entry,csrfToken),onSuccess:async(area,input)=>{
    if(!input.source.active||origin.current!==input.source)return;
    const key=['me',accountId,'learning','areas'];await client.cancelQueries({queryKey:key,exact:true});
    if(!input.source.active||origin.current!==input.source)return;
    client.setQueryData<LearningArea[]>(key,previous=>[area,...(previous??[]).filter(item=>item.areaId!==area.areaId)]);onLearning(area,input.node);
  },onSettled:()=>{learningLock.current=false;}});
  function openLearning(node?:NodeReference,targetEntry=entryId){if(learningLock.current||!targetEntry)return;learningLock.current=true;learning.mutate({entry:targetEntry,node,source:origin.current});}
  return {rename,removal,completion,progress,learning,openLearning,saveProgressBatch,cancelProgressBatch};
}
