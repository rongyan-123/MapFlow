import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readModelPricing, type PricingChannel } from './walletClient';
import ModelReferencePrices, { ReferencePriceNote } from './ModelReferencePrices';
import WalletBalance from './WalletBalance';

const button = 'rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium transition hover:border-cyan-500 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';
const panel = 'min-w-0 rounded-2xl border border-slate-800 bg-slate-900';

export default function ModelPricingPage({ accountId, onBack, onNavigateTavern, onNavigateWallet }: {
  accountId: string; onBack: () => void; onNavigateTavern: () => void; onNavigateWallet: () => void;
}) {
  const catalog = useQuery({ queryKey: ['model-catalog', 'pricing'], queryFn: readModelPricing, retry: false, staleTime: 60_000 });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const models = (catalog.data?.models ?? []).filter(model =>
    `${model.id} ${model.displayName ?? ''} ${model.provider}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = models.find(model => model.id === selectedId) ?? models[0];
  const activeChannels = selected?.pricing?.channels.filter(channel => channel.enabled) ?? [];

  return <div className="h-dvh min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
      <button type="button" className={button} onClick={onBack}>返回</button><h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">模型价格</h1>
      <div className="ml-auto"><WalletBalance accountId={accountId} onClick={onNavigateWallet} /></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Model Library</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">找到适合你的模型</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{catalog.data?.models.some(model => model.availability === 'wallet') ? '比较模型参考价、渠道状态与参数，选择适合你的模型。' : '查看模型、渠道与参数。目前使用自填 Key，额度调用尚未开放。'}</p>
      </div><button type="button" className={button} onClick={onNavigateTavern}>前往酒馆 ↗</button></div>
      {catalog.isPending && <p role="status" className="py-20 text-center text-sm text-slate-400">正在读取模型目录…</p>}
      {catalog.error && <div role="alert" className={`${panel} border-rose-800 p-5 text-sm text-rose-300`}>{catalog.error.message} <button type="button" className={`${button} ml-2`} onClick={() => void catalog.refetch()}>重试</button></div>}
      {catalog.data && <div className="grid items-start gap-5 lg:grid-cols-[minmax(16rem,21rem)_minmax(0,1fr)]">
        <aside aria-label="模型列表" className={`${panel} overflow-hidden lg:sticky lg:top-24`}>
          <div className="border-b border-slate-800 p-4"><h3 className="mb-3 text-sm font-semibold">模型价格查询</h3>
            <label className="relative block"><span className="sr-only">搜索模型</span><svg aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
              <input aria-label="搜索模型" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索模型名称或厂商…" className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-400" />
            </label><div className="mt-3 flex items-center justify-between text-xs"><span className="rounded-full border border-cyan-900 bg-slate-950 px-3 py-1 text-cyan-200">聊天模型</span><span className="text-slate-500">{models.length} 个模型</span></div>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto overscroll-contain p-3 lg:max-h-[calc(100dvh-18rem)]">{models.map(model => <li key={model.id}>
            <button type="button" aria-label={`选择模型 ${model.id}`} aria-pressed={selected?.id === model.id} onClick={() => setSelectedId(model.id)} className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${selected?.id === model.id ? 'border-cyan-400 bg-slate-800' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 text-sm font-semibold text-cyan-200">{model.id.split('-')[0].slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-100">{model.displayName ?? model.id}</span><span className="mt-1 block truncate text-xs text-slate-500">{model.description ?? `${model.provider} · ${model.contextWindow.toLocaleString()} Token`}</span></span><span aria-hidden="true" className="text-slate-500">›</span>
            </button>
          </li>)}</ul>{models.length === 0 && <p className="p-6 text-center text-sm text-slate-400">没有找到匹配的模型</p>}
        </aside>
        <section aria-label="模型详情" className="min-w-0 space-y-4">{selected ? <>
          <div className={`${panel} p-5 sm:p-6`}><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-400">{selected.provider}</span><span className="rounded-full border border-cyan-900 px-2.5 py-1 text-cyan-200">{selected.availability === 'wallet' ? '现金额度' : '自填 Key'}</span></div>
            <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{selected.displayName ?? selected.id}</h2>{selected.displayName && <p className="mt-1 break-all font-mono text-xs text-slate-500">{selected.id}</p>}
            {selected.description && <p className="mt-3 text-sm leading-6 text-slate-400">{selected.description}</p>}
            <div className="mt-5 grid gap-5 border-t border-slate-800 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><div><p className="text-xs text-slate-500">上下文窗口</p><p className="mt-2 font-mono text-xl tabular-nums text-slate-200">{selected.contextWindow.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Tokens</p></div><div>{selected.pricing ? <ModelReferencePrices channels={activeChannels} /> : <p className="text-sm text-slate-400">{selected.availability === 'wallet' ? '价格暂时无法获取' : '单价待配置'}</p>}</div></div>
            {selected.availability === 'wallet' ? <div className="mt-4 border-t border-slate-800 pt-3"><ReferencePriceNote /><p className="mt-1 text-xs leading-5 text-slate-500">缓存命中价按输入参考价的 10% 换算；有独立报价时采用独立报价。实际命中量、费用和余额可在对话与额度流水中查看。</p></div> : <p className="mt-4 text-xs text-slate-500">自填 Key 按渠道实际价格计费</p>}
          </div>
          <div className={`${panel} p-5 sm:p-6`}><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">各渠道参考价格</h3><span className="text-xs text-slate-500">{selected.vendorCodes.length} 个公开渠道</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{selected.pricing ? `更新于 ${new Date(selected.pricing.updatedAt).toLocaleString()}，调用时自动选择渠道。` : '实际可用性取决于你的 Key 和所选渠道。'}</p>
            <ul className="mt-4 space-y-3">{selected.pricing ? selected.pricing.channels.map(channel => <li key={`${channel.vendor}.${channel.lane}`} className={`rounded-2xl border p-4 ${channel.enabled ? 'border-slate-700 bg-slate-950' : 'border-slate-800 bg-slate-900'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-100">{channel.vendor}</span><span className="rounded-full border border-slate-800 px-2 py-0.5 text-[11px] text-slate-500">渠道 {channel.lane}</span></div><span className={`text-xs ${channel.enabled ? 'text-emerald-300' : 'text-slate-500'}`}>{channel.enabled ? '可用' : '暂不可用'}</span></div>
              <ChannelStatistics channel={channel} /><div className="mt-3 border-t border-slate-800 pt-3"><ModelReferencePrices channels={[channel]} /></div>
            </li>) : selected.vendorCodes.map(code => <li key={code} className="flex justify-between gap-4 text-sm"><span>{code}</span><span className="text-xs text-slate-500">暂无监测数据</span></li>)}</ul>
            {selected.vendorCodes.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">暂无公开渠道</p>}
            {selected.id === 'gpt-5.6-sol' && <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-xs leading-6 text-slate-400"><p>缓存参考规则：缓存命中输入 ×0.1；写入缓存 5 分钟 ×1.25、1 小时 ×2。</p><p>长上下文参考规则：输入超过 272,000 Token，输入 ×2、输出 ×1.5。</p><p>其中 TIA · gpt-特价、OLX · Codex-Gpt-1、952 · codex、OLX · Codex-Gpt-2 按总输入（含缓存）判断档位。</p></div>}
          </div>
          <div className={`${panel} p-5 sm:p-6`}><h3 className="font-semibold">模型参数</h3><p className="mt-2 text-xs text-slate-500">可在酒馆的模型参数中调整。</p>{selected.settings.length ? <dl className="mt-3 divide-y divide-slate-800">{selected.settings.map(setting => <div key={setting.name} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><dt className="break-all font-mono text-sm text-slate-300">{setting.name}</dt><dd className="flex flex-wrap gap-1.5">{setting.kind === 'switch' ? <span className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400">开 / 关</span> : setting.options.map(option => <span key={option} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400">{option}</span>)}</dd></div>)}</dl> : <p className="mt-4 text-sm text-slate-500">无额外参数</p>}</div>
        </> : <p className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">换个关键词，试试其他模型。</p>}</section>
      </div>}
      <footer className="mt-6 border-t border-slate-800 pt-4 text-right text-xs text-slate-500">参考价用于比较模型；实际费用以账单为准</footer>
    </main>
  </div>;
}

function ChannelStatistics({ channel }: { channel: PricingChannel }) {
  const known = channel.statsSource !== 'unknown';
  const success = known ? channel.successRate24h : null;
  return <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-400">
    {success !== null && <><span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800"><span className={`block h-full rounded-full ${success >= 95 ? 'bg-emerald-400' : success >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${success}%` }} /></span><span>成功率 {Number(success.toFixed(1))}%</span></>}
    {known && channel.avgResponseSeconds !== null && <span>平均响应 {Number(channel.avgResponseSeconds.toFixed(1))} 秒</span>}
    <span className="text-slate-500">{channel.statsSource === 'live' ? '真实监控' : channel.statsSource === 'estimated' ? '估算数据' : '暂无监测数据'}</span>
  </div>;
}
