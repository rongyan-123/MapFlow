import { useQuery } from '@tanstack/react-query';
import { formatAmountMicros, readWallet } from './walletClient';

export default function WalletBalance({ accountId, onClick }: { accountId: string; onClick: () => void }) {
  const wallet = useQuery({ queryKey: ['me', accountId, 'wallet'], queryFn: readWallet, retry: false, refetchInterval: 15_000 });
  const amount = !wallet.error && wallet.data ? formatAmountMicros(wallet.data.balanceMicros) : null;
  const label = wallet.error ? '额度暂不可用，前往充值' : amount === null ? '正在读取现金额度，前往充值' : `现金额度 ${amount}，前往充值`;
  return <button type="button" onClick={onClick} aria-label={label} title={label} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-3">
    <svg aria-hidden="true" className="hidden h-3.5 w-3.5 sm:block" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5.5h13v11H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h11v2M12 9h5v4h-5z" /><path d="M14 11h.5" /></svg>
    <span>额度</span><span className="font-mono tabular-nums">{amount ?? (wallet.error ? '—' : '…')}</span><span aria-hidden="true" className="hidden text-cyan-300/70 sm:inline">＋</span>
  </button>;
}
