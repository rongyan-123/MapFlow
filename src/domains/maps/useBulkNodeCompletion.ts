import { useEffect,useRef,useState } from 'react';
import { progressPercentForNode,type LearningTreeSnapshot } from '../../types/learning';
import { describePublicError,PublicUiError } from '../../lib/publicErrors';
import type { BatchProgressResult,NodeProgressChange } from './types';

interface SavedProgress { nodeId:string;percent:number }
export type SaveBatchProgress=(changes:NodeProgressChange[],signal:AbortSignal,operationId:string)=>Promise<BatchProgressResult>;
export type CancelBatchProgress=(operationId:string,signal:AbortSignal)=>Promise<BatchProgressResult>;
interface Flight {
 id:string;undo:boolean;controller:AbortController;before:SavedProgress[];after:SavedProgress[];
 cancel:CancelBatchProgress;cancelRequested:boolean;failure?:string;preservedChanges:boolean;
}
interface Owner {
 key?:string;active:boolean;phase:'idle'|'saving'|'checking'|'uncertain';entries:SavedProgress[];
 notice:string;error:string;flight?:Flight;
 overlay?:{base:LearningTreeSnapshot['progress'];values:LearningTreeSnapshot['progress']};
}
interface Props {
 snapshot:LearningTreeSnapshot;storageKey?:string;blocked:boolean;
 onSetBatchProgress?:SaveBatchProgress;onCancelBatchProgress?:CancelBatchProgress;onBusyChange:(busy:boolean)=>void;
}
function readProgress(key:string|undefined,snapshot:LearningTreeSnapshot):SavedProgress[] {
 if(!key)return [];
 try {
  const saved:unknown=JSON.parse(localStorage.getItem(key)??'null');
  if(!Array.isArray(saved))return [];
  const nodes=new Set(snapshot.nodes.map(node=>node.id)),seen=new Set<string>();
  return saved.filter((entry):entry is SavedProgress=>{
   if(!entry||typeof entry!=='object'||typeof entry.nodeId!=='string'||!nodes.has(entry.nodeId)||seen.has(entry.nodeId)
    ||!Number.isInteger(entry.percent)||entry.percent<0||entry.percent>=100)return false;
   seen.add(entry.nodeId);return true;
  });
 } catch{return [];}
}

