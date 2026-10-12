export type AgentFunding='cash'|'points';
export interface AgentModelProfile {
  funding:AgentFunding;displayName:string;
  snapshot:{profileId:string;profileVersion:number;adapter:'deepseek'|'openai_compatible';baseUrl:string;modelId:string;
    credentialId:string;credentialVersion:number;contextWindow:number;maxOutputTokens:number|null;
    toolsSupported:boolean;streamSupported:boolean;reasoning:string|null;billingPolicy:string;actualFeeSupported:boolean};
  parameterPolicy:{reasoningProtocol:'none'|'deepseek'|'siliconflow'|'openai_reasoning';supportedFields:string[];defaults:Record<string,unknown>};
  pointsPolicy:{inputUnitsPerMillion:number;cacheHitUnitsPerMillion:number;outputUnitsPerMillion:number}|null;
}
export interface AgentModelConfiguration {profiles:AgentModelProfile[];activeCash:{profile:AgentModelProfile;epoch:number}|null;activePoints:{profile:AgentModelProfile;epoch:number}|null}
export interface AgentModelActivation {funding:AgentFunding;profileId:string;profileVersion:number;expectedEpoch:number}
const object=(value:unknown):value is Record<string,unknown>=>!!value && typeof value==='object' && !Array.isArray(value);
const nonnegative=(value:unknown):value is number=>Number.isSafeInteger(value) && (value as number)>=0;
const positive=(value:unknown):value is number=>nonnegative(value) && value>0;
function profile(value:unknown):value is AgentModelProfile {
  if (!object(value) || !['cash','points'].includes(String(value.funding)) || typeof value.displayName!=='string'
      || Object.keys(value).some(key=>!['funding','displayName','snapshot','parameterPolicy','pointsPolicy'].includes(key))) return false;
  const model=value.snapshot,policy=value.parameterPolicy,points=value.pointsPolicy;
  const fields=['profileId','profileVersion','adapter','baseUrl','modelId','credentialId','credentialVersion','contextWindow',
    'maxOutputTokens','toolsSupported','streamSupported','reasoning','billingPolicy','actualFeeSupported'];
  if (!object(model) || Object.keys(model).some(key=>!fields.includes(key))
      || !['profileId','modelId','baseUrl','credentialId','billingPolicy'].every(key=>typeof model[key]==='string')
      || !['profileVersion','credentialVersion','contextWindow'].every(key=>positive(model[key]))
      || !(model.maxOutputTokens===null || positive(model.maxOutputTokens))
      || !(model.reasoning===null || typeof model.reasoning==='string')
      || !['toolsSupported','streamSupported','actualFeeSupported'].every(key=>typeof model[key]==='boolean')
      || !['deepseek','openai_compatible'].includes(String(model.adapter))) return false;
  return object(policy) && Object.keys(policy).every(key=>['reasoningProtocol','supportedFields','defaults'].includes(key))
    && ['none','deepseek','siliconflow','openai_reasoning'].includes(String(policy.reasoningProtocol))
    && Array.isArray(policy.supportedFields) && policy.supportedFields.every(field=>typeof field==='string')
    && object(policy.defaults) && Object.keys(policy.defaults).every(field=>(policy.supportedFields as string[]).includes(field))
    && (value.funding==='cash' ? points===null : object(points) && Object.keys(points).length===3
      && ['inputUnitsPerMillion','cacheHitUnitsPerMillion','outputUnitsPerMillion'].every(key=>nonnegative(points[key])));
}
function configuration(value:unknown):AgentModelConfiguration {
  if (!object(value) || !Array.isArray(value.profiles) || !value.profiles.every(profile)
      || !['activeCash','activePoints'].every(key=>value[key]===null || object(value[key]) && profile(value[key].profile) && positive(value[key].epoch))) {
    throw new Error('模型配置响应无效，请重新读取。');
  }
  return value as unknown as AgentModelConfiguration;
}
async function request(path:string,init?:RequestInit):Promise<AgentModelConfiguration> {
  const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json'},...init});
  if (!response.ok) throw new Error(response.status===409?'配置已更新，请重新读取后再试。':response.status===403?'当前账号无权修改模型配置。':'连接测试或配置保存失败，原配置仍在使用。');
  return configuration(await response.json());
}
const headers=(csrf:string)=>({Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf});
export const fetchAgentModelConfiguration=()=>request('/api/admin/agent-models');
export const activateAgentModelProfile=(activation:AgentModelActivation,csrf:string)=>request('/api/admin/agent-models/active',{
  method:'PUT',headers:headers(csrf),body:JSON.stringify(activation)});
