import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {PublicUiError} from '../../lib/publicErrors';
import {createLearningArea} from '../../api/tavernClient';
import {buttonClass,ErrorNotice,primaryClass} from '../tavern/TavernUi';
import type {AgentCompletion} from '../../api/agentExecutionClient';

function navigate(address:string){window.history.pushState({},'',address);window.dispatchEvent(new PopStateEvent('popstate'));}
export default function AgentMapResults({completion,accountId,csrfToken,onNavigate=navigate}: {
  completion:AgentCompletion;accountId:string;csrfToken:string;onNavigate?:(address:string)=>void;
}){
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
      void client.invalidateQueries({queryKey:['me',accountId,'learning-areas']});
      if(mounted.current&&originalScope===currentScope.current)onNavigate(`/learning?area=${encodeURIComponent(area.areaId)}`);
    }catch{if(mounted.current&&originalScope===currentScope.current)setError(new PublicUiError('暂时无法进入学习，请稍后重试。'));
    }finally{active.current=null;if(mounted.current)setJoining(null);}
  }
  if(!completion.maps.length)return null;
  return <section aria-label="已保存的地图" className="mx-auto w-full max-w-3xl space-y-3">
    {completion.maps.map(map=><article key={map.libraryEntryId} className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-cyan-400/30 bg-slate-900 p-4">
      <div className="min-w-0 flex-1"><p className="text-xs text-cyan-300">地图已保存</p><h3 className="break-words font-semibold">{map.title}</h3></div>
      <button className={buttonClass} aria-label={`查看 ${map.title}`} onClick={()=>onNavigate(`/maps?entry=${encodeURIComponent(map.libraryEntryId)}`)}>查看地图</button>
      <button className={primaryClass} aria-label={`学习 ${map.title}`} disabled={joining!==null} onClick={()=>void learn(map.libraryEntryId)}>{joining===map.libraryEntryId?'正在进入…':'进入学习'}</button>
    </article>)}
    <ErrorNotice error={error} />
  </section>;
}
