import type {GenerationAction} from '../tavern/types';
import {PublicUiError} from '../../lib/publicErrors';

export type AgentFunding='cash'|'points'|'byok';
export type AgentState='queued'|'running'|'recovering'|'awaiting_reconciliation'|'ready_to_commit'|'succeeded'|'stopped'|'failed';
export interface AgentUsage {inputTokens:number;outputTokens:number;cacheHitInputTokens?:number|null;cacheMissInputTokens?:number|null}
export interface AgentSettlement {status:'settled'|'no_site_charge'|'audit_only'|'pending_evidence'|'pending_posting';cashMicros:number|null;pointUnits:number|null;balanceMicros:number|null}
export interface AgentCompletion {executionId:string;conversationId:string;generationId:string;messageId:string;answer:string;
  maps:{treeId:string;libraryEntryId:string;title:string}[];usage:AgentUsage|null;settlement:AgentSettlement}
export interface AgentStatus {executionId:string;conversationId:string;state:AgentState;funding:AgentFunding;modelId:string;result:AgentCompletion|null;
  error:{code:string;message:string;requestId:string}|null}
export interface PublicAgentModel {profileId:string;profileVersion:number;modelId:string;displayName:string;contextWindow:number;maxOutputTokens:number|null}
export interface AgentModelCatalogue {cash:PublicAgentModel[];defaultCash:PublicAgentModel|null;points:PublicAgentModel|null}
export interface AgentExecutionCommand {clientActionId:string;expectedRevision:number;action:GenerationAction;funding:AgentFunding;profileId?:string;profileVersion?:number;
  modelAccess?:{apiKey:string;baseUrl:string;model:string;contextWindow:number;maxOutputTokens?:number|null;
    reasoningProtocol:'none'|'deepseek'|'siliconflow'|'openai_reasoning';reasoningSupported:boolean}}
export type AgentPayload={type:'text_delta'|'reasoning_delta';text:string}|{type:'completed';result:AgentCompletion}
  |{type:'settlement';settlement:AgentSettlement;usage:AgentUsage|null}|{type:'tool_process';toolName:string;state:string;callId:string}|{type:'stopped'};
export interface AgentEvent {executionId:string;eventId:string;sequence:number;payload:AgentPayload}
export interface AgentAttachment {nextSequence:number;state:AgentState}
export class AgentApiError extends PublicUiError {
  constructor(readonly code:string,readonly status:number,readonly requestId?:string){super(errorMessage(code));this.name='AgentApiError';}
}
const root='/api/me/agent-executions';
const states:AgentState[]=['queued','running','recovering','awaiting_reconciliation','ready_to_commit','succeeded','stopped','failed'];
const terminal=(state:AgentState)=>['succeeded','stopped','failed'].includes(state);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown):value is number=>Number.isSafeInteger(value);
const natural=(value:unknown):value is number=>integer(value)&&value>=0;
const positive=(value:unknown):value is number=>natural(value)&&value>0;
const text=(value:unknown):value is string=>typeof value==='string';
const uuid=(value:unknown):value is string=>text(value)&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const exact=(value:Record<string,unknown>,fields:string[])=>Object.keys(value).every(field=>fields.includes(field));
function invalid():never {throw new Error('执行响应无效，请重新读取。');}
function pathId(identity:string){if(!uuid(identity))invalid();return encodeURIComponent(identity);}
function errorMessage(code:string){return code==='server_network_unavailable'?'服务器网络异常，请稍后重试。':code==='cash_non_positive'?'现金额度不足，请充值后继续。':
  code==='credential_required'?'请打开配置并填写 API Key。':code==='awaiting_reconciliation'?'本次请求正在核对，请稍后查看。':'请求暂时失败，请稍后重试。';}
