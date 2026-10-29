import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAgentModelConfiguration} from '../../domains/models/AgentModelContext';
import {useSharedModelSelection} from '../../domains/models/ModelSelectionContext';
import {useSceneModels} from '../../domains/models/SceneModelContext';
import {modelPurposes,purposeNames,type ModelPurpose,type SceneModelPreference} from '../../domains/models/scenePreferences';
import {readModelPricing,readWallet,formatAmountMicros} from '../../api/walletClient';
import {describePublicError} from '../../lib/publicErrors';
import {ReferencePrices,ReferencePriceNote} from '../models/ReferencePrices';
import {Button} from '../Button';
import ByokForm from './ByokForm';
import type {TavernModelSelection} from '../../domains/conversations/types';
interface Props{accountId:string;csrfToken:string;onWallet:()=>void;locked?:boolean;initialPurpose?:ModelPurpose;onDone?:()=>void}
export default function ModelSettings(props:Props){
  const [purpose,setPurpose]=useState<ModelPurpose>(props.initialPurpose??'tavern');const scenes=useSceneModels();
  if(scenes&&!scenes.ready)return <div role={scenes.error?'alert':'status'} className="mf-status">{scenes.error?describePublicError(scenes.error):'正在读取各用途的模型设置…'}{!!scenes.error&&<Button onClick={scenes.reload}>重试</Button>}</div>;
  return <div className="mf-scene-models" aria-label="模型用途">{modelPurposes.map(item=><section className="mf-scene-model-section" key={item}><button className="mf-scene-model-heading" type="button" aria-expanded={purpose===item} aria-controls={`model-purpose-${item}`} onClick={()=>setPurpose(item)}><strong>{purposeNames[item]}</strong><span>{!scenes?.entries[item]?.settings.funding?'尚未配置':scenes.entries[item]?.settings.funding==='byok'?scenes.entries[item]?.settings.model||'自填 Key':scenes?.entries[item]?.settings.funding==='points'?'平台积分':'现金额度'}</span><span aria-hidden="true">{purpose===item?'−':'＋'}</span></button>{purpose===item&&<div id={`model-purpose-${item}`}><ModelEditor key={purpose} {...props} purpose={purpose} /></div>}</section>)}</div>;
}
function ModelEditor({accountId,csrfToken,onWallet,locked=false,purpose,onDone}:Props&{purpose:ModelPurpose}){
  const model=useAgentModelConfiguration(purpose);const shared=useSharedModelSelection(purpose)!;const scenes=useSceneModels();
  const saved:SceneModelPreference={...model.saved,funding:model.options.funding,baseUrl:shared.selection.baseUrl,model:shared.selection.model,historyBytes:shared.selection.historyBytes};
  const [draft,setDraft]=useState(saved);const [selection,setSelection]=useState(shared.selection);const [saving,setSaving]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState<unknown>(null);const [reset,setReset]=useState(0);const [expectedVersion,setExpectedVersion]=useState(scenes?.entries[purpose]?.version??0);
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
    setSaving(true);try{if(scenes)await scenes.save(purpose,expectedVersion,{...draft,profileId:draft.funding==='cash'?cash!.profileId:draft.profileId},selection.apiKey);else{model.change(draft);shared.change(selection);}setExpectedVersion(previous=>previous+1);setNotice(`已保存${purposeNames[purpose]}配置，仅影响之后发起的请求。`);onDone?.();}catch(cause){setError(cause);}finally{setSaving(false);}
  }
  return <section className="mf-stack mf-model-editor"><div><p className="mf-eyebrow">MODEL SETTINGS</p><h3>{purposeNames[purpose]}</h3><p className="mf-muted mf-small">四种用途分别保存。每次请求开始时固定本次模型与计费通路。</p></div><label className="mf-field">资金通路<select disabled={disabled} value={draft.funding??'cash'} onChange={event=>{setDraft(previous=>({...previous,funding:event.target.value as SceneModelPreference['funding']}));setNotice('');}}><option value="cash">现金额度</option><option value="points">平台积分</option><option value="byok">自填 API Key</option></select></label>
    {draft.funding==='cash'?<><label className="mf-field">模型<select disabled={disabled||model.catalogue.isPending} value={cash?.profileId??''} onChange={event=>setDraft(previous=>({...previous,profileId:event.target.value}))}>{!cash&&<option value="">请选择可用模型</option>}{model.catalogue.data?.cash.map(profile=><option value={profile.profileId} key={profile.profileId}>{profile.displayName}</option>)}</select></label><div className="mf-status mf-stack"><div className="mf-row mf-row--between"><p>现金额度 {wallet.data?formatAmountMicros(wallet.data.balanceMicros):'读取中…'}</p><Button onClick={onWallet}>查看额度</Button></div><ReferencePrices channels={prices.data?.models.find(profile=>profile.id===cash?.modelId)?.pricing?.channels.filter(channel=>channel.enabled)??[]} /><ReferencePriceNote /></div></>:draft.funding==='points'?<div className="mf-status">{model.catalogue.data?.points?.displayName??'积分模型暂未配置'} · 使用平台积分。</div>:<ByokForm key={reset} selection={selection} capabilities={draft} onChange={byok} onDraftChange={byok} csrfToken={csrfToken} locked={disabled} />}
    <div className="mf-row mf-wrap"><Button disabled={disabled} onClick={()=>{setExpectedVersion(scenes?.entries[purpose]?.version??0);setDraft(saved);setSelection(shared.selection);setReset(previous=>previous+1);setError(null);setNotice('已取消未保存的修改。');onDone?.();}}>取消修改</Button><Button variant="primary" disabled={disabled} onClick={()=>void save()}>{saving?'保存中…':`保存${purposeNames[purpose]}配置`}</Button></div>{notice&&<p role="status" className="mf-status">{notice}</p>}{!!error&&<p role="alert" className="mf-status mf-status--error">{error instanceof Error?error.message:describePublicError(error)}</p>}{model.catalogue.error&&<p role="alert" className="mf-status">模型目录读取失败。<Button onClick={()=>void model.catalogue.refetch()}>重试</Button></p>}
  </section>;
}
