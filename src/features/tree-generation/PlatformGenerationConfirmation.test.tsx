import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlatformGenerationConfirmation, {
  PLATFORM_GENERATION_WARNING,
} from './PlatformGenerationConfirmation';

afterEach(() => cleanup());

describe('PlatformGenerationConfirmation', () => {
  it('shows the exact start warning and keeps cancellation side-effect free', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PlatformGenerationConfirmation
        kind="start"
        pending={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: '确认消耗 1 次生成次数？' }),
    ).toBeInTheDocument();
    expect(screen.getByText(PLATFORM_GENERATION_WARNING)).toBeInTheDocument();
    expect(
      screen.getByText(
        '请再次确认学习主题、职业方向、学习目标和当前基础均已填写完整。继续后将消耗 1 次平台生成次数；若中途主动放弃，次数不返还。若因 DeepSeek 或服务器故障最终未生成成功，次数会自动返还。',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回检查' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('starts only from the explicit confirmation action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PlatformGenerationConfirmation
        kind="start"
        pending={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: '确认并开始' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses a separate irreversible-abandonment confirmation', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PlatformGenerationConfirmation
        kind="abandon"
        pending={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: '确认放弃平台生成' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/中途主动放弃将不返还/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认放弃且不返还' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
