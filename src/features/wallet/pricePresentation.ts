import { formatAmountMicros, type PricingChannel } from './walletClient';

export function modelPriceRows(channels: readonly PricingChannel[]): { label: string; amount: string }[] {
  if (!channels.length) return [];
  const range = (amounts: number[]) => {
    const lowest = Math.min(...amounts); const highest = Math.max(...amounts);
    return lowest === highest ? formatAmountMicros(lowest) : `${formatAmountMicros(lowest)}–${formatAmountMicros(highest)}`;
  };
  const cachePrices = channels.map(channel => channel.cacheHitInputMicrosPerMillion
    ?? Math.ceil(channel.inputMicrosPerMillion / 10));
  return [
    { label: '输入参考价', amount: `¥${range(channels.map(channel => channel.inputMicrosPerMillion))}` },
    { label: '缓存命中参考价', amount: `¥${range(cachePrices)}` },
    { label: '输出参考价', amount: `¥${range(channels.map(channel => channel.outputMicrosPerMillion))}` },
  ];
}
