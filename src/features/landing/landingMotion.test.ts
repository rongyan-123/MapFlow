import { describe, expect, it } from 'vitest';
import {
  clampUnit,
  getChapterProgress,
  getEarthZoom,
  getEarthRevealProgress,
  getMediaRevealProgress,
  getPointerIntent,
  getPointerIntentFromDisplacement,
  getSceneProgress,
  getSectionScrollProgress,
  getStorySceneProgress,
  getStoryTimelineState,
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

  it('把每一个独立视口场景映射为自己的局部进度', () => {
    expect(getSceneProgress(0, 0, 5)).toBe(0);
    expect(getSceneProgress(0.3, 1, 5)).toBe(0.5);
    expect(getSceneProgress(0.8, 4, 5)).toBe(0);
    expect(getSceneProgress(1, 4, 5)).toBe(1);
  });

  it('在章节中心保持当前地图完整可见，并用纵向叠层过渡到下一张图', () => {
    expect(getStoryTimelineState(0.25)).toMatchObject({
      activeSceneIndex: 1,
      baseSceneIndex: 1,
      nextSceneIndex: 2,
      mediaRevealProgress: 0,
    });

    expect(getStoryTimelineState(0.375)).toMatchObject({
      activeSceneIndex: 2,
      baseSceneIndex: 1,
      nextSceneIndex: 2,
      mediaRevealProgress: 0.5,
    });

    expect(getStoryTimelineState(0.5)).toMatchObject({
      activeSceneIndex: 2,
      baseSceneIndex: 2,
      nextSceneIndex: 3,
      mediaRevealProgress: 0,
    });

    expect(getStoryTimelineState(1)).toMatchObject({
      activeSceneIndex: 4,
      baseSceneIndex: 4,
      nextSceneIndex: null,
      mediaRevealProgress: 0,
    });
  });

  it('用同一条四段滚动时间轴计算五幕局部进度', () => {
    expect(getStorySceneProgress(0.25, 1, 5)).toBe(0);
    expect(getStorySceneProgress(0.375, 1, 5)).toBe(0.5);
    expect(getStorySceneProgress(0.5, 2, 5)).toBe(0);
    expect(getStorySceneProgress(0.75, 3, 5)).toBe(0);
    expect(getStorySceneProgress(1, 4, 5)).toBe(1);
  });

  it('只在媒体 reveal 区间内推进 clip-mask', () => {
    expect(getMediaRevealProgress(0.1)).toBe(0);
    expect(getMediaRevealProgress(0.45)).toBe(0.5);
    expect(getMediaRevealProgress(0.9)).toBe(1);
  });

  it('把单指垂直移动留给页面滚动，把明显水平移动用于旋转', () => {
    expect(getPointerIntent(3, 28, 1)).toBe('scroll');
    expect(getPointerIntent(30, 6, 1)).toBe('rotate');
    expect(getPointerIntent(2, 2, 2)).toBe('pinch');
  });

  it('累计的小步水平移动超过阈值后仍能进入旋转状态', () => {
    expect(getPointerIntentFromDisplacement(14, 4, 1)).toBe('rotate');
  });

  it('将 Earth 缩放限制在可读且可控的范围内', () => {
    expect(getEarthZoom(0.1)).toBe(0.72);
    expect(getEarthZoom(1)).toBe(1);
    expect(getEarthZoom(2)).toBe(1.34);
  });

  it('只在 B 幕转句阶段可逆地揭露 Earth', () => {
    expect(getEarthRevealProgress(0)).toBe(0);
    expect(getEarthRevealProgress(0.28)).toBe(0);
    expect(getEarthRevealProgress(0.34)).toBeGreaterThan(0);
    expect(getEarthRevealProgress(0.36)).toBeGreaterThan(getEarthRevealProgress(0.34));
    expect(getEarthRevealProgress(0.4)).toBe(1);
    expect(getEarthRevealProgress(0.48)).toBe(1);
  });
});
