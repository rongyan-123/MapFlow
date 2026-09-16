import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import McpGuideDialog from './McpGuideDialog';

describe('McpGuideDialog', () => {
  it('uses a light tutorial surface and keeps the unpublished video non-interactive', async () => {
    const user = userEvent.setup();
    render(<McpGuideDialog onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /下一步/ }));
    await user.click(screen.getByRole('button', { name: /下一步/ }));
    await user.click(screen.getByRole('button', { name: /下一步/ }));

    expect(screen.getByTestId('mcp-guide-video-placeholder')).toHaveAttribute(
      'aria-label',
      'Agent 接入视频教程占位',
    );
    expect(screen.getByText('视频教程即将上线')).toBeInTheDocument();
    expect(screen.getByText('当前为占位内容，暂不可播放。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /播放/ })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('bg-[#f7fbf9]');
  });
});
