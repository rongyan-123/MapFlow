import {request,readFailure} from './http';
import {AgentApiError,parseAgentCompletion,parseAgentStatus,parseAgentSettlement,parseAgentUsage,
  type AgentCompletion,type AgentStatus,type AgentSettlement,type AgentUsage} from './agentExecutionClient';
import type {GenerationSettings,GraphMessage} from '../domains/conversations/types';
import {PublicUiError} from '../lib/publicErrors';

export interface GlobalSendAvailability {conversation:boolean;cash:boolean}
export interface GlobalBinding {conversationId:string;bindingVersion:number}
export interface GlobalGraphMessage extends GraphMessage {bodyRef?:{totalChars:number;nextOffset:number}}
export interface GlobalMessageBodyPage extends GlobalBinding {messageId:string;content:string;offset:number;nextOffset:number|null;totalChars:number}
export interface GlobalSnapshot extends GlobalBinding {
  graphRevision:number;headMessageId:string|null;messages:GlobalGraphMessage[];completions:AgentCompletion[];
  olderCursor:string|null;syncCursor:string;generationSettings:GenerationSettings;generationSettingsVersion:number;
  activeExecution:AgentStatus|null;blockingExecutions:AgentStatus[];sendAvailability:GlobalSendAvailability;
}
export interface GlobalMessagePage extends GlobalBinding {messages:GlobalGraphMessage[];completions:AgentCompletion[];olderCursor:string|null}
export type GlobalChange=
  | {sequence:number;type:'message';message:GlobalGraphMessage}
  | {sequence:number;type:'completion';result:AgentCompletion}
  | {sequence:number;type:'settlement';executionId:string;settlement:AgentSettlement;usage:AgentUsage|null};
