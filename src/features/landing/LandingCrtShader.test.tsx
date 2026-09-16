import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LandingCrtShader, {
  CRT_FRAGMENT_SHADER,
  getCrtEffectParameters,
  getCrtTitleLines,
} from './LandingCrtShader';

const OPENING_TITLE = '学习——什么时候变得如此困难？';

describe('LandingCrtShader', () => {
  it('在 WebGL 不可用时保留语义标题的静态 fallback canvas', () => {
    render(
      <div>
        <h2>{OPENING_TITLE}</h2>
        <LandingCrtShader text={OPENING_TITLE} />
      </div>,
    );

    expect(screen.getByTestId('landing-crt-shader')).toHaveAttribute(
      'data-crt-renderer',
      'fallback',
    );
    expect(screen.getByText(OPENING_TITLE)).toBeInTheDocument();
  });

  it('把开场滚动进度映射为可逆的 CRT 到清晰过渡', () => {
    expect(getCrtEffectParameters(0)).toEqual({
      barrel: 0.18,
      channelOffset: 0.0045,
      intensity: 0.38,
    });
    expect(getCrtEffectParameters(1)).toEqual({
      barrel: 0,
      channelOffset: 0,
      intensity: 0,
    });
  });

  it('对标题纹理执行非线性采样，并叠加桶形失真和扫描线', () => {
    expect(CRT_FRAGMENT_SHADER).toContain('uniform sampler2D uSource');
    expect(CRT_FRAGMENT_SHADER).toContain('texture2D(uSource');
    expect(CRT_FRAGMENT_SHADER).toContain('uBarrel');
    expect(CRT_FRAGMENT_SHADER).toContain('scanline');
    expect(CRT_FRAGMENT_SHADER).toContain('radius * radius');
  });

  it('桌面标题容器足够宽时保持整句单行', () => {
    const lines = getCrtTitleLines(OPENING_TITLE, 1400, (value) => value.length * 40);

    expect(lines).toEqual([OPENING_TITLE]);
  });

  it('移动端先在学习引导语后换行，且不会拆开什么时候', () => {
    const lines = getCrtTitleLines(OPENING_TITLE, 320, (value) => value.length * 40);

    expect(lines[0]).toBe('学习——');
    expect(lines.join('')).toBe(OPENING_TITLE);
    expect(lines.some((line) => line.includes('什么时候'))).toBe(true);
  });
});
