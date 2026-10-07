import type { PricingChannel } from './walletClient';
import { modelPriceRows } from './pricePresentation';

export default function ModelReferencePrices({ channels, compact = false }: {
  channels: readonly PricingChannel[];
  compact?: boolean;
}) {
  const rows = modelPriceRows(channels);
  if (!rows.length) return <span className="text-xs text-slate-400">价格暂时无法获取</span>;
  return <span className={`block ${compact ? 'text-xs' : 'text-sm'}`}>
    <span className="mb-2 block text-[11px] text-slate-500">参考价 · 每百万 Token</span>
    <span className="grid gap-1.5" role="list" aria-label="参考价格">
      {rows.map(row => <span key={row.label} role="listitem" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-slate-400">{row.label}</span>
        <span className="break-all font-mono tabular-nums text-cyan-200">{row.amount}</span>
      </span>)}
    </span>
  </span>;
}

export function ReferencePriceNote() {
  return <p className="text-xs leading-6 text-slate-400">计费倍率 <strong className="font-semibold text-cyan-200">0.2</strong> · 上方为参考价，实际费用以本次账单为准。</p>;
}
