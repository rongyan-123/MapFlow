import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TreeIntroduction from './TreeIntroduction';
import type { SkillTree } from '../../types/learning';

const tree: SkillTree = {
  id: 'custom-tree-id',
  topic: '数据迁移',
  title: '数据迁移学习地图',
  description: '从结构变化走到安全上线。',
  difficulty_level: 'intermediate',
  total_nodes: 12,
};

describe('TreeIntroduction', () => {
  it('直接展示方向信息，并把开始探索和地图预览分成两个动作', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onStartExploring = vi.fn();
    const onPreviewMap = vi.fn();

    render(
      <TreeIntroduction
        tree={tree}
        onBack={onBack}
        onStartExploring={onStartExploring}
        onPreviewMap={onPreviewMap}
      />,
    );

    expect(screen.getByRole('heading', { name: '数据迁移学习地图' })).toBeInTheDocument();
    expect(screen.getByText('适合谁')).toBeInTheDocument();
    expect(screen.getByText('需要基础')).toBeInTheDocument();
    expect(screen.getByText('已经有一个具体问题，想把它拆成可走路径的人')).toBeInTheDocument();
    expect(screen.getByText('从地图中选择一个节点')).toBeInTheDocument();
    expect(screen.getByText('地图可直接浏览，加入后记录个人进度。')).toBeInTheDocument();
    expect(screen.queryByText('一条可验证的学习路径')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开始探索' }));
    expect(onStartExploring).toHaveBeenCalledWith(expect.stringContaining('数据迁移'));

    await user.click(screen.getByRole('button', { name: '先看地图' }));
    expect(onPreviewMap).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: '返回工作台' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
