import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WorkbenchHome from './WorkbenchHome';
import type { PersonalLibraryEntry } from '../tree-library/types';
import type { SkillTree } from '../../types/learning';

const publicTree: SkillTree = {
  id: '005d217e-2106-4a8f-ab84-769d48f52c08',
  topic: 'NestJS',
  title: 'NestJS 生产级完整学习体系',
  description: '服务端能力路径。',
  difficulty_level: 'advanced',
  total_nodes: 20,
};

describe('WorkbenchHome', () => {
  it('工作台初始展示方向卡和真实个人进度，不渲染地图画布', async () => {
    const user = userEvent.setup();
    const onOpenPublicTree = vi.fn();
    const onContinuePersonalTree = vi.fn();
    const personalEntry: PersonalLibraryEntry = {
      library_entry_id: 'entry-1',
      tree: publicTree,
      completed_nodes: 3,
    };

    render(
      <WorkbenchHome
        mode="public"
        publicTrees={[publicTree]}
        personalEntries={[personalEntry]}
        onOpenPublicTree={onOpenPublicTree}
        onContinuePersonalTree={onContinuePersonalTree}
        onCreateTree={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '今天想弄懂什么？' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NestJS 后端与 AI 应用' })).toBeInTheDocument();
    expect(screen.queryByText('NestJS 生产级完整学习体系')).not.toBeInTheDocument();
    expect(screen.getByText('3 / 20 个节点已完成')).toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-boundary')).not.toBeInTheDocument();

    await user.click(screen.getByText('看看这个方向'));
    expect(onOpenPublicTree).toHaveBeenCalledWith(publicTree.id);
  });
});
