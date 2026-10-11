import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useIdentity} from '../identity/IdentityContext';
import TavernPage from '../tavern/TavernPage';
import {buttonClass,ErrorNotice,inputClass} from '../tavern/TavernUi';
import {fetchAgentModelCatalogue,type AgentFunding} from './agentExecutionClient';
import type {AgentConversationOptions} from './agentConversationOptions';

export default function GlobalAssistantPage({onNavigateLearning,onNavigateWallet,onNavigateModels}: {
  onNavigateLearning:()=>void;onNavigateWallet?:()=>void;onNavigateModels?:()=>void;
}){
  const {session}=useIdentity();if(!session)return null;
  return <AuthenticatedAssistant key={session.account.playerId} accountId={session.account.playerId}
    onNavigateLearning={onNavigateLearning} onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels} />;
}
function AuthenticatedAssistant({accountId,onNavigateLearning,onNavigateWallet,onNavigateModels}: {
  accountId:string;onNavigateLearning:()=>void;onNavigateWallet?:()=>void;onNavigateModels?:()=>void;
}){
  const key=`mapflow.agent.selection.v1.${accountId}`;
  const [saved,setSaved]=useState<{funding:AgentFunding|null;profileId:string;contextWindow:string}>(()=>{
    try{const value=JSON.parse(localStorage.getItem(key)??'null');return {funding:['cash','points','byok'].includes(value?.funding)?value.funding:null,
      profileId:typeof value?.profileId==='string'?value.profileId:'',contextWindow:typeof value?.contextWindow==='string'?value.contextWindow:''};}
    catch{return {funding:null,profileId:'',contextWindow:''};}
  });
  const catalogue=useQuery({queryKey:['me',accountId,'agent-models'],queryFn:({signal})=>fetchAgentModelCatalogue(signal),retry:false});
  const funding=saved.funding??(catalogue.data?.defaultCash?'cash':catalogue.data?.points?'points':'byok');
  const cash=catalogue.data?.cash.find(model=>model.profileId===saved.profileId)??catalogue.data?.defaultCash;
  const options:AgentConversationOptions={funding,...(funding==='cash'&&cash?{profileId:cash.profileId,profileVersion:cash.profileVersion,modelLabel:cash.displayName}:{}),
    ...(funding==='points'?{modelLabel:catalogue.data?.points?.displayName??'积分模型暂未配置'}:{}),
    ...(funding==='byok'?{contextWindow:Number(saved.contextWindow)||undefined}:{})};
  function change(patch:Partial<typeof saved>){const next={...saved,funding,...patch};setSaved(next);
    try{localStorage.setItem(key,JSON.stringify(next));}catch{/* The current selection remains usable. */}}
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3">
      <h1 className="text-base font-semibold">全局助手</h1>
      <label className="flex items-center gap-2 text-xs text-slate-400">资金通路<select aria-label="资金通路" className={inputClass+' !w-auto'} value={funding}
        onChange={event=>change({funding:event.target.value as AgentFunding})}>
        <option value="cash">现金额度</option><option value="points">平台积分</option><option value="byok">自填 API Key</option>
      </select></label>
      {funding==='cash'&&<label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">模型<select aria-label="助手现金模型" className={inputClass+' !w-auto max-w-60'} value={cash?.profileId??''}
        onChange={event=>change({profileId:event.target.value})}>
        {!catalogue.data?.cash.length&&<option value="">现金模型暂未配置</option>}
        {catalogue.data?.cash.map(model=><option key={model.profileId} value={model.profileId}>{model.displayName}</option>)}
      </select></label>}
      {funding==='points'&&<span className="text-xs text-slate-400">{options.modelLabel}</span>}
      {funding==='byok'&&<label className="flex items-center gap-2 text-xs text-slate-400">上下文窗口<input type="number" min={1} aria-label="自填模型上下文窗口"
        className={inputClass+' !w-36'} placeholder="填写模型实际 Token 窗口" value={saved.contextWindow} onChange={event=>change({contextWindow:event.target.value})} /></label>}
      <button className={buttonClass+' ml-auto'} onClick={onNavigateLearning}>打开学习聊天</button>
    </header>
    {catalogue.error&&<div className="p-3"><ErrorNotice error={catalogue.error} onRetry={()=>void catalogue.refetch()} /></div>}
    <TavernPage management agentOptions={options} onNavigateConsole={onNavigateLearning} onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels} />
  </div>;
}