const headers=(csrf:string)=>({Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf});
async function request(path:string,options:RequestInit={}):Promise<Response>{
  const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json'},...options});
  if(response.ok)return response;
  let failure:unknown;try{failure=await response.json();}catch{failure=null;}
  const error=record(failure)&&record(failure.error)?failure.error:{};
  throw new AgentApiError(text(error.code)?error.code:'request_failed',response.status,uuid(error.requestId)?error.requestId:undefined);
}
function usage(value:unknown):AgentUsage|null{
  if(value===null)return null;
  if(!record(value)||!exact(value,['inputTokens','outputTokens','cacheHitInputTokens','cacheMissInputTokens'])
    ||!natural(value.inputTokens)||!natural(value.outputTokens)
    ||['cacheHitInputTokens','cacheMissInputTokens'].some(key=>value[key]!==undefined&&value[key]!==null&&!natural(value[key])))invalid();
  return value as unknown as AgentUsage;
}
function settlement(value:unknown):AgentSettlement{
  if(!record(value)||!exact(value,['status','cashMicros','pointUnits','balanceMicros'])
    ||!['settled','no_site_charge','audit_only','pending_evidence','pending_posting'].includes(String(value.status))
    ||!(value.cashMicros===null||natural(value.cashMicros))||!(value.pointUnits===null||natural(value.pointUnits))
    ||!(value.balanceMicros===null||integer(value.balanceMicros)))invalid();
  return value as unknown as AgentSettlement;
}
function completion(value:unknown,execution:string,conversation:string):AgentCompletion{
  if(!record(value)||!exact(value,['executionId','conversationId','generationId','messageId','answer','maps','usage','settlement'])
    ||value.executionId!==execution||value.conversationId!==conversation||!uuid(value.generationId)||!uuid(value.messageId)||!text(value.answer)
    ||!Array.isArray(value.maps)||value.maps.some(map=>!record(map)||!exact(map,['treeId','libraryEntryId','title'])||!uuid(map.treeId)||!uuid(map.libraryEntryId)||!text(map.title)))invalid();
  return {...value,usage:usage(value.usage),settlement:settlement(value.settlement)} as unknown as AgentCompletion;
}
function status(value:unknown,conversation:string,execution?:string):AgentStatus{
  if(!record(value)||!exact(value,['executionId','conversationId','state','funding','modelId','result','error'])
    ||!uuid(value.executionId)||(execution!==undefined&&value.executionId!==execution)||value.conversationId!==conversation
    ||!states.includes(value.state as AgentState)||!['cash','points','byok'].includes(String(value.funding))||!text(value.modelId))invalid();
  let error:AgentStatus['error']=null;
  if(value.error!==null){if(!record(value.error)||!text(value.error.code)||!uuid(value.error.requestId))invalid();
    error={code:value.error.code,message:errorMessage(value.error.code),requestId:value.error.requestId};}
  return {...value,error,result:value.result===null?null:completion(value.result,value.executionId,conversation)} as unknown as AgentStatus;
}
function model(value:unknown):PublicAgentModel{
  if(!record(value)||!exact(value,['profileId','profileVersion','modelId','displayName','contextWindow','maxOutputTokens'])
    ||!text(value.profileId)||!positive(value.profileVersion)||!text(value.modelId)||!text(value.displayName)||!positive(value.contextWindow)
    ||!(value.maxOutputTokens===null||positive(value.maxOutputTokens)))invalid();
  return value as unknown as PublicAgentModel;
}
export async function fetchAgentModelCatalogue(signal?:AbortSignal):Promise<AgentModelCatalogue>{
  const value:unknown=await(await request('/api/me/agent-models',{signal})).json();
  if(!record(value)||!exact(value,['cash','defaultCash','points'])||!Array.isArray(value.cash))invalid();
  return {cash:value.cash.map(model),defaultCash:value.defaultCash===null?null:model(value.defaultCash),points:value.points===null?null:model(value.points)};
}
export async function acceptAgentExecution(conversation:string,command:AgentExecutionCommand,csrf:string,signal?:AbortSignal):Promise<{execution:AgentStatus;replayed:boolean}>{
  const value:unknown=await(await request(`/api/me/tavern/conversations/${pathId(conversation)}/executions`,{
    method:'POST',headers:headers(csrf),body:JSON.stringify(command),signal})).json();
  if(!record(value)||typeof value.replayed!=='boolean')invalid();
  const accepted=status(value.execution,conversation);if(accepted.funding!==command.funding)invalid();
  return {execution:accepted,replayed:value.replayed};
}
export async function fetchAgentExecution(execution:string,conversation:string,signal?:AbortSignal):Promise<AgentStatus>{
  return status(await(await request(`${root}/${pathId(execution)}`,{signal})).json(),conversation,execution);
}
export async function fetchActiveAgentExecution(conversation:string,signal?:AbortSignal):Promise<AgentStatus|null>{
  const value:unknown=await(await request(`/api/me/tavern/conversations/${pathId(conversation)}/executions`,{signal})).json();
  if(!record(value)||!exact(value,['execution']))invalid();return value.execution===null?null:status(value.execution,conversation);
}
export async function stopAgentExecution(execution:string,conversation:string,clientActionId:string,csrf:string):Promise<AgentStatus>{
  return status(await(await request(`${root}/${pathId(execution)}/stop`,{method:'POST',headers:headers(csrf),body:JSON.stringify({clientActionId})})).json(),conversation,execution);
}
export async function resumeAgentExecution(execution:string,conversation:string,csrf:string,apiKey?:string):Promise<AgentStatus>{
  return status(await(await request(`${root}/${pathId(execution)}/resume`,{method:'POST',headers:headers(csrf),body:JSON.stringify(apiKey?{apiKey}:{})})).json(),conversation,execution);
}
function payload(value:unknown,execution:string,conversation:string):AgentPayload{
  if(!record(value))invalid();
  switch(value.type){
    case 'text_delta':case 'reasoning_delta':if(!text(value.text)||!exact(value,['type','text']))invalid();return value as AgentPayload;
    case 'completed':return {type:'completed',result:completion(value.result,execution,conversation)};
    case 'settlement':return {type:'settlement',settlement:settlement(value.settlement),usage:usage(value.usage)};
    case 'tool_process':if(!text(value.toolName)||!text(value.state)||!text(value.callId)||!exact(value,['type','toolName','state','callId']))invalid();return value as AgentPayload;
    case 'stopped':return {type:'stopped'};
    default:invalid();
  }
}
/** A subscriber owns only its reader. Disconnect and abort never mutate the durable task. */
export async function attachAgentExecution(execution:string,conversation:string,afterSequence:number,onEvent:(event:AgentEvent)=>void,signal:AbortSignal):Promise<AgentAttachment>{
  if(!natural(afterSequence))invalid();
  const response=await request(`${root}/${pathId(execution)}/events?afterSequence=${afterSequence}`,{method:'GET',headers:{Accept:'text/event-stream'},signal});
  if(!response.headers.get('Content-Type')?.includes('text/event-stream')||!response.body)invalid();
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',nextSequence=afterSequence,state:AgentState='running';
  const aborted=()=>{void reader.cancel(signal.reason).catch(()=>undefined);};signal.addEventListener('abort',aborted,{once:true});
  try{
    signal.throwIfAborted();
    while(!terminal(state)){
      const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      let boundary:RegExpExecArray|null;
      while((boundary=/\r?\n\r?\n/.exec(buffer))!==null){
        const frame=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);
        const lines=frame.split(/\r?\n/),name=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
        const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
        if(!data||(name!==undefined&&name!=='progress'))continue;
        let page:unknown;try{page=JSON.parse(data);}catch{invalid();}
        if(!record(page)||!Array.isArray(page.events)||!natural(page.nextSequence)||!states.includes(page.state as AgentState))invalid();
        const pageSequence=page.nextSequence;if(pageSequence<nextSequence)continue;
        const events=page.events.map((event:unknown):AgentEvent=>{
          if(!record(event)||event.executionId!==execution||!uuid(event.eventId)||!positive(event.sequence)||event.sequence>pageSequence)invalid();
          return {...event,payload:payload(event.payload,execution,conversation)} as AgentEvent;
        }).sort((left,right)=>left.sequence-right.sequence);
        for(const event of events)if(event.sequence>nextSequence){onEvent(event);nextSequence=event.sequence;}
        nextSequence=Math.max(nextSequence,pageSequence);state=page.state as AgentState;if(terminal(state))break;
      }
    }
    return {nextSequence,state};
  }finally{signal.removeEventListener('abort',aborted);await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
