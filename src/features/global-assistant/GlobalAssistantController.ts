import {QueryClient} from '@tanstack/react-query';
import {openGlobalAssistant,fetchGlobalMessages,fetchGlobalChanges,GlobalAssistantApiError,type GlobalSnapshot,type GlobalChange} from '../../api/globalAssistantClient';
import {AgentApiError,fetchAgentExecution,stopAgentExecution,resumeAgentExecution,type AgentCompletion,type AgentStatus} from '../../api/agentExecutionClient';
import {agentConversationRun,type AgentConversationRun,type AgentSendOptions} from '../../domains/conversations/agentRun';
import type {GenerationSettingsState} from '../../domains/conversations/types';
import {appendQuestion,questionsForVisit} from './questions';
import {PublicUiError} from '../../lib/publicErrors';

export interface GlobalAssistantState {
  timeline:GlobalSnapshot|null;draft:string;questions:ReturnType<typeof questionsForVisit>;
  loading:boolean;error:unknown;guidesDismissed:boolean;
  loadingOlder:boolean;historyError:unknown;syncing:boolean;syncError:unknown;
  execution:ReturnType<AgentConversationRun['getSnapshot']>|null;
  blockingExecutions:AgentStatus[];requestActions:Record<string,{busy:boolean;error:unknown}>;
  noticeError:unknown;
}
export class GlobalAssistantController {
  private snapshot:GlobalAssistantState;
  private listeners=new Set<()=>void>();
  private reader:AbortController|null=null;
  private syncOperation:Promise<void>|null=null;
  private syncAgain=false;
  private lastSequence=0;
  private run:AgentConversationRun|null=null;
  private detachRun:(()=>void)|null=null;
  private draftVersion=0;
  private sending=false;
  private settlements=new Map<string,Extract<GlobalChange,{type:'settlement'}>>();
  constructor(readonly accountId:string,private csrfToken:string,private queryClient=new QueryClient()){
    this.snapshot={timeline:null,draft:'',questions:questionsForVisit(accountId),loading:true,error:null,guidesDismissed:false,loadingOlder:false,historyError:null,syncing:false,syncError:null,execution:null,blockingExecutions:[],requestActions:{},noticeError:null};
  }
  getSnapshot=()=>this.snapshot;
  updateCsrfToken=(csrfToken:string)=>{this.csrfToken=csrfToken;};
  subscribe=(listener:()=>void)=>{
    this.listeners.add(listener);
    if(this.listeners.size===1)void this.reload();
    return()=>{this.listeners.delete(listener);if(!this.listeners.size){this.reader?.abort();this.reader=null;this.detachRun?.();this.detachRun=null;}};
  };
  private set(patch:Partial<GlobalAssistantState>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());}
  setDraft=(draft:string)=>{this.draftVersion++;this.set({draft});};
  chooseQuestion=(question:string)=>this.setDraft(appendQuestion(this.snapshot.draft,question));
  patchSettings=(settings:GenerationSettingsState)=>{if(this.snapshot.timeline)this.set({timeline:{...this.snapshot.timeline,...settings}});};
  reload=async()=>{
    this.reader?.abort();const reader=new AbortController();this.reader=reader;this.syncOperation=null;this.syncAgain=false;
    this.set({loading:true,error:null,loadingOlder:false,syncing:false});
    try{const timeline=await openGlobalAssistant(this.csrfToken,reader.signal);if(this.current(reader)){
      if(this.snapshot.timeline?.conversationId!==timeline.conversationId||this.snapshot.timeline.bindingVersion!==timeline.bindingVersion)this.settlements.clear();
      timeline.completions=timeline.completions.map(this.withKnownSettlement);
      this.lastSequence=0;this.set({timeline,blockingExecutions:timeline.blockingExecutions,loading:false,syncError:null,historyError:null});this.connectRun(timeline);
    }}
    catch(error){if(this.current(reader))this.set({error,loading:false,...(error instanceof GlobalAssistantApiError?{blockingExecutions:error.blockingExecutions}:{})});}
  };
  private current(reader:AbortController){return this.reader===reader&&!reader.signal.aborted;}
  private connectRun(timeline:GlobalSnapshot){
    const run=agentConversationRun(this.queryClient,this.accountId,timeline.conversationId,{releaseTerminalPending:true});
    if(this.run===run&&this.detachRun)return;
    this.detachRun?.();this.run=run;
    this.detachRun=run.subscribe(()=>{if(this.run===run)this.observeRun(run);});
    this.observeRun(run);
    void run.restore().then(()=>{
      if(this.run!==run||!this.listeners.size)return;
      const current=run.getSnapshot();
      if(timeline.activeExecution&&(!current.executionId||current.state&&['succeeded','stopped','failed'].includes(current.state)))run.synchronizeStatus(timeline.activeExecution,current.executionId);
      void run.resumeRequestedStop(this.csrfToken);
    });
  }
  private observeRun(run:AgentConversationRun){
    const execution=run.getSnapshot(),previous=this.snapshot.execution;
    let timeline=this.snapshot.timeline;
    if(execution.completion&&timeline){
      const completion=execution.completion;
      timeline={...timeline,completions:mergeCompletions(timeline.completions,this.withKnownSettlement(completion))};
    }
    this.set({execution,timeline});
    if(execution.error instanceof AgentApiError&&isBindingError(execution.error)&&execution.error!==previous?.error){
      this.set({noticeError:execution.error});void this.reload();return;
    }
    if(execution.completion!==previous?.completion&&execution.completion||execution.state!==previous?.state&&['succeeded','stopped','failed'].includes(execution.state??''))void this.sync();
  }
  rejectPreflight=(error:unknown)=>{if(this.run)this.run.rejectPreflight(error);else this.set({error});};
  send=async(options:AgentSendOptions):Promise<boolean>=>{
    const run=this.run;if(!run||this.sending||this.snapshot.loading||this.snapshot.error||this.snapshot.syncing||this.snapshot.syncError)return false;
    const draft=this.snapshot.draft,version=this.draftVersion,binding=this.snapshot.timeline;if(!draft.trim()||!binding)return false;
    this.sending=true;
    try{
      await run.restore();const timeline=this.snapshot.timeline;
      if(this.run!==run||!timeline||timeline.conversationId!==binding.conversationId||timeline.bindingVersion!==binding.bindingVersion
        ||!timeline.sendAvailability.conversation||options.funding==='cash'&&!timeline.sendAvailability.cash)return false;
      const admitted=await run.send({type:'reply',message:draft},timeline.graphRevision,{...options,bindingVersion:timeline.bindingVersion},this.csrfToken);
      const error=run.getSnapshot().error;
      const rejected=run.getSnapshot().confirmedUnaccepted||error instanceof AgentApiError&&isBindingError(error);
      if(admitted&&!rejected){this.set({guidesDismissed:true,noticeError:null});if(version===this.draftVersion)this.setDraft('');}
      return admitted&&!rejected;
    }finally{this.sending=false;}
  };
  returnRejectedToEdit=async():Promise<boolean>=>{
    const action=this.run?.returnRejectedToEdit();if(!action)return false;
    if(action.type==='reply')this.setDraft(appendQuestion(this.snapshot.draft,action.message));
    await this.reload();return true;
  };
  stop=async(target?:AgentStatus)=>{
    if(!target||target.executionId===this.run?.getSnapshot().executionId){if(this.run){await this.run.stop(this.csrfToken);await this.sync();}return;}
    await this.blockerAction(target,()=>stopAgentExecution(target.executionId,target.conversationId,this.stopIdentity(target.executionId),this.csrfToken));
  };
  reconcile=async(target?:AgentStatus)=>{
    if(!target||target.executionId===this.run?.getSnapshot().executionId){if(this.run){await this.run.checkStatus();await this.sync();}return;}
    await this.blockerAction(target,()=>fetchAgentExecution(target.executionId,target.conversationId));
  };
  resume=async(apiKey:string,target?:AgentStatus)=>{
    if(!target||target.executionId===this.run?.getSnapshot().executionId){if(this.run){await this.run.retry(this.csrfToken,apiKey);await this.sync();}return;}
    await this.blockerAction(target,()=>resumeAgentExecution(target.executionId,target.conversationId,this.csrfToken,apiKey));
  };
  private stopIdentity(executionId:string){
    const key=`mapflow.global-assistant.stop.v1.${this.accountId}.${executionId}`;
    try{const saved=sessionStorage.getItem(key);if(saved&&/^[0-9a-f-]{36}$/i.test(saved))return saved;}catch{/* The current request still has a stable local identity. */}
    const identity=this.stopIds.get(executionId)??crypto.randomUUID();this.stopIds.set(executionId,identity);
    try{sessionStorage.setItem(key,identity);}catch{/* Repeated attempts in this visit still reuse the identity. */}return identity;
  }
  private stopIds=new Map<string,string>();
  private async blockerAction(target:AgentStatus,action:()=>Promise<AgentStatus>){
    if(this.snapshot.requestActions[target.executionId]?.busy)return;
    this.set({requestActions:{...this.snapshot.requestActions,[target.executionId]:{busy:true,error:null}}});
    try{
      const status=await action();if(!this.listeners.size)return;
      this.set({blockingExecutions:this.snapshot.blockingExecutions.flatMap(item=>item.executionId!==status.executionId?[item]:['succeeded','stopped','failed'].includes(status.state)?[]:[status])});
      if(status.result&&this.snapshot.timeline?.conversationId===status.conversationId)this.set({timeline:{...this.snapshot.timeline,completions:mergeCompletions(this.snapshot.timeline.completions,this.withKnownSettlement(status.result))}});
      if(!this.snapshot.timeline||this.snapshot.error instanceof GlobalAssistantApiError)await this.reload();else await this.sync();
    }catch(failure){if(this.listeners.size)this.set({requestActions:{...this.snapshot.requestActions,[target.executionId]:{busy:false,error:failure instanceof AgentApiError?failure:new PublicUiError('原请求状态暂时无法核对，请重试。')}}});}
    finally{if(this.listeners.size){const current=this.snapshot.requestActions[target.executionId];this.set({requestActions:{...this.snapshot.requestActions,[target.executionId]:{busy:false,error:current?.error??null}}});}}
  }
  approve=(approvalId:string,allowed:boolean,destructive:boolean)=>this.run?.resolveApproval(approvalId,allowed,destructive,this.csrfToken);
  loadOlder=async()=>{
    const timeline=this.snapshot.timeline,reader=this.reader;
    if(!timeline?.olderCursor||!reader||this.snapshot.loadingOlder||this.snapshot.loading)return;
    this.set({loadingOlder:true,historyError:null});
    try{const page=await fetchGlobalMessages(timeline,timeline.olderCursor,reader.signal);
      if(!this.current(reader)||!this.snapshot.timeline)return;
      const current=this.snapshot.timeline;
      this.set({timeline:{...current,messages:mergeById(page.messages,current.messages,item=>item.messageId),
        completions:mergeById(page.completions.map(this.withKnownSettlement),current.completions,item=>item.executionId),olderCursor:page.olderCursor}});
    }catch(historyError){if(this.current(reader)){if(isCursorError(historyError))await this.reload();else this.set({historyError});}}
    finally{if(this.current(reader))this.set({loadingOlder:false});}
  };
  sync=():Promise<void>=>{
    if(this.syncOperation){this.syncAgain=true;return this.syncOperation;}
    const reader=this.reader;if(!reader||!this.snapshot.timeline||this.snapshot.loading)return Promise.resolve();
    const operation=this.readChanges(reader);this.syncOperation=operation;
    void operation.finally(()=>{if(this.syncOperation===operation)this.syncOperation=null;});return operation;
  };
  private async readChanges(reader:AbortController){
    this.set({syncing:true,syncError:null});
    try{let more:boolean;
      do{
        this.syncAgain=false;const timeline=this.snapshot.timeline;if(!timeline||!this.current(reader))return;
        const run=this.run,expectedExecutionId=run?.getSnapshot().executionId??null;
        const page=await fetchGlobalChanges(timeline,timeline.syncCursor,reader.signal);if(!this.current(reader)||!this.snapshot.timeline)return;
        let {messages,completions}=this.snapshot.timeline;
        for(const change of page.changes){
          if(change.sequence<=this.lastSequence)continue;this.lastSequence=change.sequence;
          if(change.type==='message')messages=mergeById(messages,[change.message],item=>item.messageId);
          else if(change.type==='completion')completions=mergeCompletions(completions,this.withKnownSettlement(change.result));
          else {this.settlements.set(change.executionId,change);completions=completions.map(completion=>this.withKnownSettlement(completion));}
        }
        const {changes:_,nextCursor,hasMore,...projection}=page;
        this.set({timeline:{...this.snapshot.timeline,...projection,messages,completions,syncCursor:nextCursor},blockingExecutions:projection.blockingExecutions});
        if(run===this.run&&projection.activeExecution)run?.synchronizeStatus(projection.activeExecution,expectedExecutionId);
        else if(run===this.run&&expectedExecutionId===run?.getSnapshot().executionId&&run?.getSnapshot().pendingGeneration)void run.checkStatus();
        more=hasMore||this.syncAgain;
      }while(more&&this.current(reader));
    }catch(syncError){if(this.current(reader)){if(isCursorError(syncError))await this.reload();else this.set({syncError});}}
    finally{if(this.current(reader))this.set({syncing:false});}
  }
  private withKnownSettlement=(completion:AgentCompletion):AgentCompletion=>{
    const update=this.settlements.get(completion.executionId);return update?{...completion,settlement:update.settlement,usage:update.usage}:completion;
  };
}
function mergeById<T>(earlier:T[],later:T[],identify:(item:T)=>string):T[]{
  const merged=new Map(earlier.map(item=>[identify(item),item]));later.forEach(item=>merged.set(identify(item),item));return [...merged.values()];
}
function mergeCompletions(existing:AgentCompletion[],incoming:AgentCompletion):AgentCompletion[]{
  const current=existing.find(completion=>completion.executionId===incoming.executionId);
  if(current&&['settled','no_site_charge','audit_only'].includes(current.settlement.status)&&['pending_evidence','pending_posting'].includes(incoming.settlement.status))return existing;
  return mergeById(existing,[incoming],completion=>completion.executionId);
}
function isBindingError(error:AgentApiError){return ['global_conversation_not_current','global_assistant_client_upgrade_required','global_assistant_migration_pending'].includes(error.code);}
function isCursorError(error:unknown){return error instanceof AgentApiError&&error.code==='global_assistant_cursor_invalid';}
