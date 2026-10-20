import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import McpGuideDialog from './AgentGuideDialog';

describe('McpGuideDialog 文档导航', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('手机正文默认独占空间，从目录抽屉选择章节后返回正文', async () => {
    vi.stubGlobal('innerWidth', 390);
    const user = userEvent.setup();
    render(<McpGuideDialog onClose={vi.fn()} />);

    expect(screen.queryByRole('navigation', { name: '接入教程目录' })).not.toBeInTheDocument();
    const openDirectory = screen.getByRole('button', { name: '打开教程目录' });
    expect(openDirectory).toHaveAttribute('aria-expanded', 'false');
    await user.click(openDirectory);

    const drawer = within(screen.getByRole('dialog', { name: '教程目录' }));
    expect(openDirectory).toHaveAttribute('aria-expanded', 'true');
    expect(drawer.getByRole('button', { name: '快速开始' })).toHaveAttribute('aria-current', 'page');
    await user.click(drawer.getByRole('button', { name: '配置 MCP' }));

    expect(screen.queryByRole('dialog', { name: '教程目录' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '配置 MCP' })).toBeInTheDocument();
    expect(openDirectory).toHaveAttribute('aria-expanded', 'false');
    expect(openDirectory).toHaveFocus();
    await user.click(openDirectory);
    expect(within(screen.getByRole('dialog', { name: '教程目录' })).getByRole('button', { name: '配置 MCP' })).toHaveAttribute('aria-current', 'page');
  });

  it('手机目录内循环键盘焦点，Esc 或遮罩只关闭目录并保留原章节', async () => {
    vi.stubGlobal('innerWidth', 390);
    const user = userEvent.setup();
    const closeGuide = vi.fn();
    render(<McpGuideDialog initialSectionId="manage-progress" onClose={closeGuide} />);
    const openDirectory = screen.getByRole('button', { name: '打开教程目录' });
    await user.click(openDirectory);

    const drawer = within(screen.getByRole('dialog', { name: '教程目录' }));
    drawer.getByRole('button', { name: '常见问题' }).focus();
    await user.tab();
    expect(drawer.getByRole('button', { name: '关闭' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(closeGuide).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '教程目录' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '管理学习进度' })).toBeInTheDocument();
    expect(openDirectory).toHaveFocus();
    await user.click(openDirectory);
    fireEvent.mouseDown(screen.getByRole('dialog', { name: '教程目录' }).parentElement!);
    expect(closeGuide).not.toHaveBeenCalled();
    expect(openDirectory).toHaveFocus();
  });

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
