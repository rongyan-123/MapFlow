import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {PublicUiError} from '../../lib/publicErrors';
import {createLearningArea} from '../../api/tavernClient';
import type {AgentCompletion} from '../../api/agentExecutionClient';
export function useMapResults({completion,accountId,csrfToken,onNavigate}:{completion:AgentCompletion;accountId:string;csrfToken:string;onNavigate:(address:string)=>void}){
  const client=useQueryClient();
  const [joining,setJoining]=useState<string|null>(null),[error,setError]=useState<unknown>(null);
  const active=useRef<string|null>(null),mounted=useRef(true);
  const scope=JSON.stringify([accountId,completion.conversationId,completion.executionId]);
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(completion.maps.length)void client.invalidateQueries({queryKey:['me',accountId,'tree-library']});
  },[completion.executionId,accountId,client]);
  async function learn(libraryEntryId:string){
    if(active.current)return;active.current=libraryEntryId;setJoining(libraryEntryId);setError(null);
    const originalScope=currentScope.current;
    try{
      const area=await createLearningArea(libraryEntryId,csrfToken);
      if(area.libraryEntryId!==libraryEntryId||!area.available||!/^[0-9a-f-]{36}$/i.test(area.areaId))throw new Error('invalid learning target');
      void client.invalidateQueries({queryKey:['me',accountId,'learning','areas']});
      if(mounted.current&&originalScope===currentScope.current)onNavigate(`/learning?area=${encodeURIComponent(area.areaId)}`);
    }catch{if(mounted.current&&originalScope===currentScope.current)setError(new PublicUiError('暂时无法进入学习，请稍后重试。'));
    }finally{active.current=null;if(mounted.current)setJoining(null);}
  }
  return {joining,error,learn};
}
