import { describe, expect, it } from 'vitest';
import { getPublicGuideCardPlacement } from './PublicMapGuide';

describe('getPublicGuideCardPlacement', () => {
  it('keeps the guide card inside the left gutter when the target is a centered dialog', () => {
    const placement = getPublicGuideCardPlacement(
      { left: 352, top: 90, width: 896, height: 720 },
      { width: 1600, height: 900 },
    );

    expect(placement.placement).toBe('left');
    expect(placement.left + placement.width).toBeLessThanOrEqual(352);
  });

  it('uses a vertical fallback when neither side can contain the card', () => {
    const placement = getPublicGuideCardPlacement(
      { left: 300, top: 240, width: 800, height: 420 },
      { width: 1100, height: 900 },
    );

    expect(['top', 'bottom']).toContain(placement.placement);
    expect(placement.left).toBeGreaterThanOrEqual(16);
    expect(placement.left + placement.width).toBeLessThanOrEqual(1084);
  });
});
