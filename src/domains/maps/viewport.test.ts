import { describe, expect, it } from 'vitest';
import { getReadableInitialZoom } from './viewport';

describe('skill tree viewport', () => {
  it('放大 fitView 的结果，让默认地图保持可读', () => {
    expect(getReadableInitialZoom(0.3)).toBeCloseTo(0.405);
  });

  it('不会把已经足够大的视图继续放大到超过上限', () => {
    expect(getReadableInitialZoom(0.95)).toBe(1.15);
  });
});
