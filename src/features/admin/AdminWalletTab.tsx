import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approveTopup, formatAmountMicros, formatFen, readAdminChannels, readAdminTopups, rejectTopup, uploadChannel, type PaymentChannel, type Topup } from '../wallet/walletClient';
import WalletAdjustmentPanel from './WalletAdjustmentPanel';
import WalletLedgerPanel from './WalletLedgerPanel';
import WalletActionDialog, { walletButton, walletPrimaryButton } from './WalletActionDialog';

type WalletTab = 'pending' | 'ledger' | 'adjust' | 'channels';
type Review = { action: 'approve' | 'reject'; order: Topup };

export default function AdminWalletTab({ csrfToken, accountId }: { csrfToken: string; accountId?: string }) {
  const queryClient = useQueryClient();
  const adminKey = ['admin', accountId, 'wallet'] as const;
  const [tab, setTab] = useState<WalletTab>('pending');
  const orders = useQuery({ queryKey: [...adminKey, 'topups', 'awaiting_review'], queryFn: () => readAdminTopups('awaiting_review'), refetchInterval: 30_000, retry: false });
  const channels = useQuery({ queryKey: [...adminKey, 'channels'], queryFn: readAdminChannels, enabled: tab === 'channels', retry: false });
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const uploadLock = useRef(false);

  async function refreshWallets() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKey }),
      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'me' && query.queryKey[2] === 'wallet' }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  }
  async function changed(message: string) { setNotice(message); await refreshWallets(); }
  async function confirmReview({ password, note }: { password: string; note: string }) {
    if (!review) return;
    const { action, order } = review;
    await (action === 'approve' ? approveTopup(order.topupId, { password, ...(note ? { note } : {}) }, csrfToken) : rejectTopup(order.topupId, note, csrfToken));
    setReview(null);
    setNotice(action === 'approve' ? `已为 ${order.username ?? order.playerId} 入账 ${formatAmountMicros((order.paymentAmountFen ?? order.amountFen) * 10_000)} 额度` : `已拒绝 ${order.username ?? order.playerId} 的充值申请`);
    await refreshWallets();
  }
  async function upload(channel: PaymentChannel, file: File | undefined) {
    if (!file || uploadLock.current) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('请选择不超过 2 MiB 的 PNG 或 JPEG 图片。'); return; }
    uploadLock.current = true; setBusy(true); setError(null); setNotice(null);
    try { await uploadChannel(channel, file, csrfToken); await refreshWallets(); setNotice('收款码已更新'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '上传失败，请重试。'); }
    finally { uploadLock.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <div><h2 className="text-xl font-semibold tracking-tight">额度管理</h2><p className="mt-1 text-sm text-slate-400">核实充值、管理用户额度，查看每一笔变动。</p></div>
    <div role="tablist" aria-label="额度管理分区" className="flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5">
      {([{ id: 'pending', label: '待核实' }, { id: 'ledger', label: '已处理记录' }, { id: 'adjust', label: '调整用户额度' }, { id: 'channels', label: '收款码' }] as const).map(item => <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === item.id ? 'bg-slate-800 text-cyan-200' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`} onClick={() => { setTab(item.id); setError(null); setNotice(null); }}>{item.label}{item.id === 'pending' && orders.data && <span className="ml-2 rounded-md bg-cyan-300/10 px-1.5 py-0.5 text-xs text-cyan-300">{orders.data.pendingCount}</span>}</button>)}
    </div>
    {notice && <p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {tab === 'pending' && <section aria-label="待核实申请">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-400">核对实际收款后，将充值金额入账。</p><button className={walletButton} onClick={() => void orders.refetch()} disabled={orders.isFetching}>刷新列表</button></div>
      {orders.isPending && <p role="status" className="py-8 text-center text-sm text-slate-400">正在读取待核实申请…</p>}
      {orders.error && <p role="alert" className="text-sm text-rose-300">{orders.error.message}</p>}
      {orders.data?.topups.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-14 text-center"><p className="font-medium text-slate-200">申请都处理完了</p><p className="mt-2 text-sm text-slate-500">新的充值申请会显示在这里。</p></div>}
      <ul className="space-y-3">{orders.data?.topups.map(order => <li key={order.topupId} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-all text-base">{order.username ?? order.playerId ?? order.accountId}</strong><span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200">待核实</span></div><p className="mt-2 text-sm text-slate-400">{order.channel === 'wechat' ? '微信支付' : '支付宝'} · {new Date(order.createdAt).toLocaleString()}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="mr-auto font-mono text-lg font-semibold text-slate-100">¥{formatFen(order.paymentAmountFen ?? order.amountFen)}</span><button className={walletButton} onClick={() => setReview({ action: 'reject', order })}>拒绝申请</button><button className={walletPrimaryButton} onClick={() => setReview({ action: 'approve', order })}>入账 {formatAmountMicros((order.paymentAmountFen ?? order.amountFen) * 10_000)} 额度</button></div>
        </div>
        <details className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500"><summary className="cursor-pointer hover:text-slate-300">申请详情</summary><p className="mt-2 break-all">申请编号：{order.topupId}</p><p className="mt-1 break-all">用户编号：{order.playerId ?? order.accountId}</p><img alt="申请时收款码" src={order.qrImageUrl} className="mt-3 h-40 w-40 rounded-lg object-contain" /></details>
      </li>)}</ul>
    </section>}
    {tab === 'adjust' && <WalletAdjustmentPanel key={accountId} accountId={accountId} csrfToken={csrfToken} onChanged={changed} />}
    {tab === 'ledger' && <WalletLedgerPanel key={accountId} accountId={accountId} csrfToken={csrfToken} onChanged={changed} />}
    {tab === 'channels' && <section aria-label="收款码配置" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
      <h3 className="font-semibold">收款码</h3><p className="mt-2 text-sm text-slate-400">用户创建充值申请后，将看到对应渠道的收款码。</p>
      {channels.isPending && <p role="status" className="mt-4 text-sm text-slate-400">正在读取收款码…</p>}
      {channels.error && <p role="alert">{channels.error.message} <button className={walletButton} onClick={() => void channels.refetch()}>重试</button></p>}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">{(['wechat', 'alipay'] as const).map(channel => { const saved = channels.data?.find(item => item.channel === channel); const label = channel === 'wechat' ? '微信' : '支付宝'; return <div key={channel} className="min-w-0 space-y-4 rounded-2xl border border-slate-800 p-4"><h4 className="font-medium">{label}</h4>{saved?.imageUrl ? <img src={saved.imageUrl} alt={`${label}收款码`} className="h-48 w-48 max-w-full rounded-xl bg-white object-contain p-2" /> : <div className="flex h-48 w-48 max-w-full items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">尚未配置收款码</div>}<label className="block text-sm text-slate-300">替换{label}收款码<input aria-label={`替换${label}收款码`} type="file" accept="image/png,image/jpeg" disabled={busy} className="mt-2 block w-full min-w-0 text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" onChange={event => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(channel, selected); }} /></label><p className="text-xs text-slate-500">PNG 或 JPEG，最大 2 MiB。</p></div>; })}</div>
    </section>}
    {review && <WalletActionDialog title={review.action === 'approve' ? '确认入账' : '拒绝申请'} confirmLabel={review.action === 'approve' ? `确认入账 ${formatAmountMicros((review.order.paymentAmountFen ?? review.order.amountFen) * 10_000)} 额度` : '确认拒绝'} needsPassword={review.action === 'approve'} noteLabel={review.action === 'approve' ? '备注（选填）' : '拒绝理由'} noteRequired={review.action === 'reject'} onClose={() => setReview(null)} onConfirm={confirmReview}>
      <p>用户 <strong className="break-all text-slate-100">{review.order.username ?? review.order.playerId}</strong></p><p className="mt-1">{review.action === 'approve' ? '本次将增加' : '申请充值'} <strong className="text-cyan-200">{formatAmountMicros((review.order.paymentAmountFen ?? review.order.amountFen) * 10_000)} 额度</strong></p>
    </WalletActionDialog>}
  </div>;
}
