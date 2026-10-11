import type {QueryClient} from '@tanstack/react-query';
import {PublicUiError} from '../../lib/publicErrors';
import type {GenerationAction,GenerationProcessEvent} from '../tavern/types';
import {StreamingPresentation} from '../tavern/streamingPresentation';
import {AgentApiError,acceptAgentExecution,attachAgentExecution,fetchActiveAgentExecution,fetchAgentExecution,resumeAgentExecution,stopAgentExecution,
  type AgentCompletion,type AgentEvent,type AgentExecutionCommand,type AgentFunding,type AgentStatus} from './agentExecutionClient';

export type AgentSendOptions=Omit<AgentExecutionCommand,'clientActionId'|'expectedRevision'|'action'>;
type SavedCommand=Omit<AgentExecutionCommand,'modelAccess'>&{modelAccess?:Omit<NonNullable<AgentExecutionCommand['modelAccess']>,'apiKey'>};
interface AgentRunSnapshot {
  executionId:string|null;funding:AgentFunding|null;state:AgentStatus['state']|null;
  pendingGeneration:{clientActionId:string;expectedRevision:number;action:GenerationAction}|null;
  draft:string;process:GenerationProcessEvent[];busy:boolean;stopped:boolean;error:unknown;completion:AgentCompletion|null;
}
const terminal=(state:AgentStatus['state'])=>['succeeded','stopped','failed'].includes(state);
const safeFailure=(failure:unknown)=>failure instanceof AgentApiError?failure:
  new PublicUiError('连接暂时中断。请核对已保存结果后继续。');
