import type { AgentFunding } from '../../api/agentExecutionClient';
import { readModelSelection } from './preferences';
export const modelPurposes=['management','learning','tavern','study_plan'] as const;
export type ModelPurpose=typeof modelPurposes[number];
export const purposeNames:Record<ModelPurpose,string>={management:'全局助手',learning:'学习聊天',tavern:'酒馆聊天',study_plan:'学习计划'};
export interface SceneModelPreference{funding:AgentFunding|null;profileId:string;contextWindow:string;maxOutputTokens:string;reasoningProtocol:'none'|'deepseek'|'siliconflow'|'openai_reasoning';reasoningSupported:boolean;model:string;baseUrl:string;historyBytes:8192|16384|32768}
export function readLegacyScenePreference(account:string):SceneModelPreference{
  let legacy:Partial<SceneModelPreference>={};try{legacy=JSON.parse(localStorage.getItem(`mapflow.agent.selection.v1.${account}`)??'{}');}catch{/* Defaults are migrated once. */}
  const custom=readModelSelection(account,'custom');
  return {funding:['cash','points','byok'].includes(legacy?.funding??'')?legacy.funding!:null,profileId:typeof legacy?.profileId==='string'?legacy.profileId:'',contextWindow:typeof legacy?.contextWindow==='string'?legacy.contextWindow:'',maxOutputTokens:typeof legacy?.maxOutputTokens==='string'?legacy.maxOutputTokens:'',reasoningProtocol:['none','deepseek','siliconflow','openai_reasoning'].includes(legacy?.reasoningProtocol??'')?legacy.reasoningProtocol!:'none',reasoningSupported:legacy?.reasoningSupported===true,model:custom.model,baseUrl:custom.baseUrl,historyBytes:custom.historyBytes};
}
