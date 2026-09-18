import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import McpGuideDialog from './McpGuideDialog';

describe('McpGuideDialog 文档导航', () => {
  it('按一级主题分组展示二级栏目，并切换右侧内容', async () => {
    const user = userEvent.setup();
    render(<McpGuideDialog onClose={vi.fn()} />);

    expect(screen.getByTestId('mcp-guide-group-understand')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-guide-group-connect')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-guide-group-manage')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-guide-group-account')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '快速开始' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '管理学习进度' }));

    expect(screen.getByRole('heading', { name: '管理学习进度' })).toBeInTheDocument();
    expect(screen.getByText(/本地 Agent 可以直接修改地图内容和节点进度/)).toBeInTheDocument();
  });

  it('支持从个人引导直接打开指定的进度章节', () => {
    render(
      <McpGuideDialog
        initialSectionId="manage-progress"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '管理学习进度' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '管理学习进度' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
