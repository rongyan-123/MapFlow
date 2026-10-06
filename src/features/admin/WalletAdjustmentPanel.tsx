import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adjustWallet, formatAmountMicros, parseAmountFen, readAdminWalletAccounts } from '../wallet/walletClient';
import WalletActionDialog, { walletButton, walletInput, walletPrimaryButton } from './WalletActionDialog';

export default function WalletAdjustmentPanel({ accountId, csrfToken, onChanged }: { accountId?: string; csrfToken: string; onChanged: (notice: string) => Promise<void> }) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingAdjustment = useRef<{ requestId: string; accountId: string; amountFen: number; note: string } | null>(null);
  const accounts = useQuery({ queryKey: ['admin', accountId, 'wallet', 'accounts', search], queryFn: () => readAdminWalletAccounts(search), enabled: search.length > 0, retry: false });
  const selected = accounts.data?.accounts.find(account => account.accountId === selectedId);
  const amountFen = parseAmountFen(amount);
  const signedFen = amountFen === null ? 0 : amountFen * (direction === 'add' ? 1 : -1);
  const amountLabel = formatAmountMicros(Math.abs(signedFen) * 10_000);
  const directionLabel = direction === 'add' ? '增加' : '扣减';

  async function confirm({ password, note }: { password: string; note: string }) {
    if (!selected || amountFen === null) return;
    const previous = pendingAdjustment.current;
    const request = previous?.accountId === selected.accountId && previous.amountFen === signedFen && previous.note === note
      ? previous : { requestId: crypto.randomUUID(), accountId: selected.accountId, amountFen: signedFen, note };
    pendingAdjustment.current = request;
    await adjustWallet(selected.accountId, { requestId: request.requestId, amountFen: request.amountFen, note, password }, csrfToken);
    pendingAdjustment.current = null;
    setConfirmOpen(false);
    setAmount('');
    await onChanged(`已为 ${selected.username} ${directionLabel} ${amountLabel} 额度`);
  }

  return <section aria-label="调整用户额度" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="font-semibold">选择用户</h3><p className="mt-2 text-sm leading-6 text-slate-400">按用户名或用户编号查找，再选择要调整的账号。</p>
      <form className="mt-4 flex items-end gap-2" onSubmit={event => { event.preventDefault(); setSearch(searchText.trim()); setSelectedId(null); pendingAdjustment.current = null; }}>
        <label className="min-w-0 flex-1 text-sm text-slate-400">搜索用户<input aria-label="搜索用户" className={walletInput} value={searchText} placeholder="用户名或用户编号" onChange={event => setSearchText(event.target.value)} /></label><button className={walletButton} type="submit" disabled={!searchText.trim() || accounts.isFetching}>查找用户</button>
      </form>
      {!search && <p className="py-10 text-center text-sm text-slate-500">搜索后在这里选择用户</p>}
      {search && accounts.isPending && <p role="status" className="py-8 text-center text-sm text-slate-400">正在查找用户…</p>}
      {accounts.error && <p role="alert" className="mt-4 text-sm text-rose-300">{accounts.error.message} <button className={walletButton} onClick={() => void accounts.refetch()}>重试</button></p>}
      {accounts.data?.accounts.length === 0 && <p className="py-8 text-center text-sm text-slate-400">没有找到匹配的用户</p>}
      <ul className="mt-4 space-y-2">{accounts.data?.accounts.map(account => <li key={account.accountId}><button type="button" aria-label={`选择 ${account.username}，余额 ${formatAmountMicros(account.balanceMicros)} 额度`} aria-pressed={selectedId === account.accountId} className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selectedId === account.accountId ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-slate-800 hover:border-slate-600'}`} onClick={() => { setSelectedId(account.accountId); setError(null); pendingAdjustment.current = null; }}><span className="min-w-0"><strong className="block break-all text-sm font-medium text-slate-100">{account.username}</strong><span className="mt-1 block break-all text-xs text-slate-500">{account.playerId}{account.status !== 'active' ? ' · 已停用' : ''}</span></span><span className="shrink-0 text-sm tabular-nums text-slate-300">{formatAmountMicros(account.balanceMicros)} 额度</span></button></li>)}</ul>
    </div>
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
      <h3 className="font-semibold">调整额度</h3>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">{selected ? <><p className="break-all font-semibold text-cyan-200">{selected.username}</p><p className="mt-1 text-sm text-slate-400">当前余额 {formatAmountMicros(selected.balanceMicros)} 额度</p></> : <p className="text-sm text-slate-500">请先选择用户</p>}</div>
      <fieldset className="mt-5"><legend className="mb-2 text-sm text-slate-300">调整方式</legend><div className="flex flex-wrap gap-2">{(['add', 'subtract'] as const).map(option => <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${direction === option ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`}><input type="radio" name="wallet-adjustment-direction" value={option} checked={direction === option} className="accent-cyan-400" onChange={() => { setDirection(option); pendingAdjustment.current = null; }} />{option === 'add' ? '增加额度' : '扣减额度'}</label>)}</div></fieldset>
      <label className="mt-5 block text-sm text-slate-300">调整额度<input aria-label="调整额度" className={walletInput} inputMode="decimal" value={amount} placeholder="例如 3.00" onChange={event => { setAmount(event.target.value); pendingAdjustment.current = null; }} /></label>
      <p className="mt-2 text-xs text-slate-500">最少 0.01 额度，最多 10,000 额度，支持两位小数。</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <button className={`${walletPrimaryButton} mt-6 w-full`} disabled={!selected || accounts.isFetching || !!accounts.error} onClick={() => { if (amountFen === null) { setError('请输入 0.01–10,000 额度，最多两位小数。'); return; } setError(null); setConfirmOpen(true); }}>确认调整</button>
    </div>
    {confirmOpen && selected && <WalletActionDialog title="确认调整额度" confirmLabel={`${directionLabel} ${amountLabel} 额度`} noteLabel="调整原因" noteRequired onConfirm={confirm} onClose={() => setConfirmOpen(false)}>
      <p>将为 <strong className="break-all text-slate-100">{selected.username}</strong> {directionLabel} <strong className="text-cyan-200">{amountLabel} 额度</strong>。</p><p className="mt-1 text-slate-400">当前余额 {formatAmountMicros(selected.balanceMicros)} 额度</p>
    </WalletActionDialog>}
  </section>;
}