export interface GlobalChangePage extends GlobalBinding {
  graphRevision:number;headMessageId:string|null;changes:GlobalChange[];nextCursor:string;hasMore:boolean;
  activeExecution:AgentStatus|null;blockingExecutions:AgentStatus[];sendAvailability:GlobalSendAvailability;
}
export class GlobalAssistantApiError extends AgentApiError {
  constructor(code:string,status:number,readonly blockingExecutions:AgentStatus[],requestId?:string){super(code,status,requestId);this.name='GlobalAssistantApiError';}
}
const root='/api/me/global-assistant';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const natural=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
const positive=(value:unknown):value is number=>natural(value)&&value>0;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const cursor=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const nullableCursor=(value:unknown):value is string|null=>value===null||cursor(value);
function invalid():never {throw new PublicUiError('助手同步响应无效，请重新读取最近消息。');}
function binding(value:unknown,expected?:GlobalBinding):Record<string,unknown>&GlobalBinding {
  if(!record(value)||!uuid(value.conversationId)||!positive(value.bindingVersion)
    ||expected&&(expected.conversationId!==value.conversationId||expected.bindingVersion!==value.bindingVersion))invalid();
  return value as Record<string,unknown>&GlobalBinding;
}
function message(value:unknown):GlobalGraphMessage {
  if(!record(value)||!uuid(value.messageId)||!(value.parentMessageId===null||uuid(value.parentMessageId))
    ||!['user','assistant','system'].includes(String(value.role))||!['opening','user','model','continue','edit','migration'].includes(String(value.origin))
    ||!(value.characterId===null||uuid(value.characterId))||typeof value.content!=='string'
    ||value.characterName!==undefined&&value.characterName!==null&&typeof value.characterName!=='string')invalid();
  const loaded=Array.from(value.content).length,reference=value.bodyRef;
  if(loaded>8192||reference!==undefined&&(!record(reference)||!positive(reference.totalChars)||!positive(reference.nextOffset)
    ||reference.nextOffset!==loaded||reference.nextOffset>=reference.totalChars))invalid();
  return value as unknown as GlobalGraphMessage;
}
function list<T>(value:unknown,maximum:number,parse:(item:unknown)=>T):T[] {
  if(!Array.isArray(value)||value.length>maximum)invalid();return value.map(parse);
}
function settings(value:unknown):GenerationSettings {
  if(!record(value)||!(value.temperature===undefined||typeof value.temperature==='number'&&Number.isFinite(value.temperature)&&value.temperature>=0&&value.temperature<=2)
    ||!(value.maxOutputTokens===null||positive(value.maxOutputTokens))||!Array.isArray(value.stopSequences)||value.stopSequences.length>4||value.stopSequences.some(word=>typeof word!=='string'))invalid();
  return value as unknown as GenerationSettings;
}
function execution(value:unknown,conversationId?:string):AgentStatus {
  if(!record(value)||!uuid(value.conversationId))invalid();return parseAgentStatus(value,conversationId??value.conversationId);
}
function executionProjection(value:Record<string,unknown>,conversationId:string) {
  const availability=value.sendAvailability;
  if(!record(availability)||typeof availability.conversation!=='boolean'||typeof availability.cash!=='boolean')invalid();
  return {activeExecution:value.activeExecution===null?null:execution(value.activeExecution,conversationId),
    blockingExecutions:list(value.blockingExecutions,2,item=>execution(item)),sendAvailability:{conversation:availability.conversation,cash:availability.cash}};
}
function revision(value:Record<string,unknown>) {
  if(!natural(value.graphRevision)||!(value.headMessageId===null||uuid(value.headMessageId)))invalid();
  return {graphRevision:value.graphRevision,headMessageId:value.headMessageId};
}
async function json(path:string,options:RequestInit={}) {
  const response=await request(path,options);
  if(!response.ok){
    const envelope:unknown=await response.clone().json().catch(()=>null);
    const failure=await readFailure(response);
    const blockers=failure.code==='global_assistant_migration_pending'&&record(envelope)&&record(envelope.error)
      ?list(envelope.error.blockingExecutions??[],2,item=>execution(item)):[];
    throw new GlobalAssistantApiError(failure.code,response.status,blockers,uuid(failure.requestId)?failure.requestId:undefined);
  }
  return await response.json() as unknown;
}
export async function openGlobalAssistant(csrfToken:string,signal?:AbortSignal):Promise<GlobalSnapshot> {
  const value=binding(await json(`${root}/open`,{method:'POST',headers:{Accept:'application/json','X-CSRF-Token':csrfToken},signal}));
  if(!nullableCursor(value.olderCursor)||!cursor(value.syncCursor)||!positive(value.generationSettingsVersion))invalid();
  return {conversationId:value.conversationId,bindingVersion:value.bindingVersion,...revision(value),messages:list(value.messages,40,message),
    completions:list(value.completions,40,item=>parseAgentCompletion(item,value.conversationId)),olderCursor:value.olderCursor,syncCursor:value.syncCursor,
    generationSettings:settings(value.generationSettings),generationSettingsVersion:value.generationSettingsVersion,...executionProjection(value,value.conversationId)};
}
export async function fetchGlobalMessages(expected:GlobalBinding,before:string,signal?:AbortSignal):Promise<GlobalMessagePage> {
  if(!cursor(before))invalid();
  const value=binding(await json(`${root}/messages?before=${encodeURIComponent(before)}&limit=40`,{signal}),expected);
  if(!nullableCursor(value.olderCursor))invalid();
  return {conversationId:value.conversationId,bindingVersion:value.bindingVersion,messages:list(value.messages,100,message),
    completions:list(value.completions,100,item=>parseAgentCompletion(item,value.conversationId)),olderCursor:value.olderCursor};
}
export async function fetchGlobalMessageBody(expected:GlobalBinding,messageId:string,offset:number,signal?:AbortSignal):Promise<GlobalMessageBodyPage> {
  if(!uuid(messageId)||!natural(offset))invalid();
  const value=binding(await json(`${root}/messages/${encodeURIComponent(messageId)}/body?offset=${offset}&limit=8192`,{signal}),expected);
  if(value.messageId!==messageId||value.offset!==offset||typeof value.content!=='string'||!natural(value.totalChars))invalid();
  const count=Array.from(value.content).length,end=offset+count;
  if(count>8192||end>value.totalChars||!(value.nextOffset===null?end===value.totalChars:natural(value.nextOffset)&&value.nextOffset===end&&value.nextOffset>offset&&value.nextOffset<value.totalChars))invalid();
  return {conversationId:value.conversationId,bindingVersion:value.bindingVersion,messageId,content:value.content,offset,nextOffset:value.nextOffset as number|null,totalChars:value.totalChars};
}
export async function fetchGlobalChanges(expected:GlobalBinding,after:string,signal?:AbortSignal):Promise<GlobalChangePage> {
  if(!cursor(after))invalid();
  const value=binding(await json(`${root}/changes?after=${encodeURIComponent(after)}&limit=100`,{signal}),expected);
  if(!cursor(value.nextCursor)||typeof value.hasMore!=='boolean'||value.hasMore&&value.nextCursor===after)invalid();
  let previousSequence=0;
  const changes=list(value.changes,100,(item):GlobalChange=>{
    if(!record(item)||!positive(item.sequence)||item.sequence<=previousSequence)invalid();previousSequence=item.sequence;
    if(item.type==='message')return {sequence:item.sequence,type:'message',message:message(item.message)};
    if(item.type==='completion')return {sequence:item.sequence,type:'completion',result:parseAgentCompletion(item.result,value.conversationId)};
    if(item.type==='settlement'&&uuid(item.executionId))return {sequence:item.sequence,type:'settlement',executionId:item.executionId,settlement:parseAgentSettlement(item.settlement),usage:parseAgentUsage(item.usage)};
    return invalid();
  });
  return {conversationId:value.conversationId,bindingVersion:value.bindingVersion,...revision(value),changes,nextCursor:value.nextCursor,hasMore:value.hasMore,...executionProjection(value,value.conversationId)};
}
