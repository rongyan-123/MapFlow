import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { updatePaymentDisplay, type PaymentDisplay, type PaymentChannel } from './walletClient';

export default function PaymentDisplayWindow({ topupId, channel, csrfToken, releasePending: sharedRelease }: { topupId: string; channel: PaymentChannel; csrfToken: string; releasePending?: MutableRefObject<Promise<void>> }) {
  const [display, setDisplay] = useState<PaymentDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const currentWindow = useRef<string | null>(null);
  const fallbackRelease = useRef<Promise<void>>(Promise.resolve());
  const releasePending = sharedRelease ?? fallbackRelease;

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;
    let countdown: number | undefined;
    currentWindow.current = null;
    setDisplay(null); setError(null);
    const leave = async (windowId: string) => {
      try { await updatePaymentDisplay(topupId, { action: 'leave', windowId }, csrfToken); } catch { /* The server deadline still bounds this window. */ }
    };
    async function refresh(action: 'join' | 'poll') {
      if (action === 'join') await releasePending.current;
      if (disposed) return;
      const started = performance.now();
      try {
        const reply = await updatePaymentDisplay(topupId, { action, ...(currentWindow.current ? { windowId: currentWindow.current } : {}) }, csrfToken);
        if (disposed) return;
        currentWindow.current = reply.windowId;
        setDisplay(reply); setError(null);
        if (countdown !== undefined) window.clearInterval(countdown);
        if (reply.status === 'active' && reply.expiresAt) {
          // Server duration plus monotonic browser time; network latency only shortens display.
          const deadline = started + Date.parse(reply.expiresAt) - Date.parse(reply.serverNow);
          const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
            setRemaining(seconds);
            if (!seconds) { setDisplay({ ...reply, status: 'expired', imageUrl: null }); window.clearInterval(countdown); }
          };
          tick(); countdown = window.setInterval(tick, 250);
        }
        if (reply.status === 'active' || reply.status === 'waiting') pollTimer = window.setTimeout(() => void refresh('poll'), 2000);
      } catch (failure) {
        if (disposed) return;
        if (countdown !== undefined) window.clearInterval(countdown);
        setDisplay(null);
        setError(failure instanceof Error ? failure.message : '暂时无法确认展示窗口，请重试。');
      }
    }
    void refresh('join');
    return () => {
      disposed = true;
      window.clearTimeout(pollTimer); window.clearInterval(countdown);
      if (currentWindow.current) releasePending.current = leave(currentWindow.current);
    };
  }, [topupId, csrfToken, revision, releasePending]);

  const retry = <button className="rounded-xl border border-cyan-500 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50" onClick={() => setRevision(value => value + 1)}>重新排队</button>;
  if (error) return <div className="space-y-3"><p role="alert" className="text-rose-300">{error}</p>{retry}</div>;
  if (!display) return <p role="status" className="py-10 text-slate-400">正在申请展示窗口…</p>;
  if (display.status === 'waiting') return <div role="status" className="space-y-2 py-10 text-slate-300"><p>当前有人正在充值，请稍候</p><p className="text-sm text-slate-400">前方还有 {display.position} 人，每人最多展示 20 秒，轮到你后自动显示。</p></div>;
  if (display.status === 'active' && display.imageUrl && remaining > 0) return <div className="space-y-3"><p role="status" className="text-sm text-cyan-200">本次展示剩余 {remaining} 秒</p><img src={display.imageUrl} alt={`${channel === 'wechat' ? '微信' : '支付宝'}收款码`} className="mx-auto max-h-[min(50dvh,24rem)] w-auto max-w-full rounded-lg object-contain" /><p className="text-xs leading-5 text-slate-400">展示结束后可重新排队。已扫码请在订单有效期内按指定金额付款，到账会自动更新。</p></div>;
  if (display.status === 'finished') return <p role="status" className="py-8 text-slate-400">本次展示已结束，正在更新订单状态…</p>;
  return <div className="space-y-3 py-8"><p role="status" className="text-slate-300">展示时间已结束</p><p className="text-xs text-slate-400">已扫码可继续按指定金额付款，无需重复创建订单。</p>{retry}</div>;
}
