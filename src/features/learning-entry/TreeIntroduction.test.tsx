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
  it('先说明方向，再把开始探索和先看地图分成两个动作', async () => {
    const user = userEvent.setup();
    const onStartExploring = vi.fn();
    const onPreviewMap = vi.fn();

    render(
      <TreeIntroduction
        tree={tree}
        onBack={vi.fn()}
        onStartExploring={onStartExploring}
        onPreviewMap={onPreviewMap}
      />,
    );

    expect(screen.getByRole('heading', { name: '数据迁移学习地图' })).toBeInTheDocument();
    expect(screen.getAllByText(/我想先弄懂「数据迁移」/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: '了解适合人群与基础要求' })).toBeInTheDocument();
    expect(screen.queryByText('适合谁')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();
    const decorativePathCard = screen
      .getByText('一条可验证的学习路径')
      .closest('div') as HTMLElement;
    expect(decorativePathCard).toHaveClass('hidden', 'lg:block');

    await user.click(screen.getByRole('button', { name: '了解适合人群与基础要求' }));
    expect(screen.getByText('适合谁')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '开始探索' }));
    expect(onStartExploring).toHaveBeenCalledWith(expect.stringContaining('数据迁移'));

    await user.click(screen.getByRole('button', { name: '先看地图' }));
    expect(onPreviewMap).toHaveBeenCalledOnce();
  });
});
