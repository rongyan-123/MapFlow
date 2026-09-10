import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('用直接的学习痛点说明 MapFlow，并提供可操作的 3D 技能树入口', async () => {
    render(
      <LandingPage
        session={null}
        onEnterConsole={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: '学习——什么时候变得如此困难？',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/学习正在被异化成刷课、背题、追赶要求/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('product-landing')).toHaveClass('h-full');
    expect(screen.getByTestId('landing-hero-grid')).toHaveClass('grid-cols-1', 'min-w-0');
    expect(screen.getByTestId('landing-hero-copy')).toHaveClass('w-full', 'min-w-0');
    expect(screen.getByTestId('landing-story')).toBeInTheDocument();
    expect(screen.getByTestId('landing-story')).toHaveClass('overflow-clip');
    expect(screen.getByTestId('landing-story-path')).toHaveAttribute('pathLength', '1');
    expect(screen.getAllByTestId(/^landing-story-chapter-/)).toHaveLength(4);
    expect(await screen.findByTestId('skill-tree-3d')).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'button',
        { name: '重置技能树视角' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('旋转、拖动，找到你真正想学的那个节点。')).toBeInTheDocument();
  });

  it('从首页打开 Agent 接入教程并展示真实的 npx 配置方式', async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });

    render(
      <LandingPage
        session={null}
        onEnterConsole={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: '如何在自己的 Agent 里连接 MapFlow' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: '在自己的 Agent 中连接 MapFlow',
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByTestId('mcp-guide-install-command')).toHaveTextContent(
      'npx @mapflow-publish/mcp',
    );
    expect(
      within(dialog).getByRole('heading', { name: '如果你使用 Claude Code' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/浏览器会打开 MapFlow 授权页/)).toBeInTheDocument();
    expect(within(dialog).getByText('mapflow.get_progress')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: '复制 npx 安装命令' }),
    );
    expect(clipboardWrite).toHaveBeenCalledWith('npx @mapflow-publish/mcp');
    expect(within(dialog).getByText('已复制')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: '关闭 Agent 接入教程' }),
    );
    expect(
      screen.queryByRole('dialog', { name: '在自己的 Agent 中连接 MapFlow' }),
    ).not.toBeInTheDocument();
  });
});
