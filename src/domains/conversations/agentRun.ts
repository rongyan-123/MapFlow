import type {QueryClient} from '@tanstack/react-query';
import {PublicUiError} from '../../lib/publicErrors';
import type {GenerationAction,GenerationProcessEvent,TeachingCanvasState} from './types';
import {StreamingPresentation} from './streamingPresentation';
import {AgentApiError,acceptAgentExecution,attachAgentExecution,fetchActiveAgentExecution,fetchAgentExecution,fetchAgentExecutionControl,resumeAgentExecution,stopAgentExecution,resolveAgentToolApproval,
  type AgentCompletion,type AgentEvent,type AgentExecutionCommand,type AgentFunding,type AgentStatus,type AgentPayload,type AgentExecutionControl} from '../../api/agentExecutionClient';

export type AgentSendOptions=Omit<AgentExecutionCommand,'clientActionId'|'expectedRevision'|'action'>;
export interface AgentRunOptions {releaseTerminalPending?:boolean;onModelUnavailable?:()=>void}
type SavedCommand=Omit<AgentExecutionCommand,'modelAccess'>&{modelAccess?:Omit<NonNullable<AgentExecutionCommand['modelAccess']>,'apiKey'>};
type PendingGeneration={clientActionId:string;expectedRevision:number;action:GenerationAction};
interface AgentRunSnapshot {
  executionId:string|null;funding:AgentFunding|null;modelId:string|null;state:AgentStatus['state']|null;
  pendingGeneration:PendingGeneration|null;rejectedGeneration:PendingGeneration|null;interruptedGeneration:PendingGeneration|null;
  draft:string;process:GenerationProcessEvent[];busy:boolean;stopped:boolean;stopRequested:boolean;error:unknown;completion:AgentCompletion|null;
  pendingApprovals:Extract<AgentPayload,{type:'approval_required'}>[];canvasPreview:TeachingCanvasState|null;
  completedAction:GenerationAction|null;confirmedUnaccepted:boolean;
  control:AgentExecutionControl|null;controlAvailability:'unknown'|'ready'|'unsupported'|'unavailable';
}
const terminal=(state:AgentStatus['state'])=>['succeeded','stopped','failed'].includes(state);
const safeFailure=(failure:unknown)=>failure instanceof AgentApiError?failure:
  new PublicUiError('连接暂时中断。请核对已保存结果后继续。');
