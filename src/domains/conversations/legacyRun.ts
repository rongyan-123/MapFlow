import type { QueryClient } from '@tanstack/react-query';
import type { GenerationProcessEvent, TeachingCanvasState } from './types';
import type { StreamingPresentation } from './streamingPresentation';

export interface PendingGeneration {
  clientActionId:string;expectedRevision:number;action:import('./types').GenerationAction;
  billing?:import('./types').CashQuote;
  platformBinding?:{model:string;historyBytes:8192|16384|32768};
  modelBinding?:{model:string;baseUrl:string;historyBytes:8192|16384|32768};
}
interface RunScope { accountId:string;scene:string;areaId:string|null;conversationId:string }
interface RunSnapshot {
  pendingGeneration:PendingGeneration|null;draft:string;process:GenerationProcessEvent[];
  busy:boolean;stopped:boolean;error:unknown;canvasPreview:TeachingCanvasState|null;
}

// The application query client owns runs. Visible chat mounts only subscribe to their own scope.
class ConversationRun {
  readonly controller={current:null as AbortController|null};
  readonly presentation={current:null as StreamingPresentation|null};
  readonly publishPreview={current:null as (()=>void)|null};
  binding:{branchId:string;actionId:string}|null=null;
  private listeners=new Set<()=>void>();
  private snapshot:RunSnapshot;
  constructor(readonly scope:Readonly<RunScope>,pendingGeneration:PendingGeneration|null) {
    this.snapshot={pendingGeneration,draft:'',process:[],busy:false,stopped:false,error:null,canvasPreview:null};
  }
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  isVisible=()=>this.listeners.size>0;
  set=(patch:Partial<RunSnapshot>)=>{
    if(Object.entries(patch).every(([key,value])=>this.snapshot[key as keyof RunSnapshot]===value))return;
    this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());
  };
  begin(controller:AbortController,branchId:string,actionId:string) {
    if(this.controller.current)throw new Error('A request already owns this conversation.');
    this.controller.current=controller;this.binding={branchId,actionId};
  }
  cancel() {
    this.publishPreview.current?.();this.presentation.current?.dispose();this.controller.current?.abort();
    this.set({busy:false,stopped:true,canvasPreview:null});
  }
}
const registries=new WeakMap<QueryClient,Map<string,ConversationRun>>();
export function conversationRun(client:QueryClient,scope:RunScope,initialPending:()=>PendingGeneration|null) {
  let registry=registries.get(client);
  if(!registry){registry=new Map();registries.set(client,registry);}
  const key=JSON.stringify([scope.accountId,scope.scene,scope.areaId,scope.conversationId]);
  let run=registry.get(key);
  if(!run){run=new ConversationRun(Object.freeze({...scope}),initialPending());registry.set(key,run);}
  return run;
}
export function clearConversationRuns(client:QueryClient) {
  const registry=registries.get(client);
  registry?.forEach(run=>run.cancel());registry?.clear();registries.delete(client);
}
