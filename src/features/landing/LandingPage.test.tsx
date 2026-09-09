import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

vi.mock('./LandingPublicMapDemo', () => ({
  default: () => <div data-testid="landing-public-map-demo" />,
}));

describe('LandingPage', () => {
  it('用持续的 Earth 背景和五个独立场景表达产品价值', async () => {
    const onEnterConsole = vi.fn();
    render(
      <LandingPage
        session={null}
        onEnterConsole={onEnterConsole}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '学习——什么时候变得如此困难？' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '学了这么多，我到底学会了什么？' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '想进入一个领域，却不知道到底该学什么？' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '让每次理解，都丰富自己的地图。' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '学到了哪里，打开地图就知道。' })).toBeInTheDocument();
    expect(screen.getByText('看清学习与就业方向，建立自己的知识地图，随时查看学习进度。')).toBeInTheDocument();
    expect(screen.getByText('这是 MapFlow 想帮你做的事。')).toBeInTheDocument();
    expect(screen.getByText('把刚才讨论的数据库迁移，整理进我的地图')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入工作台' })).toBeInTheDocument();
    expect(screen.getByTestId('landing-earth-background')).toBeInTheDocument();
    expect(screen.getByTestId('landing-crt-shader')).toBeInTheDocument();
    expect(screen.getByTestId('landing-earth-background')).toHaveAttribute('data-earth-revealed', 'false');
    expect(screen.queryByRole('button', { name: '重置地球视角' })).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-opening-viewport')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^landing-story-scene-/)).toHaveLength(5);
    expect(screen.getByTestId('landing-story-media-stage')).toBeInTheDocument();
    expect(screen.getByTestId('landing-story-media-clarity')).toBeInTheDocument();
    expect(screen.getByTestId('landing-story-media-domain')).toBeInTheDocument();
    expect(screen.getByTestId('landing-story-media-clarity').querySelector('img')).toHaveAttribute(
      'src',
      '/landing/course-overload.webp',
    );
    expect(screen.getByTestId('landing-story-media-domain').querySelector('img')).toHaveAttribute(
      'src',
      '/landing/direction-crossroads.webp',
    );
    expect(screen.getByTestId('landing-story-mobile-media-clarity')).toBeInTheDocument();
    expect(screen.getByTestId('landing-story-mobile-media-domain')).toBeInTheDocument();
    expect(screen.getByTestId('landing-public-map-demo')).toBeInTheDocument();
    expect(screen.getByTestId('landing-jelly-cta')).toBeInTheDocument();
    expect(screen.getByText('指引方向')).toBeInTheDocument();
    expect(screen.getByText('学习地图')).toBeInTheDocument();
    expect(screen.getByText('任何地方皆可用')).toBeInTheDocument();
    expect(screen.queryByText('前置关系', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('A MAP FOR THE THINGS YOU WANT TO UNDERSTAND')).not.toBeInTheDocument();
    expect(screen.queryByText('YOU ARE HERE')).not.toBeInTheDocument();
    expect(screen.queryByText('MAPFLOW / LEARNING MAP')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '怎么开始' })).not.toBeInTheDocument();
    expect(screen.queryByText('把你想懂的东西，展开成一张地图。')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: '进入工作台' }));
    expect(onEnterConsole).toHaveBeenCalledTimes(1);
  });

  it('让 opening 独立退出，再让 B 到 E 与媒体舞台共用滚动布局', () => {
    render(
      <LandingPage
        session={null}
        onEnterConsole={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    const story = screen.getByTestId('landing-story');
    const layout = story.querySelector('.mapflow-story__layout');

    expect(layout).not.toBeNull();
    expect(layout?.querySelector('[data-scene-id="opening"]')).toBeNull();
    expect(layout?.querySelector('[data-scene-id="clarity"]')).not.toBeNull();
    expect(layout?.querySelector('[data-scene-id="domain"]')).not.toBeNull();
    expect(layout?.querySelector('[data-scene-id="mcp"]')).toBeNull();
    expect(story.querySelector('.mapflow-story__opening [data-scene-id="opening"]')).not.toBeNull();
    expect(story.querySelector('.mapflow-story__independent-scenes [data-scene-id="mcp"]')).not.toBeNull();
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
    expect(within(dialog).getByRole('button', { name: 'Claude Code' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(within(dialog).getByTestId('mcp-guide-install-command')).toHaveValue(
      'codex mcp add mapflow -- npx -y @mapflow-publish/mcp',
    );

    await user.click(
      within(dialog).getByRole('button', { name: '复制 Codex 注册命令' }),
    );
    expect(clipboardWrite).toHaveBeenCalledWith(
      'codex mcp add mapflow -- npx -y @mapflow-publish/mcp',
    );
    expect(within(dialog).getByText('已复制')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(within(dialog).getByText(/浏览器会打开 MapFlow 授权页/)).toBeInTheDocument();
    expect(within(dialog).getAllByText('mapflow.get_progress')).not.toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(
      within(dialog).getByRole('heading', { name: '安装 Skill，从当前项目建立地图' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByDisplayValue(
        'npx skills add https://github.com/rongyan-123/MapFlow/tree/017b5f96111fa73297e7603645681a7e7f4dc411/skills/mapflow --skill mapflow --agent codex',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(/根据当前项目建立我的学习地图/)).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: '完成' }),
    );
    expect(
      screen.queryByRole('dialog', { name: '在自己的 Agent 中连接 MapFlow' }),
    ).not.toBeInTheDocument();
  });
});
