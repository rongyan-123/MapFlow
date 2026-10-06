import { useEffect, useRef, useState } from 'react';
import PaymentDisplayWindow from './PaymentDisplayWindow';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createTopup, declarePaid, declareUnpaid, formatAmountMicros, formatFen, parseAmountFen, readWallet, type LedgerEntry, type PaymentChannel, type Topup } from './walletClient';

const surface = 'min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6';
const button = 'rounded-xl border border-slate-700 px-3.5 py-2.5 text-sm font-medium transition hover:border-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50';
const statusLabels: Record<Topup['status'], string> = { awaiting_payment: '待付款', awaiting_review: '待核实', closed_unpaid: '未付款关闭', credited: '已入账', rejected: '已拒绝', reversed: '已撤销' };
const ledgerLabels: Record<LedgerEntry['kind'], string> = { welcome: '一次性赠送', topup: '充值入账', adjustment: '额度调整', reversal: '撤销变动' };
export default function WalletPage({ accountId, csrfToken, onBack, onNavigateModels }: { accountId: string; csrfToken: string; onBack: () => void; onNavigateModels: () => void }) {
  const queryClient = useQueryClient();
  const walletKey = ['me', accountId, 'wallet'] as const;
  const [activeTopup, setActiveTopup] = useState<Topup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now);
  const wallet = useQuery({ queryKey: walletKey, queryFn: readWallet, retry: false,
    refetchInterval: activeTopup ? 2_000 : 15_000 });
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<PaymentChannel>('wechat');
  const selectedChannel = wallet.data?.channels.some(item => item.channel === channel)
    ? channel : wallet.data?.channels[0]?.channel ?? channel;
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [paidExitVisible, setPaidExitVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCreate = useRef<{ requestId: string; amountFen: number; channel: PaymentChannel } | null>(null);
  const lock = useRef(false);
  const paymentDisplayRelease = useRef<Promise<void>>(Promise.resolve());
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const paymentDialogRef = useRef<HTMLDivElement>(null);
  const paymentReturnFocusRef = useRef<HTMLElement | null>(null);
  const paymentExpired = !!activeTopup?.paymentExpiresAt && Date.parse(activeTopup.paymentExpiresAt) <= clockNow;
  useEffect(() => {
    if (!activeTopup?.paymentExpiresAt) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTopup?.topupId]);
  useEffect(() => {
    const current = wallet.data?.topups.find(item => item.topupId === activeTopup?.topupId);
    if (current?.status === 'credited') {
      setActiveTopup(null); setChoiceOpen(false); setNotice('充值已到账');
    }
  }, [wallet.data, activeTopup?.topupId]);
  useEffect(() => {
    if (!activeTopup) return;
    const dialog = paymentDialogRef.current;
    if (!dialog) return;
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!lock.current) setChoiceOpen(true);
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)'));
      const focusedIndex = controls.findIndex(control => control === document.activeElement);
      if (controls.length === 0) { event.preventDefault(); dialog.focus(); return; }
      if (focusedIndex === -1 || (event.shiftKey && focusedIndex === 0) || (!event.shiftKey && focusedIndex === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    };
    document.addEventListener('focusin', containFocus);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activeTopup?.topupId]);
  useEffect(() => {
    if (activeTopup) {
      // The same button position can become a payment declaration after a view change.
      paymentDialogRef.current?.focus();
    } else if (!busy && paymentReturnFocusRef.current) {
      const restoreTarget = [paymentReturnFocusRef.current, createButtonRef.current, backButtonRef.current]
        .find(element => element?.isConnected && !element.matches(':disabled'));
      restoreTarget?.focus();
      paymentReturnFocusRef.current = null;
    }
  }, [activeTopup?.topupId, choiceOpen, busy]);
  useEffect(() => { if (!activeTopup || choiceOpen) return; setPaidExitVisible(false); const timer = window.setTimeout(() => setPaidExitVisible(true), 5000); return () => window.clearTimeout(timer); }, [activeTopup?.topupId, choiceOpen]);
  useEffect(() => { setActiveTopup(null); setChoiceOpen(false); setError(null); setNotice(null); pendingCreate.current = null; paymentReturnFocusRef.current = null; }, [accountId]);
  async function create() {
    if (lock.current || activeTopup) return;
    const amountFen = parseAmountFen(amount);
    if (amountFen === null) { setError('请输入 0.01–10,000 元，最多两位小数。'); return; }
    if (!wallet.data?.channels.some(item => item.channel === selectedChannel && item.qrCodeId)) { setError('当前渠道收款码不可用，请选择其他渠道。'); return; }
    const input = pendingCreate.current?.amountFen === amountFen && pendingCreate.current.channel === selectedChannel
      ? pendingCreate.current : { requestId: crypto.randomUUID(), amountFen, channel: selectedChannel };
    paymentReturnFocusRef.current = createButtonRef.current;
    pendingCreate.current = input; lock.current = true; setBusy(true); setError(null); setNotice(null);
    try { const created = await createTopup(input, csrfToken); pendingCreate.current = null; setActiveTopup(created); setChoiceOpen(false); await queryClient.invalidateQueries({ queryKey: walletKey }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '创建失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function declare(paid: boolean) {
    if (!activeTopup || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await (paid ? declarePaid(activeTopup.topupId, csrfToken) : declareUnpaid(activeTopup.topupId, csrfToken)); setActiveTopup(null); setChoiceOpen(false); await queryClient.invalidateQueries({ queryKey: walletKey }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '提交失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="h-dvh min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-8"><button ref={backButtonRef} className={button} onClick={onBack}>返回</button><h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">我的额度</h1><button className={`${button} ml-auto`} onClick={onNavigateModels}>模型价格</button></div></header>
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-8 sm:py-8">{notice && <p role="status" className="text-emerald-300">{notice}</p>}
      {wallet.isPending && <p role="status" className="py-16 text-center text-sm text-slate-400">正在读取额度…</p>}
      {wallet.error && <div role="alert" className={surface}><p className="mb-3 text-sm text-rose-300">{wallet.error.message}</p><button className={button} onClick={() => void wallet.refetch()}>重试读取额度</button></div>}
      {wallet.data && !wallet.error && <>
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className={`${surface} relative overflow-hidden`}><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-cyan-400/5 blur-3xl" /><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">My Wallet</p><h2 className="mt-6 text-sm text-slate-400">可用额度</h2><p className="mt-3 break-all text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">{formatAmountMicros(wallet.data.balanceMicros)} 额度</p><p className="mt-6 border-t border-slate-800 pt-4 text-xs leading-6 text-slate-500">1 元 = 1 额度。现金额度与学习积分分开记录。</p></section>
          <section className={surface}><h2 className="text-lg font-semibold">充值申请</h2><p className="mt-2 text-sm leading-6 text-slate-400">选择渠道后，按订单显示的金额付款，收款确认后自动到账。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm text-slate-300">充值金额（元）<input aria-label="充值金额（元）" value={amount} onChange={event => { setAmount(event.target.value); pendingCreate.current = null; }} inputMode="decimal" placeholder="例如 10.00" className="mt-2 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400" /></label><label className="min-w-0 text-sm text-slate-300">付款渠道<select aria-label="付款渠道" value={selectedChannel} onChange={event => { if (event.target.value === 'wechat' || event.target.value === 'alipay') setChannel(event.target.value); pendingCreate.current = null; }} className="mt-2 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400">{wallet.data.channels.map(item => <option key={item.channel} value={item.channel}>{item.label}</option>)}</select></label></div><button ref={createButtonRef} className={`${button} mt-5 w-full border-cyan-300/70 bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200`} disabled={busy || activeTopup !== null || wallet.data.channels.length === 0} onClick={() => void create()}>{busy ? '创建中…' : '创建充值申请'}</button>{wallet.data.channels.length === 0 && <p className="mt-3 text-sm text-amber-200">充值渠道暂未开放，请联系客服。</p>}<p className="mt-4 text-xs leading-6 text-slate-500">预计 2–5 分钟到账，遇到问题请联系客服，<span className="whitespace-nowrap">v：19375007608</span></p></section>
        </div>
        <section className={surface}><div className="mb-5 flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">额度流水</h2><span className="text-xs text-slate-500">每一笔变动都在这里</span></div>{wallet.data.ledger.length === 0 ? <p className="py-7 text-center text-sm text-slate-500">暂无流水</p> : <ul className="divide-y divide-slate-800">{wallet.data.ledger.map(item => <li key={item.entryId} className="flex flex-wrap justify-between gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-200">{ledgerLabels[item.kind]}</p>{item.reversed && <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200">已撤销</span>}</div>{item.note && <p className="mt-1.5 max-w-lg whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">{item.note}</p>}<p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div><div className="ml-auto shrink-0 text-right"><p className={`font-mono text-base font-medium ${item.amountMicros < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{item.amountMicros > 0 ? '+' : ''}{formatAmountMicros(item.amountMicros)} 额度</p><p className="mt-2 text-xs text-slate-500">余额 {formatAmountMicros(item.balanceAfterMicros)} 额度</p></div></li>)}</ul>}</section>
        <section className={surface}><h2 className="mb-5 text-lg font-semibold">历史申请</h2>{wallet.data.topups.length === 0 ? <p className="py-7 text-center text-sm text-slate-500">暂无申请</p> : <ul className="space-y-3">{wallet.data.topups.map(item => <li key={item.topupId} className="rounded-xl border border-slate-800 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">¥{formatFen(item.paymentAmountFen ?? item.amountFen)} · {item.channel === 'wechat' ? '微信' : '支付宝'}</span><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === 'credited' ? 'bg-emerald-400/10 text-emerald-300' : item.status === 'awaiting_review' ? 'bg-amber-300/10 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>{statusLabels[item.status]}</span></div><p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>{item.reviewNote && <p className="mt-2 break-words text-slate-400">{item.reviewNote}</p>}<details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer hover:text-slate-300">查看申请详情</summary><p className="mt-2 break-all">申请编号：{item.topupId}</p></details>{['awaiting_payment', 'closed_unpaid'].includes(item.status) && <button className={`${button} mt-3`} onClick={event => { paymentReturnFocusRef.current = event.currentTarget; setActiveTopup(item); setChoiceOpen(true); setError(null); }}>声明付款状态</button>}</li>)}</ul>}</section>
      </>}
      {activeTopup && <div ref={paymentDialogRef} role="dialog" aria-modal="true" aria-label="充值付款" aria-busy={busy} tabIndex={-1} className="fixed outline-none inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"><div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center sm:max-h-[calc(100dvh-2rem)] sm:p-5"><h2 className="text-lg font-bold">{activeTopup.paymentAmountFen ? `请支付 ¥${formatFen(activeTopup.paymentAmountFen)}` : `充值 ¥${formatFen(activeTopup.amountFen)}`}</h2>{activeTopup.paymentAmountFen && <p className="text-sm text-amber-200">请按以上金额付款，实付金额将全部计入额度。{activeTopup.paymentAmountFen !== activeTopup.amountFen && '系统已调整金额以区分订单，请勿改回原金额。'}</p>}{activeTopup.paymentExpiresAt && <p className="text-sm text-slate-400">{paymentExpired ? '订单已过期，请关闭后重新创建，勿再扫码付款。' : `请在 ${new Date(activeTopup.paymentExpiresAt).toLocaleTimeString()} 前付款`}</p>}<p>{activeTopup.channel === 'wechat' ? '微信' : '支付宝'}</p>{!choiceOpen && !paymentExpired && <PaymentDisplayWindow topupId={activeTopup.topupId} channel={activeTopup.channel} csrfToken={csrfToken} releasePending={paymentDisplayRelease} />}<p className="text-sm text-slate-400">预计 2–5 分钟到账，遇到问题请联系客服，<span className="whitespace-nowrap">v：19375007608</span></p>{error && <p role="alert" className="text-rose-300">{error}</p>}{choiceOpen ? <div className="flex flex-wrap justify-center gap-2"><button className={button} disabled={busy} onClick={() => void declare(true)}>我已付款</button><button className={button} disabled={busy} onClick={() => void declare(false)}>我没有付款</button><button className={button} disabled={busy} onClick={() => setChoiceOpen(false)}>返回收款码</button></div> : <div className="flex flex-wrap justify-center gap-2"><button className={button} onClick={() => setChoiceOpen(true)}>关闭</button>{paidExitVisible && <button className={button} onClick={() => setChoiceOpen(true)}>我已付款，点击退出</button>}</div>}</div></div>}
      {error && !activeTopup && <p role="alert" className="text-rose-300">{error}</p>}
    </main>
  </div>;
}
