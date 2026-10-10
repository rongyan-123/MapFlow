import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import useIsMobile from './useIsMobile';

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  window.innerWidth = originalInnerWidth;
});

describe('useIsMobile', () => {
  it('把手机宽度（390px）判定为移动端', () => {
    window.innerWidth = 390;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('把 1024px 与更宽的视口判定为非移动端', () => {
    window.innerWidth = 1024;
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);

    window.innerWidth = 1440;
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('视口在 1023 与 1024 之间切换时跟随更新', () => {
    window.innerWidth = 1023;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.innerWidth = 390;
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
  });
});
