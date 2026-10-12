import type {QueryClient} from '@tanstack/react-query';
import {PublicUiError} from '../../lib/publicErrors';
import type {GenerationAction,GenerationProcessEvent,TeachingCanvasState} from '../tavern/types';
import {StreamingPresentation} from '../tavern/streamingPresentation';
import {AgentApiError,acceptAgentExecution,attachAgentExecution,fetchActiveAgentExecution,fetchAgentExecution,resumeAgentExecution,stopAgentExecution,resolveAgentToolApproval,
  type AgentCompletion,type AgentEvent,type AgentExecutionCommand,type AgentFunding,type AgentStatus,type AgentPayload} from './agentExecutionClient';

export type AgentSendOptions=Omit<AgentExecutionCommand,'clientActionId'|'expectedRevision'|'action'>;
type SavedCommand=Omit<AgentExecutionCommand,'modelAccess'>&{modelAccess?:Omit<NonNullable<AgentExecutionCommand['modelAccess']>,'apiKey'>};
interface AgentRunSnapshot {
  executionId:string|null;funding:AgentFunding|null;state:AgentStatus['state']|null;
  pendingGeneration:{clientActionId:string;expectedRevision:number;action:GenerationAction}|null;
  draft:string;process:GenerationProcessEvent[];busy:boolean;stopped:boolean;stopRequested:boolean;error:unknown;completion:AgentCompletion|null;
  pendingApprovals:Extract<AgentPayload,{type:'approval_required'}>[];canvasPreview:TeachingCanvasState|null;
  completedAction:GenerationAction|null;
}
const terminal=(state:AgentStatus['state'])=>['succeeded','stopped','failed'].includes(state);
const safeFailure=(failure:unknown)=>failure instanceof AgentApiError?failure:
  new PublicUiError('连接暂时中断。请核对已保存结果后继续。');
