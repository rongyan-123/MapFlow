import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('用清晰问题入口和轻量学习地图表达产品价值', () => {
    render(
      <LandingPage
        session={null}
        onEnterConsole={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: '把你想懂的东西，展开成一张地图。',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('选一个好奇的问题，看看自己能走到哪里。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '试着探索一下' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByTestId('landing-map-illustration')).toBeInTheDocument();
    expect(screen.getByText('示意地图')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('HTTP 请求')).toBeInTheDocument();
    expect(screen.getByText('模型调用')).toBeInTheDocument();
    expect(screen.getByText('工具调用')).toBeInTheDocument();
    expect(screen.queryByText('不用先选课程，也不用一次学完整套。先从一个具体问题落脚。')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^landing-story-chapter-/)).toHaveLength(2);
    expect(screen.queryByTestId('skill-tree-3d')).not.toBeInTheDocument();
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
