import { useQuery } from '@tanstack/react-query';
import { useAgentModelConfiguration } from '../../domains/models/AgentModelContext';
import { useSharedModelSelection } from '../../domains/models/ModelSelectionContext';
import { readModelPricing,readWallet,formatAmountMicros } from '../../api/walletClient';
import { describePublicError } from '../../lib/publicErrors';
import { ReferencePrices,ReferencePriceNote } from '../models/ReferencePrices';
import { Button } from '../Button';
import ByokForm from './ByokForm';
export default function ModelSettings({accountId,csrfToken,onWallet,locked=false}:{accountId:string;csrfToken:string;onWallet:()=>void;locked?:boolean}){
  const model=useAgentModelConfiguration();const shared=useSharedModelSelection()!;const {options}=model;
  const wallet=useQuery({queryKey:['me',accountId,'wallet'],queryFn:readWallet,enabled:options.funding==='cash',retry:false,staleTime:15000});
  const prices=useQuery({queryKey:['model-catalog','pricing'],queryFn:readModelPricing,enabled:options.funding==='cash',retry:false,staleTime:60000});
  return <div className="mf-stack"><label className="mf-field">资金通路<select disabled={locked} value={options.funding} onChange={event=>{if(['cash','points','byok'].includes(event.target.value))model.change({funding:event.target.value as typeof options.funding});}}><option value="cash">现金额度</option><option value="points">平台积分</option><option value="byok">自填 API Key</option></select></label>
    {options.funding==='cash'?<><label className="mf-field">模型<select disabled={locked||model.catalogue.isPending} value={model.cash?.profileId??''} onChange={event=>model.change({profileId:event.target.value})}>{!model.catalogue.data?.cash.length&&<option value="">现金模型暂未配置</option>}{model.catalogue.data?.cash.map(profile=><option value={profile.profileId} key={profile.profileId}>{profile.displayName}</option>)}</select></label><div className="mf-status mf-stack"><div className="mf-row mf-row--between"><p>现金额度 {wallet.data?formatAmountMicros(wallet.data.balanceMicros):wallet.error?'暂时无法读取':'读取中…'}</p><Button onClick={onWallet}>查看额度</Button></div>{prices.error?<p className="mf-muted">价格暂时无法获取</p>:<ReferencePrices channels={prices.data?.models.find(profile=>profile.id===options.modelId)?.pricing?.channels.filter(channel=>channel.enabled)??[]} />}<ReferencePriceNote /><small>完成后显示本次用量、费用和余额。</small></div></>:options.funding==='points'?<div className="mf-status">{options.modelLabel}。完成后显示本次积分消耗，现金额度独立保存。</div>:<ByokForm selection={shared.selection} capabilities={model.saved} onChange={(selection,capabilities)=>{shared.change(selection);if(capabilities)model.change(capabilities);}} csrfToken={csrfToken} locked={locked} />}
    {model.catalogue.error&&<p role="alert" className="mf-status mf-status--error">{describePublicError(model.catalogue.error)} <Button onClick={()=>void model.catalogue.refetch()}>重试读取模型</Button></p>}
  </div>;
}