function commandWithoutCredential(command:AgentExecutionCommand):SavedCommand{
  const {modelAccess,...saved}=command;
  return {...saved,...(modelAccess?{modelAccess:{baseUrl:modelAccess.baseUrl,model:modelAccess.model,contextWindow:modelAccess.contextWindow,
    maxOutputTokens:modelAccess.maxOutputTokens,reasoningProtocol:modelAccess.reasoningProtocol,reasoningSupported:modelAccess.reasoningSupported}}:{})};
}
function restoreCommand(command:AgentExecutionCommand|undefined):SavedCommand|null{
  return command&&typeof command.clientActionId==='string'&&['cash','points','byok'].includes(command.funding)
    &&command.action&&['reply','regenerate','continue'].includes(command.action.type)?commandWithoutCredential(command):null;
}
/** The application owns progress; each mounted page owns only a disposable event reader. */
export class AgentConversationRun {
  private snapshot:AgentRunSnapshot={executionId:null,funding:null,modelId:null,state:null,pendingGeneration:null,rejectedGeneration:null,interruptedGeneration:null,draft:'',process:[],busy:false,stopped:false,stopRequested:false,error:null,completion:null,pendingApprovals:[],canvasPreview:null,completedAction:null,confirmedUnaccepted:false,control:null,controlAvailability:'unknown'};
  private controlEpoch=0;
  private listeners=new Set<()=>void>();private reader:AbortController|null=null;private presentation:StreamingPresentation|null=null;
  private restored:Promise<void>|null=null;private operation:SavedCommand|null=null;private sequence=0;private sending=false;
  private rejectedOperation:SavedCommand|null=null;
  private epoch=0;private restorationFailed=false;private deleted=false;
  private pendingStopCsrf:string|null=null;private stopActionId:string|null=null;
  private stopTarget:string|null=null;private stopping=false;
  private readonly storageKey:string;
  constructor(readonly accountId:string,readonly conversationId:string,private options:AgentRunOptions={}){this.storageKey=`mapflow.agent.execution.v1.${accountId}.${conversationId}`;}
  getSnapshot=()=>this.snapshot;
  rejectPreflight(failure:unknown){this.set({error:failure==null?null:failure instanceof PublicUiError?failure:safeFailure(failure)});}
  subscribe=(listener:()=>void)=>{
    this.listeners.add(listener);void this.restore().then(()=>this.watch());
    return()=>{this.listeners.delete(listener);if(!this.listeners.size)this.detach();};
  };
  private set(patch:Partial<AgentRunSnapshot>){
    if(patch.executionId!==undefined&&patch.executionId!==this.snapshot.executionId||patch.state!==undefined&&patch.state!==this.snapshot.state){
      this.controlEpoch++;patch={control:null,controlAvailability:'unknown',...patch};
    }
    this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());
  }
  private persist(){try{sessionStorage.setItem(this.storageKey,JSON.stringify({executionId:this.snapshot.executionId,command:this.operation,stopRequested:this.snapshot.stopRequested,stopTarget:this.stopTarget,stopActionId:this.stopActionId,
    ...(this.options.releaseTerminalPending?{rejectedCommand:this.rejectedOperation,unacceptedActionId:this.rejectedOperation?.clientActionId??null}:{})}));}catch{/* Recovery can still discover the account-owned active execution. */}}
  markDeleted(){
    this.deleted=true;this.epoch++;this.detach();this.operation=null;this.rejectedOperation=null;this.pendingStopCsrf=null;this.stopTarget=null;this.stopActionId=null;
    this.restorationFailed=false;
    this.set({executionId:null,state:null,pendingGeneration:null,draft:'',process:[],busy:false,stopped:false,stopRequested:false,
      completion:null,completedAction:null,pendingApprovals:[],canvasPreview:null,rejectedGeneration:null,interruptedGeneration:null,confirmedUnaccepted:false,error:new AgentApiError('execution_not_found',404)});
    try{sessionStorage.removeItem(this.storageKey);}catch{/* Optional browser recovery record. */}
  }
  private fail(failure:unknown){if(failure instanceof AgentApiError&&failure.status===404){this.markDeleted();return;}this.set({error:safeFailure(failure)});}
  restore():Promise<void>{
    if(this.deleted)return Promise.resolve();
    return this.restored??=this.restoreSaved().catch(failure=>{this.restorationFailed=true;this.fail(failure);});
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
      this.operation=restoreCommand(saved?.command);
      if(this.options.releaseTerminalPending){
        const rejected=restoreCommand(saved?.rejectedCommand);
        if(rejected&&saved.unacceptedActionId===rejected.clientActionId)this.rejectedOperation=rejected;
        else if(!identity&&this.operation&&saved.unacceptedActionId===this.operation.clientActionId){
          this.rejectedOperation=this.operation;this.operation=null;
        }
      }
    }catch{/* Invalid browser state cannot dispatch a model call. */}
    if(this.operation)this.set({funding:this.operation.funding,modelId:this.operation.modelAccess?.model??null});
    const signal=new AbortController().signal;
    const status=identity?await fetchAgentExecution(identity,this.conversationId,signal):await fetchActiveAgentExecution(this.conversationId,signal);
    if(this.deleted)return;
    this.restorationFailed=false;
    if(status)this.applyStatus(status);
    else {
      const saved=this.operation??this.rejectedOperation;
      this.set({pendingGeneration:this.operation,rejectedGeneration:this.rejectedOperation,confirmedUnaccepted:!!this.rejectedOperation,
        ...(saved?{funding:saved.funding,modelId:saved.modelAccess?.model??null}:{}),
        error:this.operation?new PublicUiError('请核对或重试这条消息，避免重复发送。'):this.rejectedOperation?new AgentApiError('global_assistant_revision_conflict',409):null});
      if(this.rejectedOperation)this.persist();
    }
  }
  private applyStatus(status:AgentStatus){
    if((this.options.releaseTerminalPending||this.snapshot.funding==='byok')&&this.snapshot.executionId===status.executionId&&this.snapshot.state&&terminal(this.snapshot.state)&&status.state!==this.snapshot.state)return;
    if(this.snapshot.executionId===status.executionId&&this.snapshot.completion){
      if(status.state!=='succeeded'||!status.result)return;
      if(this.snapshot.completion.settlement.status==='settled'&&status.result.settlement.status!=='settled')return;
    }
    const interruptedByok=status.funding==='byok'&&(status.state==='failed'||status.state==='stopped');
    this.set({executionId:status.executionId,funding:status.funding,modelId:status.modelId,state:status.state,control:null,controlAvailability:'unknown',
      rejectedGeneration:this.rejectedOperation,confirmedUnaccepted:!!this.rejectedOperation,busy:!terminal(status.state)&&status.state!=='awaiting_reconciliation',
      ...(terminal(status.state)?{stopRequested:false,pendingApprovals:[],...(status.state==='succeeded'?{}:{canvasPreview:null})}:{}),
      stopped:status.state==='stopped',completion:status.result,completedAction:status.result?this.operation?.action??null:null,
      interruptedGeneration:interruptedByok?this.operation??this.snapshot.interruptedGeneration:null,
      pendingGeneration:status.state==='succeeded'||interruptedByok||this.options.releaseTerminalPending&&terminal(status.state)?null:this.operation??{clientActionId:status.executionId,expectedRevision:0,action:{type:'reply',message:''}},
      error:status.error?new AgentApiError(status.error.code,400,status.error.requestId):null});this.persist();
    void this.refreshControl(status);
  }
  private async refreshControl(status:AgentStatus){
    const epoch=this.epoch,reading=++this.controlEpoch;
    try{const control=await fetchAgentExecutionControl(status.executionId,this.conversationId);
      if(this.deleted||epoch!==this.epoch||reading!==this.controlEpoch||this.snapshot.executionId!==status.executionId||this.snapshot.state!==status.state)return;
      if(control&&control.state!==this.snapshot.state)return;
      this.set({control,controlAvailability:control?'ready':'unsupported'});
    }catch{if(!this.deleted&&epoch===this.epoch&&reading===this.controlEpoch&&this.snapshot.executionId===status.executionId&&this.snapshot.state===status.state)this.set({control:null,controlAvailability:'unavailable'});}
  }
  canResume(){return this.snapshot.state==='awaiting_reconciliation'&&this.snapshot.funding==='byok'&&
    (this.snapshot.control?.actions.canResume===true||this.snapshot.controlAvailability==='unsupported'&&this.snapshot.error instanceof AgentApiError&&this.snapshot.error.code==='credential_required');}
  /** A bounded global projection may discover work accepted by another device. */
  synchronizeStatus(status:AgentStatus,expectedExecutionId:string|null){
    if(this.deleted||this.sending||status.conversationId!==this.conversationId||this.snapshot.executionId!==expectedExecutionId)return;
    if(status.executionId!==this.snapshot.executionId){
      if(this.snapshot.pendingGeneration||this.snapshot.busy)return;
      this.epoch++;this.sequence=0;this.detach();this.operation=null;
      this.set({draft:'',process:[],pendingApprovals:[],canvasPreview:null,stopRequested:false,stopped:false});
    }
    this.applyStatus(status);this.watch();
  }
  async checkStatus(){
    if(this.deleted)return;
    if(this.restorationFailed){this.restored=null;await this.restore();if(this.restorationFailed)return;}
    await this.restore();const execution=this.snapshot.executionId,epoch=this.epoch;
    if(!execution)return;
    try{const status=await fetchAgentExecution(execution,this.conversationId);
      if(epoch===this.epoch&&execution===this.snapshot.executionId){this.applyStatus(status);this.watch();}
    }catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.fail(failure);}
  }
  async send(action:GenerationAction,expectedRevision:number,options:AgentSendOptions,csrf:string){
    await this.restore();if(this.deleted||this.restorationFailed||this.sending||this.snapshot.pendingGeneration||this.rejectedOperation||this.snapshot.busy)return false;
    if(action.type==='reply'&&(!action.message.trim()||action.message.includes('\0'))){this.set({error:new PublicUiError('请输入有效消息。')});return false;}
    const command:AgentExecutionCommand={...options,clientActionId:crypto.randomUUID(),expectedRevision,action};
    this.operation=commandWithoutCredential(command);
    this.epoch++;this.sequence=0;this.pendingStopCsrf=null;this.stopActionId=null;this.stopTarget=null;this.stopping=false;this.detach();this.set({executionId:null,funding:options.funding,modelId:options.modelAccess?.model??null,state:null,pendingGeneration:this.operation,interruptedGeneration:null,draft:'',process:[],busy:true,stopped:false,stopRequested:false,error:null,completion:null,pendingApprovals:[],canvasPreview:null,confirmedUnaccepted:false});
    this.persist();await this.accept(command,csrf);return !this.snapshot.confirmedUnaccepted;
  }
  private async accept(command:AgentExecutionCommand,csrf:string){
    this.sending=true;const epoch=this.epoch;
    try{const accepted=await acceptAgentExecution(this.conversationId,command,csrf);if(epoch!==this.epoch)return;this.applyStatus(accepted.execution);
      if(this.pendingStopCsrf||this.snapshot.stopRequested)await this.stop(this.pendingStopCsrf??csrf);else this.watch();}
    catch(failure){if(epoch===this.epoch){
      const rejectedCash=command.funding==='cash'&&failure instanceof AgentApiError&&failure.status===402&&failure.code==='cash_non_positive';
      const rejectedModel=command.funding==='cash'&&failure instanceof AgentApiError&&failure.status===409&&failure.code==='agent_model.not_selectable';
      const rejectedGlobal=this.options.releaseTerminalPending&&failure instanceof AgentApiError&&['global_conversation_not_current','global_assistant_client_upgrade_required','global_assistant_migration_pending'].includes(failure.code);
      if(rejectedCash||rejectedModel){
        this.operation=null;this.pendingStopCsrf=null;this.stopTarget=null;this.stopActionId=null;
        this.set({busy:false,pendingGeneration:null,stopRequested:false,confirmedUnaccepted:true});this.persist();
        if(rejectedModel)this.options.onModelUnavailable?.();
      }else if(rejectedGlobal){this.operation=null;this.set({busy:false,pendingGeneration:null,stopRequested:false});this.persist();}
      else if(this.options.releaseTerminalPending&&failure instanceof AgentApiError&&failure.code==='global_assistant_revision_conflict'&&failure.status===409){
        this.rejectedOperation=this.operation;this.operation=null;this.pendingStopCsrf=null;this.stopTarget=null;this.stopActionId=null;
        this.set({busy:false,stopRequested:false,pendingGeneration:null,rejectedGeneration:this.rejectedOperation,confirmedUnaccepted:true});
      }else this.set({busy:false,confirmedUnaccepted:false});
      this.fail(failure);
      if(this.snapshot.confirmedUnaccepted)this.persist();
    }}finally{if(epoch===this.epoch)this.sending=false;}
  }
  async retry(csrf:string,apiKey?:string){
    if(this.deleted)return;
    if(this.restorationFailed){this.restored=null;await this.restore();if(this.restorationFailed)return;}
    await this.restore();if(this.sending)return;
    if(this.snapshot.executionId){
      if(this.snapshot.state==='stopped'||this.snapshot.state==='failed')return;
      const execution=this.snapshot.executionId,epoch=this.epoch;
      try{const status=this.canResume()
          ?await resumeAgentExecution(this.snapshot.executionId,this.conversationId,csrf,apiKey)
          :await fetchAgentExecution(this.snapshot.executionId,this.conversationId);
        if(epoch!==this.epoch||execution!==this.snapshot.executionId)return;this.applyStatus(status);this.watch();}catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.fail(failure);}return;
    }
    if(!this.operation)return;
    if(this.operation.funding==='byok'&&(!apiKey||!this.operation.modelAccess)){this.set({error:new AgentApiError('credential_required',400)});return;}
    const {modelAccess,...command}=this.operation;
    this.set({busy:true,error:null});await this.accept({...command,...(modelAccess?{modelAccess:{...modelAccess,apiKey:apiKey!}}:{})},csrf);
    if(this.snapshot.confirmedUnaccepted&&!this.rejectedOperation)return command.action;
  }
  async stop(csrf:string){
    if(!this.snapshot.executionId){if(this.sending){this.pendingStopCsrf=csrf;this.set({stopRequested:true});this.persist();}return;}
    if(this.stopping)return;
    this.stopActionId??=crypto.randomUUID();const execution=this.snapshot.executionId,epoch=this.epoch;
    this.stopping=true;this.stopTarget=execution;this.set({stopRequested:true});this.persist();
    try{const status=await stopAgentExecution(execution,this.conversationId,this.stopActionId,csrf);if(epoch!==this.epoch||execution!==this.snapshot.executionId)return;this.applyStatus(status);this.pendingStopCsrf=null;this.detach();this.watch();}
    catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.fail(failure);}
    finally{if(epoch===this.epoch)this.stopping=false;}
  }
  async resumeRequestedStop(csrf:string){await this.restore();if(this.snapshot.stopRequested&&this.stopTarget===this.snapshot.executionId&&this.snapshot.executionId&&!terminal(this.snapshot.state!))await this.stop(csrf);}
  async resolveApproval(approval:string,allowed:boolean,destructiveConfirmed:boolean,csrf:string){
    const execution=this.snapshot.executionId,epoch=this.epoch;
    if(!execution||!this.snapshot.pendingApprovals.some(item=>item.approval.approvalRequestId===approval))return;
    try{await resolveAgentToolApproval(execution,approval,allowed,destructiveConfirmed,csrf);
      if(epoch===this.epoch&&execution===this.snapshot.executionId)this.set({pendingApprovals:this.snapshot.pendingApprovals.filter(item=>item.approval.approvalRequestId!==approval),error:null});
    }catch(failure){if(epoch===this.epoch&&execution===this.snapshot.executionId)this.fail(failure);}
  }
  returnRejectedToEdit():GenerationAction|null{
    if(!this.options.releaseTerminalPending||!this.rejectedOperation||this.snapshot.busy||this.sending||this.snapshot.pendingGeneration
      ||this.snapshot.executionId&&(!this.snapshot.state||!terminal(this.snapshot.state)))return null;
    const action=this.rejectedOperation.action;this.rejectedOperation=null;
    this.set({rejectedGeneration:null,confirmedUnaccepted:false,...(this.snapshot.error instanceof AgentApiError&&this.snapshot.error.code==='global_assistant_revision_conflict'?{error:null}:{})});
    this.persist();return action;
  }
  dismiss(){if(this.snapshot.busy||this.snapshot.state==='awaiting_reconciliation')return;
    this.epoch++;this.detach();this.operation=null;this.rejectedOperation=null;this.stopTarget=null;this.set({pendingGeneration:null,rejectedGeneration:null,interruptedGeneration:null,error:null,draft:'',process:[],state:null,executionId:null,stopped:false,stopRequested:false,confirmedUnaccepted:false});this.persist();}
  private detach(){this.presentation?.flush();this.reader?.abort();this.reader=null;this.presentation?.dispose();this.presentation=null;}
  private watch(){
    if(this.deleted||!this.listeners.size||this.reader||!this.snapshot.executionId||!this.snapshot.state)return;
    if(terminal(this.snapshot.state)){
      if(this.pendingSettlement()){const reader=new AbortController();this.reader=reader;void this.readSettlement(reader,this.snapshot.executionId);}
      return;
    }
    const reader=new AbortController();
    const execution=this.snapshot.executionId,{draft,process}=this.snapshot;
    const presentation=new StreamingPresentation((draft,process)=>{if(this.currentReader(reader,execution))this.set({draft,process});});
    // Seed before activating the reader so initialization cannot overwrite the saved presentation.
    presentation.answer(draft);presentation.flush();presentation.restore(process);
    this.reader=reader;this.presentation=presentation;
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
      try{const status=await fetchAgentExecution(execution,this.conversationId,reader.signal);if(this.currentReader(reader,execution))this.applyStatus(status);}catch(failure){if(failure instanceof AgentApiError&&failure.status===404)this.markDeleted();}
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
      }catch(failure){if(!this.currentReader(reader,execution))break;this.fail(failure);if(this.deleted)break;delay=Math.min(delay*2,8000);}
      await this.pause(reader,delay);
    }}finally{presentation.dispose();if(this.reader===reader){this.reader=null;this.presentation=null;this.watch();}}
  }
}
const runs=new WeakMap<QueryClient,Map<string,AgentConversationRun>>();
export function agentConversationRun(client:QueryClient,account:string,conversation:string,options?:AgentRunOptions){
  let registry=runs.get(client);if(!registry){registry=new Map();runs.set(client,registry);}
  const key=JSON.stringify([account,conversation]);let run=registry.get(key);
  if(!run){run=new AgentConversationRun(account,conversation,{...options,onModelUnavailable:()=>{
    void client.invalidateQueries({queryKey:['me',account,'agent-models']});options?.onModelUnavailable?.();
  }});registry.set(key,run);}return run;
}
