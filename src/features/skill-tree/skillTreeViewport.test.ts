import { describe, expect, it } from 'vitest';
import {
  getMobileViewportAdjustment,
  shouldRefitViewport,
  type FlowBounds,
  type ViewportSize,
} from './skillTreeViewport';

describe('skill tree viewport adaptation', () => {
  it('fits on the first measured canvas and preserves the viewport for small changes', () => {
    const first: ViewportSize = { width: 390, height: 844 };

    expect(shouldRefitViewport(null, first)).toBe(true);
    expect(shouldRefitViewport(first, { width: 382, height: 832 })).toBe(false);
  });

  it('refits when crossing the desktop breakpoint or changing size substantially', () => {
    expect(
      shouldRefitViewport(
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ),
    ).toBe(true);
    expect(
      shouldRefitViewport(
        { width: 1280, height: 720 },
        { width: 1100, height: 720 },
      ),
    ).toBe(true);
    expect(
      shouldRefitViewport(
        { width: 390, height: 844 },
        { width: 390, height: 740 },
      ),
    ).toBe(false);
  });

  it('places a short mobile graph anchor near the upper third without clipping the graph', () => {
    const graphBounds: FlowBounds = { x: -100, y: 0, width: 300, height: 136 };
    const anchorBounds: FlowBounds = { x: 0, y: 0, width: 200, height: 80 };

    expect(
      getMobileViewportAdjustment(
        { x: 0, y: 0, zoom: 1 },
        graphBounds,
        anchorBounds,
        { width: 390, height: 844 },
      ),
    ).toEqual({ x: 0, y: 238.52, zoom: 1 });
  });

  it('clamps the mobile offset when moving the anchor would clip the graph', () => {
    const graphBounds: FlowBounds = { x: -100, y: 0, width: 300, height: 700 };
    const anchorBounds: FlowBounds = { x: 0, y: 620, width: 200, height: 80 };

    expect(
      getMobileViewportAdjustment(
        { x: 0, y: 0, zoom: 1 },
        graphBounds,
        anchorBounds,
        { width: 390, height: 844 },
      ),
    ).toEqual({ x: 0, y: 24, zoom: 1 });
  });

  it('keeps only the anchor visible for a long 79-node mobile graph', () => {
    const nodeCount = 79;
    const nodeHeight = 80;
    const rowStep = nodeHeight + 56;
    const graphBounds: FlowBounds = {
      x: -100,
      y: 0,
      width: 300,
      height: nodeHeight + (nodeCount - 1) * rowStep,
    };
    const anchorBounds: FlowBounds = { x: 0, y: 0, width: 200, height: 80 };

    expect(
      getMobileViewportAdjustment(
        { x: 0, y: 0, zoom: 1 },
        graphBounds,
        anchorBounds,
        { width: 390, height: 844 },
      ),
    ).toEqual({ x: 0, y: 238.52, zoom: 1 });
  });
});
