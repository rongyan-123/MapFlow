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
