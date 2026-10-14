import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {fetchAgentModelCatalogue} from '../api/agentExecutionClient';
import { readModelPricing,readWallet,formatAmountMicros,type PricingChannel } from '../api/walletClient';
import {ReferencePrices,ReferencePriceNote} from '../ui/models/ReferencePrices';
import { describePublicError } from '../lib/publicErrors';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';

export default function ModelsPage({accountId,onBack,onNavigateTavern,onNavigateWallet}:{accountId:string;onBack:()=>void;onNavigateTavern:()=>void;onNavigateWallet:()=>void}) {
  const catalog=useQuery({queryKey:['model-catalog','pricing'],queryFn:readModelPricing,retry:false,staleTime:60_000});
  const wallet=useQuery({queryKey:['me',accountId,'wallet'],queryFn:readWallet,retry:false,staleTime:30_000});
  const native=useQuery({queryKey:['me',accountId,'agent-models'],queryFn:({signal})=>fetchAgentModelCatalogue(signal),retry:false,staleTime:30_000});
  const [search,setSearch]=useState('');const [selectedId,setSelectedId]=useState<string|null>(null);
  const models=(catalog.data?.models??[]).filter(model=>`${model.id} ${model.displayName??''} ${model.provider}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected=models.find(model=>model.id===selectedId)??models[0];
  const cashAvailable=selected&&(native.data?native.data.cash.some(profile=>profile.modelId===selected.id):selected.availability==='wallet');
  return <><PageHeader title="模型与价格" actions={<Button onClick={onNavigateWallet} aria-label={wallet.data?`现金额度 ${formatAmountMicros(wallet.data.balanceMicros)}，前往充值`:'前往充值'}>{wallet.data?`${formatAmountMicros(wallet.data.balanceMicros)} 额度`:'我的额度'}</Button>} />
    <div className="mf-content"><main className="mf-page"><div className="mf-page-heading"><div><h1>选择你的学习伙伴。</h1><p>{'查看模型、渠道参考价和参数。额度模型在助手的模型配置中选择，其他模型也可以使用自填 Key。'}</p></div><Button onClick={onNavigateTavern}>配置聊天模型</Button></div>
    {catalog.isPending && <p role="status" className="mf-status">正在读取模型目录…</p>}
    {catalog.error && <div role="alert" className="mf-status mf-status--error">{describePublicError(catalog.error)} <Button onClick={()=>void catalog.refetch()}>重试</Button></div>}
    {catalog.data && <div className="mf-model-layout"><aside className="mf-card mf-model-list" aria-label="模型列表"><label className="mf-field">搜索模型<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="模型名称或厂商" /></label><small className="mf-muted">{models.length} 个模型</small><ul>{models.map(model=><li key={model.id}><button type="button" aria-label={`选择模型 ${model.id}`} aria-pressed={selected?.id===model.id} className="mf-model-option" onClick={()=>setSelectedId(model.id)}><span>{model.displayName??model.id}</span><small>{model.provider}</small></button></li>)}</ul>{!models.length && <p className="mf-status">没有找到匹配的模型</p>}</aside>
    <section aria-label="模型详情" className="mf-stack">{selected ? <>
      <div className="mf-card mf-stack"><div className="mf-row mf-wrap"><span className="mf-pill">{selected.provider}</span><span className="mf-pill mf-pill--green">{cashAvailable?'现金额度':'自填 Key'}</span></div><h2 className="mf-model-name">{selected.displayName??selected.id}</h2>{selected.displayName && <small className="mf-muted">{selected.id}</small>}{selected.description && <p className="mf-muted">{selected.description}</p>}<div className="mf-grid mf-grid--2"><div><small className="mf-muted">上下文窗口</small><p className="mf-model-context">{selected.contextWindow.toLocaleString()}</p><small className="mf-muted">Tokens</small></div>{selected.pricing ? <ReferencePrices channels={selected.pricing.channels.filter(channel=>channel.enabled)} />:<p className="mf-muted">{cashAvailable?'价格暂时无法获取':'单价待配置'}</p>}</div>{cashAvailable && <><ReferencePriceNote /><small className="mf-muted">缓存命中价按输入参考价的 10% 换算；有独立报价时采用独立报价。实际费用和余额可在对话与额度流水中查看。</small></>}</div>
      <div className="mf-card mf-stack"><h2>各渠道参考价格</h2>{selected.pricing?.channels.map(channel=><div className="mf-channel-card" key={`${channel.vendor}.${channel.lane}`}><div className="mf-row mf-row--between"><strong>{channel.vendor} <small className="mf-muted">渠道 {channel.lane}</small></strong><span className="mf-pill">{channel.enabled?'可用':'暂不可用'}</span></div><div className="mf-row mf-wrap mf-small mf-muted">{channel.statsSource!=='unknown' && channel.successRate24h!==null && <span>成功率 {Number(channel.successRate24h.toFixed(1))}%</span>}{channel.statsSource!=='unknown'&&channel.avgResponseSeconds!==null && <span>平均响应 {Number(channel.avgResponseSeconds.toFixed(1))} 秒</span>}<span>{channel.statsSource==='live'?'真实监控':channel.statsSource==='estimated'?'估算数据':'暂无监测数据'}</span></div><ReferencePrices channels={[channel]} /></div>)}{!selected.pricing && selected.vendorCodes.map(code=><div key={code} className="mf-row mf-row--between"><span>{code}</span><small className="mf-muted">暂无监测数据</small></div>)}{!selected.vendorCodes.length && <p className="mf-status">暂无公开渠道</p>}{selected.id==='gpt-5.6-sol' && <small className="mf-muted">缓存参考规则：命中输入 ×0.1，写入缓存 5 分钟 ×1.25、1 小时 ×2。输入超过 272,000 Token，输入 ×2、输出 ×1.5；指定渠道按总输入（含缓存）判断档位。</small>}</div>
      <div className="mf-card"><div className="mf-section-title"><h2>模型参数</h2></div>{selected.settings.length ? <dl>{selected.settings.map(setting=><div className="mf-record" key={setting.name}><dt>{setting.name}</dt><dd className="mf-row mf-wrap">{setting.kind==='switch'?<span className="mf-pill">开 / 关</span>:setting.options.map(option=><span className="mf-pill" key={option}>{option}</span>)}</dd></div>)}</dl>:<p className="mf-muted">无额外参数</p>}</div>
    </> : <p className="mf-status">换个关键词，试试其他模型。</p>}</section></div>}
    <Button variant="quiet" onClick={onBack}>返回工作空间</Button></main></div>
  </>;
}
