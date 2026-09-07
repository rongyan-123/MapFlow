import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingEarthBackground, { updateCameraProjection } from './LandingEarthBackground';

describe('LandingEarthBackground', () => {
  it('在 WebGL 不可用时保留可辨认的静态 Earth fallback', () => {
    render(<LandingEarthBackground />);

    expect(screen.getByTestId('landing-earth-background')).toHaveAttribute(
      'data-earth-renderer',
      'fallback',
    );
    expect(screen.getByTestId('landing-earth-fallback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置地球视角' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '缩小地球视角' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放大地球视角' })).toBeInTheDocument();
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
});