export const saveAgentModelProfile=(body:{profile:AgentModelProfile;apiKey?:string},csrf:string)=>request('/api/admin/agent-models',{
  method:'POST',headers:headers(csrf),body:JSON.stringify(body)});

export interface AgentSettlementAttention {
  executionId:string;accountId:string;conversationId:string;funding:'cash'|'points'|'byok';status:string;
  cashMicros:number|null;pointUnits:number|null;checkedAt:string|null;attentionKey:string;reason:string;
  diagnostic:Record<string,unknown>;
  calls:{callId:string;status:string;usage:import('../assistant/agentExecutionClient').AgentUsage|null;
    receipts:{receiptId:string;currency:string;amount:string;validationError:string|null}[]}[];
}
export interface AgentSettlementPage {pending:AgentSettlementAttention[];nextBefore:string|null;totalCount:number}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const only=(value:Record<string,unknown>,fields:string[])=>Object.keys(value).every(key=>fields.includes(key));
export async function fetchAgentSettlementAttention(before?:string):Promise<AgentSettlementPage> {
  if(before!==undefined&&!uuid(before))throw new Error('费用核对游标无效。');
  const response=await fetch(`/api/admin/agent-settlements${before?`?before=${encodeURIComponent(before)}`:''}`,{credentials:'same-origin',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('费用核对记录暂时无法读取。');
  const body:unknown=await response.json();
  const invalid=()=>new Error('费用核对响应无效。');
  if(!object(body)||!only(body,['pending','nextBefore','totalCount'])||!Array.isArray(body.pending)
    ||!(body.nextBefore===null||uuid(body.nextBefore))||!nonnegative(body.totalCount))throw invalid();
  for(const row of body.pending) {
    if(!object(row)||!only(row,['executionId','accountId','conversationId','funding','status','cashMicros','pointUnits','checkedAt','attentionKey','reason','diagnostic','calls'])
      ||!['executionId','accountId','conversationId'].every(key=>uuid(row[key]))||!['cash','points','byok'].includes(String(row.funding))
      ||!['pending_evidence','pending_posting','settled','no_site_charge','audit_only'].includes(String(row.status))
      ||!['cashMicros','pointUnits'].every(key=>row[key]===null||nonnegative(row[key]))
      ||!(row.checkedAt===null||typeof row.checkedAt==='string')||typeof row.attentionKey!=='string'||typeof row.reason!=='string'
      ||!object(row.diagnostic)||!Array.isArray(row.calls))throw invalid();
    for(const call of row.calls) {
      if(!object(call)||!only(call,['callId','status','usage','receipts'])||!uuid(call.callId)||typeof call.status!=='string'||!Array.isArray(call.receipts))throw invalid();
      if(call.usage!==null&&(!object(call.usage)||!only(call.usage,['inputTokens','outputTokens','cacheHitInputTokens','cacheMissInputTokens'])
        ||!nonnegative(call.usage.inputTokens)||!nonnegative(call.usage.outputTokens)
        ||['cacheHitInputTokens','cacheMissInputTokens'].some(key=>call.usage!==null&&object(call.usage)&&call.usage[key]!=null&&!nonnegative(call.usage[key]))))throw invalid();
      for(const receipt of call.receipts)if(!object(receipt)||!only(receipt,['receiptId','currency','amount','validationError'])
        ||!['receiptId','currency','amount'].every(key=>typeof receipt[key]==='string')||!(receipt.validationError===null||typeof receipt.validationError==='string'))throw invalid();
    }
  }
  return body as unknown as AgentSettlementPage;
}
