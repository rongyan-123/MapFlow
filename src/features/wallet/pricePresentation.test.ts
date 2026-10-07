import { expect, it } from 'vitest';
import { modelPriceRows } from './pricePresentation';
import type { PricingChannel } from './walletClient';

const channel: PricingChannel = {
  vendor: 'CBY', lane: 1, enabled: true, inputMicrosPerMillion: 290_393,
  outputMicrosPerMillion: 798_581, statsSource: 'live', successRate24h: 99.7,
  avgResponseSeconds: 7.3,
};

it('keeps the upstream reference quote and separates input, cached input and output', () => {
  expect(modelPriceRows([channel])).toEqual([
    { label: '输入参考价', amount: '¥0.290393' },
    { label: '缓存命中参考价', amount: '¥0.02904' },
    { label: '输出参考价', amount: '¥0.798581' },
  ]);
});

it('prefers an explicit cache quote, including zero, over the reference rule', () => {
  const cached = { ...channel, cacheHitInputMicrosPerMillion: 0 };
  expect(modelPriceRows([cached])[1].amount).toBe('¥0');
});

it('keeps channel ranges without applying the account billing multiplier', () => {
  expect(modelPriceRows([channel, { ...channel, inputMicrosPerMillion: 600_000,
    outputMicrosPerMillion: 1_200_000 }])).toEqual([
    { label: '输入参考价', amount: '¥0.290393–0.6' },
    { label: '缓存命中参考价', amount: '¥0.02904–0.06' },
    { label: '输出参考价', amount: '¥0.798581–1.2' },
  ]);
  expect(modelPriceRows([])).toEqual([]);
});
