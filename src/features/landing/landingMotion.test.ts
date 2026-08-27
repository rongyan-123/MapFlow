import { describe, expect, it } from 'vitest';
import {
  clampUnit,
  getChapterProgress,
  getSectionScrollProgress,
  getStoryChapterStyle,
  getStoryPathDrawProgress,
} from './landingMotion';

describe('landingMotion', () => {
  it('将所有滚动进度限制在 0 到 1 之间', () => {
    expect(clampUnit(-0.4)).toBe(0);
    expect(clampUnit(0.4)).toBe(0.4);
    expect(clampUnit(1.4)).toBe(1);
  });

  it('把滚动进度映射成指定章节的局部进度', () => {
    expect(getChapterProgress(0, 0, 4)).toBe(0);
    expect(getChapterProgress(0.125, 0, 4)).toBe(0.5);
    expect(getChapterProgress(0.5, 2, 4)).toBe(0);
    expect(getChapterProgress(0.875, 3, 4)).toBe(0.5);
    expect(getChapterProgress(1, 3, 4)).toBe(1);
  });

  it('根据滚动容器的位置计算舞台进度', () => {
    expect(getSectionScrollProgress(100, 100, 600)).toBe(0);
    expect(getSectionScrollProgress(400, 100, 600)).toBe(0.5);
    expect(getSectionScrollProgress(900, 100, 600)).toBe(1);
  });

  it('让章节在自己的区间内淡入、停留和淡出', () => {
    const before = getStoryChapterStyle(0.2, 1, 4);
    const active = getStoryChapterStyle(0.375, 1, 4);
    const after = getStoryChapterStyle(0.55, 1, 4);

    expect(before.opacity).toBe(0);
    expect(active.opacity).toBe(1);
    expect(active.scale).toBeGreaterThan(before.scale);
    expect(after.opacity).toBe(0);
  });

  it('在减少动效模式下保留章节内容但去掉位移和缩放', () => {
    const state = getStoryChapterStyle(0.375, 1, 4, true);

    expect(state.opacity).toBe(1);
    expect(state.translateY).toBe(0);
    expect(state.scale).toBe(1);
  });

  it('把 SVG 路径绘制进度限制在 0 到 1 之间', () => {
    expect(getStoryPathDrawProgress(-1)).toBe(0);
    expect(getStoryPathDrawProgress(0.68)).toBe(0.68);
    expect(getStoryPathDrawProgress(2)).toBe(1);
  });
});
