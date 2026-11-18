import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAgentModelConfiguration} from '../../domains/models/AgentModelContext';
import {useSharedModelSelection} from '../../domains/models/ModelSelectionContext';
import {useSceneModels} from '../../domains/models/SceneModelContext';
import {type ModelPurpose,type SceneModelPreference} from '../../domains/models/scenePreferences';
import {readCreditSummary,formatCreditAmount} from '../../api/creditClient';
import {readModelPricing,readWallet,formatAmountMicros} from '../../api/walletClient';
import {describePublicError} from '../../lib/publicErrors';
import {ReferencePrices,ReferencePriceNote} from '../models/ReferencePrices';
import {Button} from '../Button';
import ByokForm from './ByokForm';
import './ModelSettings.css';
import type {TavernModelSelection} from '../../domains/conversations/types';
interface Props{accountId:string;csrfToken:string;onWallet:()=>void;locked?:boolean;initialPurpose?:ModelPurpose;onDone?:()=>void;onBusyChange?:(busy:boolean)=>void}
export const modelPurposeTitles:Record<ModelPurpose,string>={management:'首页助手',learning:'学习聊天',tavern:'独立聊天',study_plan:'学习计划'};
export const modelPurposeDescriptions:Record<ModelPurpose,string>={management:'用于首页的需求讨论和新地图生成。',learning:'用于所有地图中的学习对话。',tavern:'用于独立聊天中的角色对话。',study_plan:'用于制定和调整学习计划。'};
export default function ModelSettings(props:Props){
  const purpose=props.initialPurpose??'tavern';const scenes=useSceneModels();
  if(scenes&&!scenes.ready)return <div role={scenes.error?'alert':'status'} className="mf-status">{scenes.error?describePublicError(scenes.error):'正在读取模型设置…'}{!!scenes.error&&<Button onClick={scenes.reload}>重试</Button>}</div>;
  return <ModelEditor key={purpose} {...props} purpose={purpose} />;
}
function ModelEditor({accountId,csrfToken,onWallet,locked=false,purpose,onDone,onBusyChange}:Props&{purpose:ModelPurpose}){
  const model=useAgentModelConfiguration(purpose);const shared=useSharedModelSelection(purpose)!;const scenes=useSceneModels();
  const saved:SceneModelPreference={...model.saved,funding:model.options.funding,baseUrl:shared.selection.baseUrl,model:shared.selection.model,historyBytes:shared.selection.historyBytes};
  const [draft,setDraft]=useState(saved);const [selection,setSelection]=useState(shared.selection);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState<unknown>(null);const [reset,setReset]=useState(0);const [expectedVersion,setExpectedVersion]=useState(scenes?.entries[purpose]?.version??0);
  useEffect(()=>{onBusyChange?.(saving);},[saving,onBusyChange]);
  useEffect(()=>()=>onBusyChange?.(false),[onBusyChange]);
  const credits=useQuery({queryKey:['credit',accountId],queryFn:readCreditSummary,enabled:draft.funding==='points',retry:false});
  const cash=draft.profileId?model.catalogue.data?.cash.find(item=>item.profileId===draft.profileId):model.catalogue.data?.defaultCash;
  const wallet=useQuery({queryKey:['me',accountId,'wallet'],queryFn:readWallet,enabled:draft.funding==='cash',retry:false,staleTime:15000});
  const prices=useQuery({queryKey:['model-catalog','pricing'],queryFn:readModelPricing,enabled:draft.funding==='cash',retry:false,staleTime:60000});
  const disabled=locked||saving;
  function byok(next:TavernModelSelection,capabilities?:Partial<SceneModelPreference>){setSelection(next);setDraft(previous=>({...previous,...capabilities,baseUrl:next.baseUrl,model:next.model,historyBytes:next.historyBytes}));setNotice('');}
  async function save(){
    if(disabled)return;setError(null);setNotice('');
    if(draft.funding==='cash'&&!cash){setError(new Error('请选择可用的现金模型。'));return;}
    if(draft.funding==='points'&&!model.catalogue.data?.points){setError(new Error('积分模型暂未配置。'));return;}
    if(draft.funding==='byok'&&(!selection.apiKey.trim()||!draft.model.trim()||!/^https:\/\/[^?#]+\/v1\/?$/u.test(draft.baseUrl)||!Number.isSafeInteger(Number(draft.contextWindow))||Number(draft.contextWindow)<1||draft.maxOutputTokens.trim()&&(!Number.isSafeInteger(Number(draft.maxOutputTokens))||Number(draft.maxOutputTokens)<1||Number(draft.maxOutputTokens)>Number(draft.contextWindow)))){setError(new Error('请填写 Key、模型、HTTPS /v1 地址和有效的上下文容量。'));return;}
    setSaving(true);try{if(scenes)await scenes.save(purpose,expectedVersion,{...draft,profileId:draft.funding==='cash'?cash!.profileId:draft.profileId},selection.apiKey);else{model.change(draft);shared.change(selection);}setExpectedVersion(previous=>previous+1);setNotice(`已保存${modelPurposeTitles[purpose]}配置，仅影响之后发起的请求。`);onDone?.();}catch(cause){setError(cause);}finally{setSaving(false);}
  }
  return <section className="mf-stack mf-model-editor"><p className="mf-muted mf-small">{modelPurposeDescriptions[purpose]}其他用途的模型不受影响。保存后下次发送生效。</p>
    <fieldset className="mf-funding-choices" disabled={disabled}><legend>使用方式</legend>{([
      ['points','使用积分','消耗学习积分'],['cash','使用余额','从账户余额扣费'],['byok','使用自己的 API','由你的服务商计费']
    ] as const).map(([value,label,description])=><label key={value} className={`mf-funding-choice ${(draft.funding??'cash')===value?'is-selected':''}`}><input type="radio" name={`funding-${purpose}`} value={value} checked={(draft.funding??'cash')===value} onChange={()=>{setDraft(previous=>({...previous,funding:value}));setNotice('');}} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>
    {(draft.funding??'cash')==='cash'?<><label className="mf-field">模型<select disabled={disabled||model.catalogue.isPending} value={cash?.profileId??''} onChange={event=>setDraft(previous=>({...previous,profileId:event.target.value}))}>{!cash&&<option value="">请选择可用模型</option>}{model.catalogue.data?.cash.map(profile=><option value={profile.profileId} key={profile.profileId}>{profile.displayName}</option>)}</select></label><div className="mf-status mf-stack"><div className="mf-row mf-row--between"><p>现金额度 {wallet.data?formatAmountMicros(wallet.data.balanceMicros):wallet.error?'读取失败':'读取中…'}</p><Button disabled={disabled} onClick={onWallet}>查看额度</Button></div>{!!wallet.error&&<p role="alert">{describePublicError(wallet.error)} <Button onClick={()=>void wallet.refetch()}>重试读取余额</Button></p>}<ReferencePrices channels={prices.data?.models.find(profile=>profile.id===cash?.modelId)?.pricing?.channels.filter(channel=>channel.enabled)??[]} /><ReferencePriceNote /></div></>:draft.funding==='points'?<div className="mf-status mf-stack"><p>{model.catalogue.data?.points?.displayName??'积分模型暂未配置'}</p>{credits.data?<p>可用积分：{formatCreditAmount(credits.data.balance)}</p>:credits.error?<p role="alert">{describePublicError(credits.error)} <Button onClick={()=>void credits.refetch()}>重试读取积分</Button></p>:<p role="status">正在读取积分…</p>}</div>:<ByokForm key={reset} selection={selection} capabilities={draft} onChange={byok} onDraftChange={byok} csrfToken={csrfToken} locked={disabled} />}
    <div className="mf-row mf-wrap"><Button disabled={disabled} onClick={()=>{setExpectedVersion(scenes?.entries[purpose]?.version??0);setDraft(saved);setSelection(shared.selection);setReset(previous=>previous+1);setError(null);setNotice('已取消未保存的修改。');onDone?.();}}>取消修改</Button><Button variant="primary" disabled={disabled} onClick={()=>void save()}>{saving?'保存中…':`保存${modelPurposeTitles[purpose]}配置`}</Button></div>{notice&&<p role="status" className="mf-status">{notice}</p>}{!!error&&<p role="alert" className="mf-status mf-status--error">{error instanceof Error?error.message:describePublicError(error)}</p>}{model.catalogue.error&&<p role="alert" className="mf-status">模型目录读取失败。<Button onClick={()=>void model.catalogue.refetch()}>重试</Button></p>}
  </section>;
}
