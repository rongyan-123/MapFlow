import { useEffect,useRef,useState } from 'react';
import { testModelConnection } from '../../api/tavernClient';
import { modelPresets } from '../../domains/models/presets';
import type { TavernModelSelection } from '../../domains/conversations/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';

export interface ByokCapabilitiesDraft {
  contextWindow:string;maxOutputTokens:string;reasoningProtocol:'none'|'deepseek'|'siliconflow'|'openai_reasoning';reasoningSupported:boolean;
}
function validEndpoint(value:string){
  try{const endpoint=new URL(value);return endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash&&/\/v1\/?$/u.test(endpoint.pathname);}catch{return false;}
}
export default function ByokForm({selection,capabilities,onChange,csrfToken,locked=false}:{selection:TavernModelSelection;capabilities?:ByokCapabilitiesDraft;onChange:(selection:TavernModelSelection,capabilities?:ByokCapabilitiesDraft)=>void;csrfToken:string;locked?:boolean}){
  const [draft,setDraft]=useState({...selection,provider:'custom' as const});const [preset,setPreset]=useState(()=>modelPresets.find(preset=>preset.baseUrl===selection.baseUrl)?.id??'custom');
  const [capabilityDraft,setCapabilityDraft]=useState<ByokCapabilitiesDraft|undefined>(()=>capabilities?{
    contextWindow:capabilities.contextWindow,maxOutputTokens:capabilities.maxOutputTokens,
    reasoningProtocol:capabilities.reasoningProtocol,reasoningSupported:capabilities.reasoningSupported,
  }:undefined);
  const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [testing,setTesting]=useState(false);const [connection,setConnection]=useState<{ok:boolean;models:string[];message:string}|null>(null);const probe=useRef<AbortController|null>(null);
  useEffect(()=>()=>probe.current?.abort(),[]);
  function change(next:typeof draft,invalidate=true){setDraft(next);setError('');setSaved(false);if(invalidate){probe.current?.abort();probe.current=null;setTesting(false);setConnection(null);}}
  function changeCapabilities(patch:Partial<ByokCapabilitiesDraft>){setCapabilityDraft(previous=>previous?{...previous,...patch}:previous);setSaved(false);setError('');}
  function save(){
    if(locked)return;
    const cleaned={...draft,apiKey:draft.apiKey.trim(),baseUrl:draft.baseUrl.trim(),model:draft.model.trim()};
    let message=!cleaned.apiKey?'尚未填写 API Key。':!cleaned.baseUrl?'尚未填写 API URL。':!validEndpoint(cleaned.baseUrl)?'API URL 必须是公开 HTTPS 地址，并以 /v1 结尾。':!cleaned.model?'尚未填写模型。':'';
    if(!message&&capabilityDraft){
      const window=Number(capabilityDraft.contextWindow),output=Number(capabilityDraft.maxOutputTokens);
      if(!Number.isSafeInteger(window)||window<1)message='请填写有效的上下文窗口（正整数 Token）。';
      else if(capabilityDraft.maxOutputTokens.trim()&&(!Number.isSafeInteger(output)||output<1||output>window))message='模型输出上限须为正整数，且不能超过上下文窗口。';
    }
    if(message){setError(message);return;}
    if(capabilityDraft)onChange(cleaned,{...capabilityDraft,contextWindow:capabilityDraft.contextWindow.trim(),maxOutputTokens:capabilityDraft.maxOutputTokens.trim()});
    else onChange(cleaned);
    setSaved(true);setError('');
  }
  async function test(){if(testing||locked)return;if(!draft.apiKey.trim()||!validEndpoint(draft.baseUrl.trim())){setError('请填写 API Key 和有效的 HTTPS API URL 后测试。');return;}const controller=new AbortController();probe.current=controller;setTesting(true);setError('');setConnection(null);try{const result=await testModelConnection(draft.apiKey.trim(),draft.baseUrl.trim(),csrfToken,controller.signal);if(!controller.signal.aborted)setConnection(result);}catch(failure){if(!controller.signal.aborted)setConnection({ok:false,models:[],message:describePublicError(failure)});}finally{if(!controller.signal.aborted){probe.current=null;setTesting(false);}}}
  const chosenPreset=modelPresets.find(option=>option.id===preset)!;
  return <fieldset className="mf-stack" disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}}><p className="mf-muted mf-small">使用你自己的模型账户，不扣本站现金或积分，本站欠费不影响使用。Key 只保存在当前页面内存，刷新后需重新填写；请求经本站转发到你选择的服务。</p><label className="mf-field">服务预设<select value={preset} onChange={event=>{const next=modelPresets.find(preset=>preset.id===event.target.value)!;setPreset(next.id);change({...draft,apiKey:'',baseUrl:next.baseUrl,model:next.models[0]??''});}}>{modelPresets.map(preset=><option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
    <label className="mf-field">API Key<input type="password" autoComplete="new-password" data-1p-ignore="true" maxLength={512} value={draft.apiKey} onChange={event=>change({...draft,apiKey:event.target.value})} /></label><label className="mf-field">API URL<input type="url" maxLength={2048} value={draft.baseUrl} placeholder="https://example.com/v1" onChange={event=>change({...draft,baseUrl:event.target.value})} /></label><label className="mf-field">上游模型<input maxLength={256} value={draft.model} onChange={event=>change({...draft,model:event.target.value},false)} /></label>
    {(connection?.ok||chosenPreset.models.length>0) && <label className="mf-field">{connection?.ok?'已获取模型':'常用模型'}<select value={draft.model} onChange={event=>change({...draft,model:event.target.value},false)}><option value="">选择模型，或在上方填写</option>{[...new Set([...(connection?.ok?connection.models:chosenPreset.models),...(draft.model?[draft.model]:[])])].map(model=><option key={model} value={model}>{model}</option>)}</select></label>}
    {capabilityDraft&&<>
      <label className="mf-field">上下文窗口（Token）<input aria-label="上下文窗口（Token）" type="number" min={1} step={1} value={capabilityDraft.contextWindow} onChange={event=>changeCapabilities({contextWindow:event.target.value})} /><small>按服务商公布的模型容量填写，用于整理历史。</small></label>
      <label className="mf-field">模型输出上限（可选）<input type="number" min={1} step={1} value={capabilityDraft.maxOutputTokens} placeholder="留空使用模型默认值" onChange={event=>changeCapabilities({maxOutputTokens:event.target.value})} /></label>
      <label className="mf-field">推理参数协议<select aria-label="推理参数协议" value={capabilityDraft.reasoningProtocol} onChange={event=>{const reasoningProtocol=event.target.value as ByokCapabilitiesDraft['reasoningProtocol'];changeCapabilities({reasoningProtocol,reasoningSupported:reasoningProtocol!=='none'});}}><option value="none">不额外发送推理参数</option><option value="deepseek">DeepSeek</option><option value="siliconflow">SiliconFlow</option><option value="openai_reasoning">OpenAI reasoning</option></select><small>根据服务商的接口说明选择，不按模型名称自动猜测。</small></label>
    </>}
    <div className="mf-row mf-wrap"><Button disabled={testing} onClick={()=>void test()}>{testing?'测试中…':'测试连接 / 获取模型'}</Button><Button variant="primary" onClick={save}>保存配置</Button></div>{error&&<p role="alert" className="mf-status mf-status--error">{error}</p>}{connection&&<p role={connection.ok?'status':'alert'} className={`mf-status ${connection.ok?'':'mf-status--error'}`}>{connection.message}</p>}<p role="status" className="mf-muted mf-small">{saved?'已保存，当前页面内有效。':'修改后请保存配置。'}测试连接只查询模型目录，不验证聊天或工具调用。</p>
  </fieldset>;
}