/** Save one atomic batch; the original percentages also recover earlier v1 undo journals. */
export function useBulkNodeCompletion({snapshot,storageKey,blocked,onSetBatchProgress,onCancelBatchProgress,onBusyChange}:Props) {
 const owner=useRef<Owner>();
 if(!owner.current||owner.current.key!==storageKey){
  if(owner.current)owner.current.active=false;
  owner.current={key:storageKey,active:true,phase:'idle',entries:readProgress(storageKey,snapshot),notice:'',error:''};
 }
 const [view,setView]=useState(()=>({...owner.current!}));
 const current=view.key===storageKey?view:owner.current;
 useEffect(()=>{
  const source=owner.current!;source.active=true;setView({...source});
  return ()=>{
   source.active=false;
   if(source.flight){source.flight.controller.abort();void source.flight.cancel(source.flight.id,new AbortController().signal).catch(()=>{});}
  };
 },[storageKey]);
 function publish(source:Owner){if(source.active&&owner.current===source)setView({...source});}
 function checkpoint(source:Owner,entries:SavedProgress[]){
  if(!source.key)return;
  try{if(entries.length)localStorage.setItem(source.key,JSON.stringify(entries));else localStorage.removeItem(source.key);}
  catch{throw new PublicUiError('无法保存撤销记录，请检查浏览器存储后重试。');}
  source.entries=entries;publish(source);
 }
 function progressFor(source:Owner){return source.overlay?.base===snapshot.progress?source.overlay.values:snapshot.progress;}
 function settle(source:Owner,flight:Flight,result:BatchProgressResult){
  if(source.flight!==flight)return;
  checkpoint(source,result.status==='cancelled'?flight.before:flight.after);
  source.overlay={base:snapshot.progress,values:result.node_progress.map(item=>({...item,evidence:'',status:item.progress_percent===100?'completed':'in_progress'}))};
  source.notice=result.status==='cancelled'?'已停止，本次未保存。':flight.undo
   ?flight.preservedChanges?'已撤销本次点亮，保留之后调整的进度。':'已恢复点亮前的学习进度。'
   :flight.cancelRequested?'全部节点已保存，可撤销本次点亮。':'已点亮全部节点，可撤销本次点亮。';
  source.error=result.status==='cancelled'&&flight.failure?`整批保存失败，未修改节点。${flight.failure}`:'';
  if(source.error)source.notice='';
  source.phase='idle';source.flight=undefined;
  if(source.active&&owner.current===source)onBusyChange(false);
  publish(source);
 }
 async function check(source:Owner,flight:Flight){
  if(source.phase==='checking'||source.flight!==flight)return;
  flight.cancelRequested=true;flight.controller.abort();source.phase='checking';source.notice='正在核对保存结果…';source.error='';publish(source);
  try{settle(source,flight,await flight.cancel(flight.id,new AbortController().signal));}
  catch(error){
   if(source.flight!==flight)return;
   source.phase='uncertain';source.notice='';source.error=`暂时无法确认保存结果，请重试核对。${describePublicError(error)}`;publish(source);
  }
 }
 async function run(undo:boolean){
  const source=owner.current!;
  if(!source.key||source.phase!=='idle'||blocked||!onSetBatchProgress||!onCancelBatchProgress)return;
  const progress=new Map(progressFor(source).map(item=>[item.node_id,progressPercentForNode(item)]));
  const nodes=new Set(snapshot.nodes.map(node=>node.id));
  let preservedChanges=false;
  const pending=undo?source.entries.filter(entry=>{
   const percent=progress.get(entry.nodeId)??0;
   if(nodes.has(entry.nodeId)&&percent===100)return true;
   if(nodes.has(entry.nodeId)&&percent!==entry.percent)preservedChanges=true;
   return false;
  }):snapshot.nodes.filter(node=>(progress.get(node.id)??0)<100).map(node=>({nodeId:node.id,percent:progress.get(node.id)??0}));
  if(!pending.length){
   if(undo){try{checkpoint(source,[]);source.notice=preservedChanges?'已撤销本次点亮，保留之后调整的进度。':'已恢复点亮前的学习进度。';publish(source);}catch(error){source.error=describePublicError(error);publish(source);}}
   return;
  }
  const before=[...source.entries],after=undo?[]:[...source.entries,...pending.filter(entry=>!source.entries.some(saved=>saved.nodeId===entry.nodeId))];
  try{checkpoint(source,undo?before:after);}
  catch(error){source.error=describePublicError(error);publish(source);return;}
  const flight:Flight={id:crypto.randomUUID(),undo,controller:new AbortController(),before,after,cancel:onCancelBatchProgress,cancelRequested:false,preservedChanges};
  source.flight=flight;source.phase='saving';source.error='';source.notice=undo?'正在一次恢复原进度…':'正在一次保存全部节点…';onBusyChange(true);publish(source);
  const changes=pending.map(entry=>({nodeId:entry.nodeId,expectedPercent:progress.get(entry.nodeId)??0,progressPercent:undo?entry.percent:100}));
  try{
   const result=await onSetBatchProgress(changes,flight.controller.signal,flight.id);
   if(!flight.cancelRequested&&source.active&&owner.current===source)settle(source,flight,result);
  }catch(error){
   if(!flight.cancelRequested&&source.active&&owner.current===source){flight.failure=describePublicError(error);await check(source,flight);}
  }
 }
 function forgetNode(nodeId:string){
  const source=owner.current!;
  if(!source.entries.some(entry=>entry.nodeId===nodeId))return;
  try{checkpoint(source,source.entries.filter(entry=>entry.nodeId!==nodeId));}
  catch(error){source.error=describePublicError(error);publish(source);}
 }
 return {busy:current.phase!=='idle',checking:current.phase==='checking',uncertain:current.phase==='uncertain',
  undoCount:current.entries.length,notice:current.notice,error:current.error,progress:progressFor(current),
  light:()=>run(false),undo:()=>run(true),forgetNode,cancel:async()=>{const source=owner.current!;if(source.flight)await check(source,source.flight);}};
}
