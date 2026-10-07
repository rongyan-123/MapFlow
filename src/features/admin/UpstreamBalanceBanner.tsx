import { useEffect, useState } from 'react';
import { readUpstreamBalance, type UpstreamBalance } from '../wallet/walletClient';

export default function UpstreamBalanceBanner({ accountId }: { accountId?: string }) {
  const [balance, setBalance] = useState<UpstreamBalance | null>(null);
  useEffect(() => {
    let active = true;
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      try { const reply = await readUpstreamBalance(); if (active) setBalance(reply); }
      catch { if (active) setBalance({ status: 'unavailable', availableBalanceUsd: null, checkedAt: new Date().toISOString() }); }
      finally { checking = false; }
    }
    setBalance(null); void check();
    const timer = window.setInterval(() => void check(), 90_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accountId]);
  if (!balance || balance.status === 'disabled') return null;
  if (balance.status === 'exhausted') return <p role="alert" className="shrink-0 border-b border-rose-500/40 bg-rose-500/15 px-5 py-3 text-sm text-rose-200">上游账号余额已耗尽，请及时补充上游余额，平台模型调用可能失败。</p>;
  if (balance.status === 'unavailable') return <p role="status" className="shrink-0 border-b border-amber-500/30 px-5 py-2 text-xs text-amber-200">暂时无法检测上游余额，将自动重试。</p>;
  return <p className="shrink-0 border-b border-slate-800 px-5 py-2 text-xs text-slate-400">上游可用余额：${balance.availableBalanceUsd} USD · 每 90 秒检查</p>;
}