/** The application owns progress; each mounted page owns only a disposable event reader. */
export class AgentConversationRun {
  private snapshot:AgentRunSnapshot={executionId:null,funding:null,state:null,pendingGeneration:null,draft:'',process:[],busy:false,stopped:false,stopRequested:false,error:null,completion:null,pendingApprovals:[],canvasPreview:null,completedAction:null};
  private listeners=new Set<()=>void>();private reader:AbortController|null=null;private presentation:StreamingPresentation|null=null;
  private restored:Promise<void>|null=null;private operation:SavedCommand|null=null;private sequence=0;private sending=false;
  private epoch=0;private restorationFailed=false;
  private pendingStopCsrf:string|null=null;private stopActionId:string|null=null;
  private stopTarget:string|null=null;private stopping=false;
  private readonly storageKey:string;
  constructor(readonly accountId:string,readonly conversationId:string){this.storageKey=`mapflow.agent.execution.v1.${accountId}.${conversationId}`;}
  getSnapshot=()=>this.snapshot;
  rejectPreflight(failure:unknown){this.set({error:failure==null?null:failure instanceof PublicUiError?failure:safeFailure(failure)});}
  subscribe=(listener:()=>void)=>{
    this.listeners.add(listener);void this.restore().then(()=>this.watch());
    return()=>{this.listeners.delete(listener);if(!this.listeners.size)this.detach();};
  };
  private set(patch:Partial<AgentRunSnapshot>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());}
  private persist(){try{sessionStorage.setItem(this.storageKey,JSON.stringify({executionId:this.snapshot.executionId,command:this.operation,stopRequested:this.snapshot.stopRequested,stopTarget:this.stopTarget,stopActionId:this.stopActionId}));}catch{/* Recovery can still discover the account-owned active execution. */}}
  restore():Promise<void>{
    return this.restored??=this.restoreSaved().catch(failure=>{this.restorationFailed=true;this.set({error:safeFailure(failure)});});
  }
  private async restoreSaved(){
    let identity:string|null=null;
    try{const saved=JSON.parse(sessionStorage.getItem(this.storageKey)??'null');
      if(saved&&typeof saved.executionId==='string'&&/^[0-9a-f-]{36}$/i.test(saved.executionId))identity=saved.executionId;
      if(saved?.stopRequested===true){
        this.set({stopRequested:true});
        this.stopTarget=identity&&saved.stopTarget===identity?identity:null;
        if(typeof saved.stopActionId==='string'&&/^[0-9a-f-]{36}$/i.test(saved.stopActionId))this.stopActionId=saved.stopActionId;
      }
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
    this.restorationFailed=false;
    if(status)this.applyStatus(status);
    else if(this.operation)this.set({pendingGeneration:this.operation,error:new PublicUiError('请核对或重试这条消息，避免重复发送。')});
    else this.set({error:null});
  }
  private applyStatus(status:AgentStatus){
    if(this.snapshot.executionId===status.executionId&&this.snapshot.completion){
      if(status.state!=='succeeded'||!status.result)return;
      if(this.snapshot.completion.settlement.status==='settled'&&status.result.settlement.status!=='settled')return;
    }
    this.set({executionId:status.executionId,funding:status.funding,state:status.state,busy:!terminal(status.state)&&status.state!=='awaiting_reconciliation',
      ...(terminal(status.state)?{stopRequested:false,pendingApprovals:[],...(status.state==='succeeded'?{}:{canvasPreview:null})}:{}),
      stopped:status.state==='stopped',completion:status.result,completedAction:status.result?this.operation?.action??null:null,
      pendingGeneration:status.state==='succeeded'?null:this.operation??{clientActionId:status.executionId,expectedRevision:0,action:{type:'reply',message:''}},
      error:status.error?new AgentApiError(status.error.code,400,status.error.requestId):null});this.persist();
  }
  async send(action:GenerationAction,expectedRevision:number,options:AgentSendOptions,csrf:string){
    await this.restore();if(this.restorationFailed||this.sending||this.snapshot.pendingGeneration||this.snapshot.busy)return false;
    if(action.type==='reply'&&(!action.message.trim()||action.message.includes('\0'))){this.set({error:new PublicUiError('请输入有效消息。')});return false;}
    const command:AgentExecutionCommand={...options,clientActionId:crypto.randomUUID(),expectedRevision,action};
    const {modelAccess,...saved}=command;
    this.operation={...saved,...(modelAccess?{modelAccess:{baseUrl:modelAccess.baseUrl,model:modelAccess.model,contextWindow:modelAccess.contextWindow,
      maxOutputTokens:modelAccess.maxOutputTokens,reasoningProtocol:modelAccess.reasoningProtocol,reasoningSupported:modelAccess.reasoningSupported}}:{})};
    this.epoch++;this.sequence=0;this.pendingStopCsrf=null;this.stopActionId=null;this.stopTarget=null;this.stopping=false;this.detach();this.set({executionId:null,funding:options.funding,state:null,pendingGeneration:this.operation,draft:'',process:[],busy:true,stopped:false,stopRequested:false,error:null,completion:null,pendingApprovals:[],canvasPreview:null});
    this.persist();await this.accept(command,csrf);return true;
  }
  private async accept(command:AgentExecutionCommand,csrf:string){
    this.sending=true;const epoch=this.epoch;
    try{const accepted=await acceptAgentExecution(this.conversationId,command,csrf);if(epoch!==this.epoch)return;this.applyStatus(accepted.execution);
      if(this.pendingStopCsrf||this.snapshot.stopRequested)await this.stop(this.pendingStopCsrf??csrf);else this.watch();}
    catch(failure){if(epoch===this.epoch)this.set({busy:false,error:safeFailure(failure)});}finally{if(epoch===this.epoch)this.sending=false;}
  }
  async retry(csrf:string,apiKey?:string){
    if(this.restorationFailed){this.restored=null;await this.restore();if(this.restorationFailed)return;}
    await this.restore();if(this.sending)return;
    if(this.snapshot.executionId){
      if(this.snapshot.state==='stopped'||this.snapshot.state==='failed')return;
      const execution=this.snapshot.executionId,epoch=this.epoch;
      try{const status=this.snapshot.state==='awaiting_reconciliation'&&this.snapshot.funding==='byok'
          ?await resumeAgentExecution(this.snapshot.executionId,this.conversationId,csrf,apiKey)
          :await fetchAgentExecution(this.snapshot.executionId,this.conversationId);
        if(epoch!==this.epoch||execution!==this.snapshot.executionId)return;this.applyStatus(status);this.watch();}catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.set({error:safeFailure(failure)});}return;
    }
    if(!this.operation)return;
    if(this.operation.funding==='byok'&&(!apiKey||!this.operation.modelAccess)){this.set({error:new AgentApiError('credential_required',400)});return;}
    const {modelAccess,...command}=this.operation;
    this.set({busy:true,error:null});await this.accept({...command,...(modelAccess?{modelAccess:{...modelAccess,apiKey:apiKey!}}:{})},csrf);
  }
  async stop(csrf:string){
    if(!this.snapshot.executionId){if(this.sending){this.pendingStopCsrf=csrf;this.set({stopRequested:true});this.persist();}return;}
    if(this.stopping)return;
    this.stopActionId??=crypto.randomUUID();const execution=this.snapshot.executionId,epoch=this.epoch;
    this.stopping=true;this.stopTarget=execution;this.set({stopRequested:true});this.persist();
    try{const status=await stopAgentExecution(execution,this.conversationId,this.stopActionId,csrf);if(epoch!==this.epoch||execution!==this.snapshot.executionId)return;this.applyStatus(status);this.pendingStopCsrf=null;this.detach();this.watch();}
    catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.set({error:safeFailure(failure)});}
    finally{if(epoch===this.epoch)this.stopping=false;}
  }
  async resumeRequestedStop(csrf:string){await this.restore();if(this.snapshot.stopRequested&&this.stopTarget===this.snapshot.executionId&&this.snapshot.executionId&&!terminal(this.snapshot.state!))await this.stop(csrf);}
  async resolveApproval(approval:string,allowed:boolean,destructiveConfirmed:boolean,csrf:string){
    const execution=this.snapshot.executionId,epoch=this.epoch;
    if(!execution||!this.snapshot.pendingApprovals.some(item=>item.approval.approvalRequestId===approval))return;
    try{await resolveAgentToolApproval(execution,approval,allowed,destructiveConfirmed,csrf);
      if(epoch===this.epoch&&execution===this.snapshot.executionId)this.set({pendingApprovals:this.snapshot.pendingApprovals.filter(item=>item.approval.approvalRequestId!==approval),error:null});
    }catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.set({error:safeFailure(failure)});}
  }
  dismiss(){if(this.snapshot.busy||this.snapshot.state==='awaiting_reconciliation')return;
    this.epoch++;this.detach();this.operation=null;this.stopTarget=null;this.set({pendingGeneration:null,error:null,draft:'',process:[],state:null,executionId:null,stopped:false,stopRequested:false});this.persist();}
  private detach(){this.presentation?.flush();this.reader?.abort();this.reader=null;this.presentation?.dispose();this.presentation=null;}
  private watch(){
    if(!this.listeners.size||this.reader||!this.snapshot.executionId||!this.snapshot.state)return;
    if(terminal(this.snapshot.state)){
      if(this.pendingSettlement()){const reader=new AbortController();this.reader=reader;void this.readSettlement(reader,this.snapshot.executionId);}
      return;
    }
    const reader=new AbortController();this.reader=reader;
    const execution=this.snapshot.executionId;
    const presentation=new StreamingPresentation((draft,process)=>{if(this.currentReader(reader,execution))this.set({draft,process});});this.presentation=presentation;
    presentation.answer(this.snapshot.draft);presentation.flush();presentation.restore(this.snapshot.process);
    void this.read(reader,presentation,execution);
  }
  private currentReader(reader:AbortController,execution:string){return this.reader===reader&&!reader.signal.aborted&&this.snapshot.executionId===execution;}
  private pendingSettlement(){return this.snapshot.completion&&['pending_evidence','pending_posting'].includes(this.snapshot.completion.settlement.status);}
  private pause(reader:AbortController,milliseconds:number){
    if(reader.signal.aborted)return Promise.resolve();
    return new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);reader.signal.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,milliseconds);reader.signal.addEventListener('abort',finish,{once:true});});
  }
  private async readSettlement(reader:AbortController,execution:string){
    try{while(this.currentReader(reader,execution)&&this.listeners.size&&this.pendingSettlement()){
      await this.pause(reader,30000);if(!this.currentReader(reader,execution))break;
      try{const status=await fetchAgentExecution(execution,this.conversationId,reader.signal);if(this.currentReader(reader,execution))this.applyStatus(status);}catch{/* Saved results remain available while a read is unavailable. */}
    }}finally{if(this.reader===reader)this.reader=null;}
  }
  private event(event:AgentEvent,presentation:StreamingPresentation){
    this.sequence=event.sequence;const payload=event.payload;
    if(payload.type==='text_delta')presentation.answer(payload.text);
    else if(payload.type==='reasoning_delta')presentation.reasoning(payload.text);
    else if(payload.type==='tool_process'){
      presentation.tool({type:'tool',name:payload.toolName,state:payload.state==='completed'?'completed':payload.state==='failed'?'failed':'started'});
      if(payload.state!=='started')this.set({pendingApprovals:this.snapshot.pendingApprovals.filter(item=>item.callId!==payload.callId)});
    }
    else if(payload.type==='approval_required')this.set({pendingApprovals:[...this.snapshot.pendingApprovals.filter(item=>item.callId!==payload.callId),payload]});
    else if(payload.type==='canvas')this.set({canvasPreview:payload.canvas});
    else if(payload.type==='completed'){this.set({completion:payload.result,completedAction:this.operation?.action??null,state:'succeeded',busy:false,pendingGeneration:null,stopRequested:false,error:null,pendingApprovals:[]});this.persist();}
    else if(payload.type==='settlement'&&this.snapshot.completion)this.set({completion:{...this.snapshot.completion,settlement:payload.settlement,usage:payload.usage}});
  }
  private async read(reader:AbortController,presentation:StreamingPresentation,execution:string){
    let delay=250;
    try{while(this.currentReader(reader,execution)&&this.listeners.size){
      try{const page=await attachAgentExecution(execution,this.conversationId,this.sequence,event=>{if(this.currentReader(reader,execution)&&event.executionId===execution&&event.sequence>this.sequence)this.event(event,presentation);},reader.signal);
        if(!this.currentReader(reader,execution))break;
        this.sequence=page.nextSequence;
        if(this.snapshot.completion){await presentation.drain();break;}
        if(terminal(page.state)){await presentation.drain();const status=await fetchAgentExecution(execution,this.conversationId,reader.signal);if(this.currentReader(reader,execution))this.applyStatus(status);break;}
        delay=250;
      }catch(failure){if(!this.currentReader(reader,execution))break;this.set({error:safeFailure(failure)});delay=Math.min(delay*2,8000);}
      await this.pause(reader,delay);
    }}finally{presentation.dispose();if(this.reader===reader){this.reader=null;this.presentation=null;this.watch();}}
  }
}
const runs=new WeakMap<QueryClient,Map<string,AgentConversationRun>>();
export function agentConversationRun(client:QueryClient,account:string,conversation:string){
  let registry=runs.get(client);if(!registry){registry=new Map();runs.set(client,registry);}
  const key=JSON.stringify([account,conversation]);let run=registry.get(key);
  if(!run){run=new AgentConversationRun(account,conversation);registry.set(key,run);}return run;
}
