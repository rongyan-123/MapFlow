import { describe, expect, it } from 'vitest';
import { getGroupViewport,getReadableInitialZoom,getStartingViewport } from './viewport';

describe('skill tree viewport', () => {
  it('keeps a tall narrow group readable with its heading visible instead of shrinking the entire group',()=>{
    const view=getGroupViewport({width:390,height:660},{x:-148,y:300,width:296,height:1100},{x:0,y:0,zoom:.2});
    expect(view.zoom).toBeGreaterThanOrEqual(.85);
    expect(300*view.zoom+view.y).toBe(32);
    expect(-148*view.zoom+view.x).toBeGreaterThanOrEqual(32);
    expect(148*view.zoom+view.x).toBeLessThanOrEqual(358);
  });
  it('放大 fitView 的结果，让默认地图保持可读', () => {
    expect(getReadableInitialZoom(0.3)).toBeCloseTo(0.405);
  });

  it('不会把已经足够大的视图继续放大到超过上限', () => {
    expect(getReadableInitialZoom(0.95)).toBe(1.15);
  });
  it('places the starting card near the top with its center aligned across narrow and wide canvases',()=>{
    expect(getStartingViewport({width:390,height:740},{x:-120,y:168},1)).toEqual({x:195,y:-116,zoom:1});
    expect(getStartingViewport({width:1216,height:832},{x:-120,y:0},1.15)).toEqual({x:608,y:52,zoom:1.15});
  });
});
