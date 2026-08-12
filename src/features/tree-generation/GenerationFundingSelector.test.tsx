import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GenerationFundingSelector from './GenerationFundingSelector';

afterEach(() => cleanup());

describe('GenerationFundingSelector', () => {
  it('shows the server balance and switches between platform and BYOK modes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GenerationFundingSelector
        value="platform"
        platformEntitlements={entitlements(3)}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('平台免费体验 · 剩余 3 次')).toBeInTheDocument();
    expect(screen.getByText('使用自己的 API Key')).toBeInTheDocument();
    expect(screen.getByText('使用你自己的 DeepSeek 余额')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择使用自己的 API Key' }));
    expect(onChange).toHaveBeenCalledWith('byok');
  });

  it('disables platform mode when the server says it is unavailable', () => {
    render(
      <GenerationFundingSelector
        value="byok"
        platformEntitlements={{
          ...entitlements(0),
          platformModeAvailable: false,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '选择平台免费体验' })).toBeDisabled();
  });
});

function entitlements(available: number) {
  return {
    totalGranted: available,
    available,
    reserved: 0,
    consumed: 0,
    activePlatformSessionId: null,
    platformModeAvailable: available > 0,
  };
}
