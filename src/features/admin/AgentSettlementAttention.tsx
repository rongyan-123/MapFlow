import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchAgentSettlementAttention} from './agentModelClient';

export default function AgentSettlementAttention({accountId}:{accountId?:string}) {
  const [open,setOpen]=useState(false),[before,setBefore]=useState<string>();
  const query=useQuery({queryKey:['admin',accountId,'agent-settlements',before??null],queryFn:()=>fetchAgentSettlementAttention(before),refetchInterval:60_000,retry:false});
  if(query.error)return <aside className="shrink-0 border-b border-amber-700 bg-slate-900 px-4 py-2 text-sm text-amber-200">
    费用核对记录暂时无法读取。<button type="button" className="ml-3 underline" onClick={()=>void query.refetch()}>重新读取</button></aside>;
  if(!query.data?.totalCount)return null;
  const page=query.data;
  return <aside aria-label="费用核对提醒" className="shrink-0 border-b border-amber-700 bg-slate-900 text-sm text-amber-100">
    <div className="flex flex-wrap items-center gap-3 px-4 py-2"><strong>{page.totalCount} 笔费用待核对</strong>
      <span className="text-xs text-amber-200">结果已保留；金额未知的记录持续等待原回执。</span>
      <button type="button" className="underline" aria-expanded={open} onClick={()=>setOpen(previous=>!previous)}>{open?'收起待核对记录':'查看待核对记录'}</button>
    </div>
    {open&&<section aria-label="待核对费用记录" className="max-h-80 space-y-3 overflow-y-auto border-t border-slate-700 px-4 py-3">
      {page.pending.map(row=><article key={row.executionId} className="space-y-2 rounded-xl border border-slate-700 p-3">
        <p className="break-all font-mono">{row.executionId}</p><p>{row.reason}</p>
        <p className="break-all text-xs text-slate-300">账号：{row.accountId} · {row.funding==='cash'?'现金额度':row.funding==='points'?'平台积分':'自填 Key'} · {row.status}</p>
        <p className="text-xs text-slate-300">最近核对：{row.checkedAt?new Date(row.checkedAt).toLocaleString():'尚未核对'}</p>
        {row.calls.map(call=><div key={call.callId} className="space-y-1 border-t border-slate-700 pt-2 text-xs">
          <p className="break-all font-mono">{call.callId}</p><p>调用状态：{call.status}</p>
          <p>{call.usage?`输入 ${call.usage.inputTokens} · 输出 ${call.usage.outputTokens} Token`:'调用用量尚未提供'}</p>
          {call.receipts.length?call.receipts.map(receipt=><p key={`${receipt.receiptId}:${receipt.amount}`} className="break-all">金额回执：{receipt.currency} {receipt.amount} · {receipt.receiptId}{receipt.validationError?` · ${receipt.validationError}`:''}</p>):<p>金额回执尚未提供</p>}
        </div>)}
        {Boolean(row.diagnostic.posting||row.diagnostic.reconciliation)&&<pre className="whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(row.diagnostic,null,2)}</pre>}
      </article>)}
      <div className="flex gap-3"><button type="button" className="underline" onClick={()=>{setBefore(undefined);void query.refetch();}}>返回最新记录</button>
        {page.nextBefore&&<button type="button" className="underline" onClick={()=>setBefore(page.nextBefore!)}>下一页</button>}
      </div>
    </section>}
  </aside>;
}
