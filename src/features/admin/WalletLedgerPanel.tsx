import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatAmountMicros, readAdminWalletLedger, reverseWalletEntry, type LedgerEntry } from '../wallet/walletClient';
import WalletActionDialog, { walletButton, walletInput } from './WalletActionDialog';

const kindLabels: Record<LedgerEntry['kind'], string> = { welcome: '注册赠送', topup: '充值入账', adjustment: '人工调整', reversal: '撤销变动',usage:'模型消费' };

export default function WalletLedgerPanel({ accountId, csrfToken, onChanged }: { accountId?: string; csrfToken: string; onChanged: (notice: string) => Promise<void> }) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const ledger = useQuery({ queryKey: ['admin', accountId, 'wallet', 'ledger', search, offset], queryFn: () => readAdminWalletLedger(search, offset), retry: false });

  async function confirm({ password, note }: { password: string; note: string }) {
    if (!reversing) return;
    await reverseWalletEntry(reversing.entryId, { password, note }, csrfToken);
    setReversing(null);
    await onChanged('已撤销该笔变动');
  }

  return <section aria-label="已处理记录" className="space-y-4">
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setSearch(searchText.trim()); setOffset(0); }}>
      <label className="min-w-0 flex-1 text-sm text-slate-400">搜索记录<input className={walletInput} aria-label="搜索记录" placeholder="用户名、用户编号或备注" value={searchText} onChange={event => setSearchText(event.target.value)} /></label><button className={walletButton} disabled={ledger.isFetching} type="submit">搜索记录</button><button className={walletButton} disabled={ledger.isFetching} type="button" onClick={() => void ledger.refetch()}>刷新</button>
    </form>
    {ledger.isPending && <p role="status" className="py-10 text-center text-sm text-slate-400">正在读取记录…</p>}
    {ledger.error && <p role="alert" className="text-sm text-rose-300">{ledger.error.message} <button className={walletButton} onClick={() => void ledger.refetch()}>重试</button></p>}
    {ledger.data?.entries.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center text-sm text-slate-400">{search ? '没有找到匹配的记录' : '暂无已处理记录'}</p>}
    <ul className="space-y-3">{ledger.data?.entries.map(entry => <li key={entry.entryId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-2"><strong className="break-all font-semibold">{entry.username}</strong><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">{kindLabels[entry.kind]}</span>{entry.reversed && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-xs text-amber-200">已撤销</span>}</div><strong className={`font-mono text-lg ${entry.amountMicros < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{entry.amountMicros > 0 ? '+' : ''}{formatAmountMicros(entry.amountMicros)} 额度</strong></div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{entry.note || kindLabels[entry.kind]}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-800 pt-3 text-xs sm:grid-cols-4"><div className="min-w-0"><dt className="text-slate-500">用户编号</dt><dd className="mt-1 break-all text-slate-400">{entry.playerId}</dd></div><div><dt className="text-slate-500">操作人</dt><dd className="mt-1 break-all text-slate-300">{entry.actorUsername ?? '系统'}</dd></div><div><dt className="text-slate-500">操作时间</dt><dd className="mt-1 text-slate-400">{new Date(entry.createdAt).toLocaleString()}</dd></div><div><dt className="text-slate-500">变动后余额</dt><dd className="mt-1 tabular-nums text-slate-300">{formatAmountMicros(entry.balanceAfterMicros)} 额度</dd></div></dl>
      {!entry.reversed && (entry.kind === 'topup' || entry.kind === 'adjustment') && <div className="mt-4 flex justify-end"><button className={`${walletButton} text-slate-400`} onClick={() => setReversing(entry)}>撤销变动</button></div>}
    </li>)}</ul>
    {ledger.data && <nav aria-label="记录分页" className="flex items-center justify-between gap-2 pt-2"><button className={walletButton} disabled={offset === 0 || ledger.isFetching} onClick={() => setOffset(current => Math.max(0, current - 50))}>上一页</button><span className="text-sm text-slate-500">第 {Math.floor(offset / 50) + 1} 页</span><button className={walletButton} disabled={!ledger.data.hasMore || ledger.isFetching} onClick={() => setOffset(current => current + 50)}>下一页</button></nav>}
    {reversing && <WalletActionDialog title="撤销额度变动" confirmLabel="确认撤销" noteLabel="撤销原因" noteRequired onConfirm={confirm} onClose={() => setReversing(null)}>
      <p>撤销 <strong className="break-all text-slate-100">{reversing.username}</strong> 的这笔{kindLabels[reversing.kind]}。</p><p className="mt-2">本次将{reversing.amountMicros > 0 ? '扣减' : '退回'} <strong className="text-cyan-200">{formatAmountMicros(Math.abs(reversing.amountMicros))} 额度</strong>，原记录会标记为已撤销。</p>
    </WalletActionDialog>}
  </section>;
}