/** The application owns progress; each mounted page owns only a disposable event reader. */
export class AgentConversationRun {
  private snapshot:AgentRunSnapshot={executionId:null,funding:null,state:null,pendingGeneration:null,draft:'',process:[],busy:false,stopped:false,error:null,completion:null};
  private listeners=new Set<()=>void>();private reader:AbortController|null=null;private presentation:StreamingPresentation|null=null;
  private restored:Promise<void>|null=null;private operation:SavedCommand|null=null;private sequence=0;private sending=false;
  private pendingStopCsrf:string|null=null;private stopActionId:string|null=null;
  private readonly storageKey:string;
  constructor(readonly accountId:string,readonly conversationId:string){this.storageKey=`mapflow.agent.execution.v1.${accountId}.${conversationId}`;}
  getSnapshot=()=>this.snapshot;
  rejectPreflight(failure:unknown){this.set({error:failure instanceof PublicUiError?failure:safeFailure(failure)});}
  subscribe=(listener:()=>void)=>{
    this.listeners.add(listener);void this.restore().then(()=>this.watch());
    return()=>{this.listeners.delete(listener);if(!this.listeners.size)this.detach();};
  };
  private set(patch:Partial<AgentRunSnapshot>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());}
  private persist(){try{sessionStorage.setItem(this.storageKey,JSON.stringify({executionId:this.snapshot.executionId,command:this.operation}));}catch{/* Recovery can still discover the account-owned active execution. */}}
  restore():Promise<void>{
    return this.restored??=this.restoreSaved().catch(failure=>this.set({error:safeFailure(failure)}));
  }
  private async restoreSaved(){
    let identity:string|null=null;
    try{const saved=JSON.parse(sessionStorage.getItem(this.storageKey)??'null');
      if(saved&&typeof saved.executionId==='string'&&/^[0-9a-f-]{36}$/i.test(saved.executionId))identity=saved.executionId;
      // Saved commands never execute automatically; they only preserve explicit retry identity.
      if(saved?.command&&typeof saved.command.clientActionId==='string'&&['cash','points','byok'].includes(saved.command.funding)
        &&saved.command.action&&['reply','regenerate','continue'].includes(saved.command.action.type)){
        const {modelAccess,...command}=saved.command;
        this.operation={...command,...(modelAccess?{modelAccess:{baseUrl:modelAccess.baseUrl,model:modelAccess.model,contextWindow:modelAccess.contextWindow,
          maxOutputTokens:modelAccess.maxOutputTokens,reasoningProtocol:modelAccess.reasoningProtocol,reasoningSupported:modelAccess.reasoningSupported}}:{})};
      }
    }catch{/* Invalid browser state cannot dispatch a model call. */}
    const signal=new AbortController().signal;
    const status=identity?await fetchAgentExecution(identity,this.conversationId,signal):await fetchActiveAgentExecution(this.conversationId,signal);
    if(status)this.applyStatus(status);
    else if(this.operation)this.set({pendingGeneration:this.operation,error:new PublicUiError('请核对或重试这条消息，避免重复发送。')});
  }
  private applyStatus(status:AgentStatus){
    this.set({executionId:status.executionId,funding:status.funding,state:status.state,busy:!terminal(status.state)&&status.state!=='awaiting_reconciliation',
      stopped:status.state==='stopped',completion:status.result,
      pendingGeneration:status.state==='succeeded'?null:this.operation??{clientActionId:status.executionId,expectedRevision:0,action:{type:'reply',message:''}},
      error:status.error?new AgentApiError(status.error.code,400,status.error.requestId):null});this.persist();
  }
  async send(action:GenerationAction,expectedRevision:number,options:AgentSendOptions,csrf:string){
    await this.restore();if(this.sending||this.snapshot.pendingGeneration||this.snapshot.busy)return;
    if(action.type==='reply'&&(!action.message.trim()||action.message.includes('\0'))){this.set({error:new PublicUiError('请输入有效消息。')});return;}
    const command:AgentExecutionCommand={...options,clientActionId:crypto.randomUUID(),expectedRevision,action};
    const {modelAccess,...saved}=command;
    this.operation={...saved,...(modelAccess?{modelAccess:{baseUrl:modelAccess.baseUrl,model:modelAccess.model,contextWindow:modelAccess.contextWindow,
      maxOutputTokens:modelAccess.maxOutputTokens,reasoningProtocol:modelAccess.reasoningProtocol,reasoningSupported:modelAccess.reasoningSupported}}:{})};
    this.sequence=0;this.pendingStopCsrf=null;this.stopActionId=null;this.detach();this.set({executionId:null,funding:options.funding,state:null,pendingGeneration:this.operation,draft:'',process:[],busy:true,stopped:false,error:null,completion:null});
    this.persist();await this.accept(command,csrf);
  }
  private async accept(command:AgentExecutionCommand,csrf:string){
    this.sending=true;
    try{this.applyStatus((await acceptAgentExecution(this.conversationId,command,csrf)).execution);
      if(this.pendingStopCsrf)await this.stop(this.pendingStopCsrf);else this.watch();}
    catch(failure){this.set({busy:false,error:safeFailure(failure)});}finally{this.sending=false;}
  }
  async retry(csrf:string,apiKey?:string){
    await this.restore();if(this.sending)return;
    if(this.snapshot.executionId){
      if(this.snapshot.state==='stopped'||this.snapshot.state==='failed')return;
      try{const status=this.snapshot.state==='awaiting_reconciliation'&&this.snapshot.funding==='byok'
          ?await resumeAgentExecution(this.snapshot.executionId,this.conversationId,csrf,apiKey)
          :await fetchAgentExecution(this.snapshot.executionId,this.conversationId);
        this.applyStatus(status);this.watch();}catch(failure){this.set({error:safeFailure(failure)});}return;
    }
    if(!this.operation)return;
    if(this.operation.funding==='byok'&&(!apiKey||!this.operation.modelAccess)){this.set({error:new AgentApiError('credential_required',400)});return;}
    const {modelAccess,...command}=this.operation;
    this.set({busy:true,error:null});await this.accept({...command,...(modelAccess?{modelAccess:{...modelAccess,apiKey:apiKey!}}:{})},csrf);
  }
  async stop(csrf:string){
    if(!this.snapshot.executionId){if(this.sending)this.pendingStopCsrf=csrf;return;}
    this.stopActionId??=crypto.randomUUID();
    try{this.applyStatus(await stopAgentExecution(this.snapshot.executionId,this.conversationId,this.stopActionId,csrf));this.pendingStopCsrf=null;this.detach();}
    catch(failure){this.set({error:safeFailure(failure)});}
  }
  dismiss(){if(this.snapshot.busy||this.snapshot.state==='awaiting_reconciliation')return;
    this.operation=null;this.set({pendingGeneration:null,error:null,draft:'',process:[],state:null,executionId:null,stopped:false});this.persist();}
  private detach(){this.reader?.abort();this.reader=null;this.presentation?.flush();this.presentation?.dispose();this.presentation=null;}
  private watch(){
    if(!this.listeners.size||this.reader||!this.snapshot.executionId||!this.snapshot.state||terminal(this.snapshot.state))return;
    const reader=new AbortController();this.reader=reader;
    const presentation=new StreamingPresentation((draft,process)=>this.set({draft,process}));this.presentation=presentation;
    presentation.answer(this.snapshot.draft);presentation.flush();presentation.restore(this.snapshot.process);
    void this.read(reader,presentation);
  }
  private event(event:AgentEvent,presentation:StreamingPresentation){
    this.sequence=event.sequence;const payload=event.payload;
    if(payload.type==='text_delta')presentation.answer(payload.text);
    else if(payload.type==='reasoning_delta')presentation.reasoning(payload.text);
    else if(payload.type==='tool_process')presentation.tool({type:'tool',name:payload.toolName,state:payload.state==='completed'?'completed':payload.state==='failed'?'failed':'started'});
    else if(payload.type==='completed'){this.set({completion:payload.result,state:'succeeded',busy:false,pendingGeneration:null,error:null});this.persist();}
    else if(payload.type==='settlement'&&this.snapshot.completion)this.set({completion:{...this.snapshot.completion,settlement:payload.settlement,usage:payload.usage}});
  }
  private async read(reader:AbortController,presentation:StreamingPresentation){
    let delay=250;
    try{while(!reader.signal.aborted&&this.listeners.size&&this.snapshot.executionId){
      try{const page=await attachAgentExecution(this.snapshot.executionId,this.conversationId,this.sequence,event=>this.event(event,presentation),reader.signal);
        this.sequence=page.nextSequence;
        if(this.snapshot.completion){await presentation.drain();break;}
        if(terminal(page.state)){await presentation.drain();this.applyStatus(await fetchAgentExecution(this.snapshot.executionId,this.conversationId,reader.signal));break;}
        delay=250;
      }catch(failure){if(reader.signal.aborted)break;this.set({error:safeFailure(failure)});delay=Math.min(delay*2,8000);}
      await new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);reader.signal.removeEventListener('abort',finish);resolve();};
        const timer=setTimeout(finish,delay);reader.signal.addEventListener('abort',finish,{once:true});});
    }}finally{presentation.dispose();if(this.reader===reader){this.reader=null;this.presentation=null;}}
  }
}
const runs=new WeakMap<QueryClient,Map<string,AgentConversationRun>>();
export function agentConversationRun(client:QueryClient,account:string,conversation:string){
  let registry=runs.get(client);if(!registry){registry=new Map();runs.set(client,registry);}
  const key=JSON.stringify([account,conversation]);let run=registry.get(key);
  if(!run){run=new AgentConversationRun(account,conversation);registry.set(key,run);}return run;
}
