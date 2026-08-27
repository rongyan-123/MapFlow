import { describe, expect, it } from 'vitest';
import {
  getNodeBodyDimensions,
  getNodeLabelPosition,
  getNodePlateDimensions,
} from './skillTree3dPresentation';

describe('skillTree3dPresentation', () => {
  it('为每个节点生成有明显厚度的实体尺寸', () => {
    const [width, height, depth] = getNodeBodyDimensions(0.3);

    expect(width).toBeGreaterThan(height);
    expect(height).toBeGreaterThan(depth);
    expect(depth).toBeGreaterThan(0);
  });

  it('让节点底牌比主体略宽并保留实体厚度', () => {
    const [bodyWidth] = getNodeBodyDimensions(0.3);
    const [plateWidth, plateHeight, plateDepth] = getNodePlateDimensions(0.3);

    expect(plateWidth).toBeGreaterThan(bodyWidth);
    expect(plateHeight).toBeGreaterThan(0);
    expect(plateDepth).toBeGreaterThan(0);
  });

  it('把标签锚定在节点实体前下方，而不是脱离节点的平面位置', () => {
    const [, bodyHeight, bodyDepth] = getNodeBodyDimensions(0.3);
    const [x, y, z] = getNodeLabelPosition(0.3);

    expect(x).toBe(0);
    expect(y).toBeLessThan(-bodyHeight / 2);
    expect(z).toBeGreaterThan(bodyDepth / 2);
  });
});
