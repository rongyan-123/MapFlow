import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LandingCrtShader, { getCrtEffectParameters } from './LandingCrtShader';

describe('LandingCrtShader', () => {
  it('在 WebGL 不可用时保留语义标题的静态 fallback canvas', () => {
    render(
      <div>
        <h2>学习——什么时候变得如此困难？</h2>
        <LandingCrtShader text="学习——什么时候变得如此困难？" />
      </div>,
    );

    expect(screen.getByTestId('landing-crt-shader')).toHaveAttribute(
      'data-crt-renderer',
      'fallback',
    );
    expect(screen.getByText('学习——什么时候变得如此困难？')).toBeInTheDocument();
  });

  it('把开场滚动进度映射为可逆的 CRT 到清晰过渡', () => {
    expect(getCrtEffectParameters(0)).toEqual({
      barrel: 0.12,
      channelOffset: 0.0028,
      intensity: 0.24,
    });
    expect(getCrtEffectParameters(1)).toEqual({
      barrel: 0,
      channelOffset: 0,
      intensity: 0,
    });
  });
});
