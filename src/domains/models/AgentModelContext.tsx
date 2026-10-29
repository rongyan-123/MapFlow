import { createContext,useContext,useState,type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentModelCatalogue,type AgentFunding } from '../../api/agentExecutionClient';
import type { AgentConversationOptions } from './agentOptions';
import { useSceneModels } from './SceneModelContext';
import type { ModelPurpose } from './scenePreferences';
type ReasoningProtocol=NonNullable<AgentConversationOptions['reasoningProtocol']>;
interface Preference{funding:AgentFunding|null;profileId:string;contextWindow:string;maxOutputTokens:string;reasoningProtocol:ReasoningProtocol;reasoningSupported:boolean}
function readPreference(key:string):Preference{
  try{const saved=JSON.parse(localStorage.getItem(key)??'null');return {funding:['cash','points','byok'].includes(saved?.funding)?saved.funding:null,profileId:typeof saved?.profileId==='string'?saved.profileId:'',contextWindow:typeof saved?.contextWindow==='string'?saved.contextWindow:'',maxOutputTokens:typeof saved?.maxOutputTokens==='string'?saved.maxOutputTokens:'',reasoningProtocol:['none','deepseek','siliconflow','openai_reasoning'].includes(saved?.reasoningProtocol)?saved.reasoningProtocol:'none',reasoningSupported:saved?.reasoningSupported===true};}
  catch{return {funding:null,profileId:'',contextWindow:'',maxOutputTokens:'',reasoningProtocol:'none',reasoningSupported:false};}
}
function useAgentConfiguration(accountId:string){
  const key=`mapflow.agent.selection.v1.${accountId}`;const [saved,setSaved]=useState(()=>readPreference(key));
  const catalogue=useQuery({queryKey:['me',accountId,'agent-models'],queryFn:({signal})=>fetchAgentModelCatalogue(signal),retry:false});
  const funding=saved.funding??(catalogue.data?.defaultCash?'cash':catalogue.data?.points?'points':'byok');
  const cash=saved.profileId?catalogue.data?.cash.find(model=>model.profileId===saved.profileId):catalogue.data?.defaultCash;
  const options:AgentConversationOptions={funding,...(funding==='cash'&&cash?{profileId:cash.profileId,profileVersion:cash.profileVersion,modelLabel:cash.displayName,modelId:cash.modelId}:{}),...(funding==='points'?{modelLabel:catalogue.data?.points?.displayName??'积分模型暂未配置',modelId:catalogue.data?.points?.modelId}:{}),...(funding==='byok'?{contextWindow:Number(saved.contextWindow)||undefined,maxOutputTokens:saved.maxOutputTokens.trim()?Number(saved.maxOutputTokens):null,reasoningProtocol:saved.reasoningProtocol,reasoningSupported:saved.reasoningSupported}:{})};
  function change(patch:Partial<Preference>){const next={...saved,funding,...patch};setSaved(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Current model choices remain usable. */}}
  return {catalogue,options,saved,change,cash};
}
const AgentModelContext=createContext<ReturnType<typeof useAgentConfiguration>|null>(null);
export function AgentModelProvider({accountId,children}:{accountId:string;children:ReactNode}){const state=useAgentConfiguration(accountId);return <AgentModelContext.Provider value={state}>{children}</AgentModelContext.Provider>;}
export function useAgentModelConfiguration(purpose:ModelPurpose='tavern'){
  const state=useContext(AgentModelContext);const scenes=useSceneModels();if(!state)throw new Error('AgentModelProvider is required');
  if(!scenes)return {...state,ready:true};
  const saved=scenes.entries[purpose]?.settings??{funding:null,profileId:'',contextWindow:'',maxOutputTokens:'',reasoningProtocol:'none' as const,reasoningSupported:false};
  const funding=saved.funding??(state.catalogue.data?.defaultCash?'cash':state.catalogue.data?.points?'points':'byok');
  const cash=saved.profileId?state.catalogue.data?.cash.find(model=>model.profileId===saved.profileId):state.catalogue.data?.defaultCash;
  const options:AgentConversationOptions={funding,...(funding==='cash'&&cash?{profileId:cash.profileId,profileVersion:cash.profileVersion,modelLabel:cash.displayName,modelId:cash.modelId}:{}),...(funding==='points'?{modelLabel:state.catalogue.data?.points?.displayName??'积分模型暂未配置',modelId:state.catalogue.data?.points?.modelId}:{}),...(funding==='byok'?{contextWindow:Number(saved.contextWindow)||undefined,maxOutputTokens:saved.maxOutputTokens.trim()?Number(saved.maxOutputTokens):null,reasoningProtocol:saved.reasoningProtocol,reasoningSupported:saved.reasoningSupported}:{})};
  return {catalogue:state.catalogue,options,saved,cash,ready:scenes.ready,change:(patch:Partial<Preference>)=>{const entry=scenes.entries[purpose];if(entry)void scenes.save(purpose,entry.version,{...entry.settings,...patch}).catch(()=>scenes.reload());}};
}
