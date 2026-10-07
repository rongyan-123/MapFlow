import { formatAmountMicros, type PricingChannel } from './walletClient';

export function modelPriceLabel(channels: readonly PricingChannel[]): string {
  if (!channels.length) return '价格暂时无法获取';
  const range = (amounts: number[]) => {
    const lowest = Math.min(...amounts); const highest = Math.max(...amounts);
    return lowest === highest ? formatAmountMicros(lowest) : `${formatAmountMicros(lowest)}–${formatAmountMicros(highest)}`;
  };
  const cachePrices = channels.map(channel => channel.cacheHitInputMicrosPerMillion);
  const knownCachePrices = cachePrices.filter((price): price is number => typeof price === 'number');
  const cached = knownCachePrices.length
    ? `¥${range(knownCachePrices)}${knownCachePrices.length < channels.length ? '（部分渠道未提供）' : ''}`
    : '上游未提供';
  return `输入参考价（未区分缓存） ¥${range(channels.map(channel => channel.inputMicrosPerMillion))} · 输入（缓存命中） ${cached} · 输出 ¥${range(channels.map(channel => channel.outputMicrosPerMillion))} / 百万 Token`;
}
