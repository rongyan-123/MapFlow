import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingEarthBackground, {
  getLandingScrollDelta,
  getLandingWheelDelta,
  getInitialEarthGestureMode,
  hasCanvasSizeChanged,
  shouldForwardLandingScroll,
  shouldAnimateEarth,
  updateCameraProjection,
} from './LandingEarthBackground';

describe('LandingEarthBackground', () => {
  it('在 WebGL 不可用时保留可辨认的静态 Earth fallback', () => {
    render(<LandingEarthBackground revealProgress={0} />);

    const earth = screen.getByTestId('landing-earth-background');
    expect(earth).toHaveAttribute(
      'data-earth-renderer',
      'fallback',
    );
    expect(Number((earth as HTMLElement).style.opacity)).toBeGreaterThan(0);
    expect(screen.getByTestId('landing-earth-fallback')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-earth-interaction-hint')).not.toBeInTheDocument();
  });

  it('第一次 Ctrl+滚轮缩放后隐藏操作提示', () => {
    render(<LandingEarthBackground />);
    const canvas = screen.getByLabelText('可交互地球背景，拖动旋转，按住 Ctrl 使用滚轮缩放');

    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -80 });
    expect(screen.queryByTestId('landing-earth-interaction-hint')).not.toBeInTheDocument();
  });

  it('尺寸变化时同步更新 PerspectiveCamera 投影矩阵', () => {
    const camera = {
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
    };

    updateCameraProjection(camera, 1440, 900);

    expect(camera.aspect).toBeCloseTo(1.6);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
  });

  it('用非 passive 的原生 wheel listener 拦截 Ctrl+滚轮', () => {
    const addEventListener = vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener');

    render(<LandingEarthBackground />);

    const wheelCalls = addEventListener.mock.calls.filter(([type]) => type === 'wheel');
    expect(
      wheelCalls.some(([, , options]) => {
        return typeof options === 'object' && options !== null && options.passive === false;
      }),
    ).toBe(true);

    addEventListener.mockRestore();
  });

  it('只在地球揭露且未启用 reduced motion 时持续推进动画', () => {
    expect(shouldAnimateEarth(0, false)).toBe(false);
    expect(shouldAnimateEarth(0.08, false)).toBe(false);
    expect(shouldAnimateEarth(0.081, false)).toBe(true);
    expect(shouldAnimateEarth(1, true)).toBe(false);
  });

  it('尺寸未变化时不要求重复刷新 WebGL 投影', () => {
    expect(hasCanvasSizeChanged({ width: 1440, height: 900 }, { width: 1440, height: 900 })).toBe(false);
    expect(hasCanvasSizeChanged({ width: 1440, height: 900 }, { width: 1441, height: 900 })).toBe(true);
  });

  it('把地球画布上的纵向手势和普通滚轮换算为 landing scroll 增量', () => {
    expect(getLandingScrollDelta(150, 90)).toBe(60);
    expect(getLandingScrollDelta(90, 150)).toBe(-60);
    expect(getLandingWheelDelta(3, 1, 900)).toBe(48);
    expect(getLandingWheelDelta(1, 2, 900)).toBe(900);
  });

  it('让鼠标左键保持 Orbit 旋转，并锁定触摸纵滑为阅读滚动', () => {
    expect(getInitialEarthGestureMode('mouse', 0)).toBe('rotate');
    expect(getInitialEarthGestureMode('touch', 0)).toBe('pending');
    expect(shouldForwardLandingScroll('touch', 'scroll')).toBe(true);
    expect(shouldForwardLandingScroll('pen', 'scroll')).toBe(true);
    expect(shouldForwardLandingScroll('mouse', 'scroll')).toBe(false);
    expect(shouldForwardLandingScroll('touch', 'rotate')).toBe(false);
  });

  it('连续触摸纵滑的每一段都累计到 landing scroll，而不是只转发第一段', () => {
    const { container } = render(
      <div className="mapflow-landing">
        <LandingEarthBackground />
      </div>,
    );
    const root = container.querySelector<HTMLElement>('.mapflow-landing');
    const canvas = screen.getByLabelText('可交互地球背景，拖动旋转，按住 Ctrl 使用滚轮缩放');
    if (!root) throw new Error('landing scroll root is missing');
    root.scrollTop = 100;

    const dispatchTouchPointer = (type: 'pointerdown' | 'pointermove', clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
        button: { value: 0 },
        clientX: { value: 100 },
        clientY: { value: clientY },
      });
      canvas.dispatchEvent(event);
    };

    dispatchTouchPointer('pointerdown', 200);
    dispatchTouchPointer('pointermove', 150);
    dispatchTouchPointer('pointermove', 90);
    dispatchTouchPointer('pointermove', 30);

    expect(root.scrollTop).toBe(270);
  });
});
