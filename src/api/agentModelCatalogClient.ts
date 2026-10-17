import {request} from './http';
import type {AgentModelConfiguration} from './agentModelClient';
export interface ModelCandidate{
  modelId:string;displayName:string;profileId:string|null;profileVersion:number|null;status:'active'|'disabled'|'unknown'|'unadapted';reason:string|null;
  sourceGeneration:number|null;publicationGeneration:number|null;adminEnabled:boolean|null;selectable:boolean;verificationStandard:number|null;verifiedAt:string|null;
  latestAttempt:{batchId:string;attemptId:string;state:string;reason:string|null}|null;
}
export interface ModelCatalog{
  schemaVersion:1;source:Record<string,unknown>;lastSync:{syncId:string;generation:number;state:string;reason:string|null;completedAt:string|null}|null;
  candidates:ModelCandidate[];recentBatches:string[];
}
export interface ModelProbeAttempt{attemptId:string;executionId:string;profileId:string;profileVersion:number;state:string;reason:string|null;cancelRequested:boolean;streamed:boolean;readTool:boolean}
export interface ModelProbeBatch{batchId:string;clientActionId:string;cancelRequested:boolean;attempts:ModelProbeAttempt[]}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const positive=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>0;
const nullableText=(value:unknown)=>value===null||typeof value==='string';
async function read(path:string,init?:RequestInit):Promise<unknown>{
  const response=await request(path,{credentials:'same-origin',...init});
  if(!response.ok){
    let code='';try{const body=await response.json();code=body?.error?.code??'';}catch{/* Status remains authoritative. */}
    throw new Error(response.status===404?'服务端尚未升级，暂不能管理模型目录。':response.status===403?'当前账号无权操作，或登录校验已失效。':
      code==='client_upgrade_required'?'请刷新管理页面后操作，这个配置使用了新版参数合同。':response.status===409?'状态已更新，或原验证结果尚未确认。请重新读取记录。':'操作未完成，已保存的目录和验证记录仍然保留。');
  }return response.json();
}
const mutation=(method:string,csrf:string,body?:unknown):RequestInit=>({method,headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
export async function fetchModelCatalog():Promise<ModelCatalog>{
  const body=await read('/api/admin/agent-model-catalog');
  if(!object(body)||body.schemaVersion!==1||!object(body.source)||!Array.isArray(body.candidates)||!Array.isArray(body.recentBatches)||body.recentBatches.some(id=>typeof id!=='string'))throw new Error('模型目录响应无效。');
  for(const item of body.candidates){
    if(!object(item)||typeof item.modelId!=='string'||typeof item.displayName!=='string'||!nullableText(item.profileId)||!nullableText(item.reason)
      ||!['active','disabled','unknown','unadapted'].includes(String(item.status))||typeof item.selectable!=='boolean'
      ||!(item.adminEnabled===null||typeof item.adminEnabled==='boolean')||!(item.profileVersion===null||positive(item.profileVersion))
      ||!(item.publicationGeneration===null||positive(item.publicationGeneration)))throw new Error('模型候选项响应无效。');
  }
  return body as unknown as ModelCatalog;
}
function batch(body:unknown):ModelProbeBatch{
  if(!object(body)||typeof body.batchId!=='string'||typeof body.clientActionId!=='string'||typeof body.cancelRequested!=='boolean'||!Array.isArray(body.attempts))throw new Error('模型验证响应无效。');
  for(const attempt of body.attempts)if(!object(attempt)||typeof attempt.attemptId!=='string'||typeof attempt.executionId!=='string'||typeof attempt.profileId!=='string'
    ||!positive(attempt.profileVersion)||!['queued','running','completed','failed','outcome_unknown','blocked_reconstruction','cancelled','superseded'].includes(String(attempt.state))
    ||!nullableText(attempt.reason)||typeof attempt.cancelRequested!=='boolean')throw new Error('模型验证记录无效。');
  return body as unknown as ModelProbeBatch;
}
export const syncModelCatalog=(clientActionId:string,sourceProfileId:string,csrf:string)=>read('/api/admin/agent-model-catalog/sync',mutation('POST',csrf,{clientActionId,sourceProfileId}));
export const createModelVerificationBatch=async(clientActionId:string,profileIds:string[],csrf:string)=>batch(await read('/api/admin/agent-model-verification-batches',mutation('POST',csrf,{clientActionId,profileIds})));
export const fetchModelVerificationBatch=async(id:string)=>batch(await read(`/api/admin/agent-model-verification-batches/${encodeURIComponent(id)}`));
export const cancelModelVerificationBatch=async(id:string,csrf:string)=>batch(await read(`/api/admin/agent-model-verification-batches/${encodeURIComponent(id)}/cancel`,mutation('POST',csrf)));
export const recheckModelVerificationBatch=async(id:string,csrf:string)=>batch(await read(`/api/admin/agent-model-verification-batches/${encodeURIComponent(id)}/recheck`,mutation('POST',csrf)));
export const setModelAvailability=(id:string,generation:number,enabled:boolean,csrf:string)=>read(`/api/admin/agent-model-catalog/${encodeURIComponent(id)}/availability`,mutation('PUT',csrf,{expectedPublicationGeneration:generation,enabled}));
export const setDefaultCashModel=async(id:string,version:number,generation:number,epoch:number,csrf:string)=>await read('/api/admin/agent-model-catalog/default',mutation('PUT',csrf,{profileId:id,profileVersion:version,expectedPublicationGeneration:generation,expectedEpoch:epoch})) as AgentModelConfiguration;
