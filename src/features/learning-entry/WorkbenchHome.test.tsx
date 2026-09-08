import { render, screen, within } from '@testing-library/react';
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
  total_nodes: 79,
};

const secondTree: SkillTree = {
  id: '9369e054-3c40-4a46-9952-3abbde4195a1',
  topic: 'Python Agent',
  title: 'Python Agent 生产级学习体系',
  description: 'Agent 服务能力路径。',
  difficulty_level: 'intermediate',
  total_nodes: 74,
};

describe('WorkbenchHome', () => {
  it('用紧凑方向卡展示两个真实方向与可点击入口', async () => {
    const user = userEvent.setup();
    const onOpenPublicTree = vi.fn();

    render(
      <WorkbenchHome
        mode="public"
        publicTrees={[publicTree, secondTree]}
        personalEntries={[]}
        onOpenPublicTree={onOpenPublicTree}
        onContinuePersonalTree={vi.fn()}
        onCreateTree={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '选择一个学习方向' })).toBeInTheDocument();
    expect(screen.getByText('NestJS 后端与 AI 应用')).toBeInTheDocument();
    expect(screen.getByText('Python Agent 开发路径')).toBeInTheDocument();
    expect(screen.getByText('79 个知识点')).toBeInTheDocument();
    expect(screen.getByText('74 个知识点')).toBeInTheDocument();
    expect(screen.queryByText(publicTree.title)).not.toBeInTheDocument();

    const directionButtons = screen.getAllByRole('button', { name: /查看 .*简介/ });
    expect(directionButtons).toHaveLength(2);
    await user.click(directionButtons[1]);
    expect(onOpenPublicTree).toHaveBeenCalledWith(secondTree.id);
  });

  it('列出所有个人地图并显示真实的 12/79 与 0/74 进度', async () => {
    const user = userEvent.setup();
    const onContinuePersonalTree = vi.fn();
    const personalEntries: PersonalLibraryEntry[] = [
      {
        library_entry_id: 'entry-1',
        tree: publicTree,
        completed_nodes: 12,
      },
      {
        library_entry_id: 'entry-2',
        tree: secondTree,
        completed_nodes: 0,
      },
    ];

    render(
      <WorkbenchHome
        mode="personal"
        publicTrees={[publicTree, secondTree]}
        personalEntries={personalEntries}
        onOpenPublicTree={vi.fn()}
        onContinuePersonalTree={onContinuePersonalTree}
        onCreateTree={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '我的学习地图' })).toBeInTheDocument();
    expect(screen.getByText('12 / 79 个节点已完成')).toBeInTheDocument();
    expect(screen.getByText('0 / 74 个节点已完成')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuemax', '79');
    expect(screen.getAllByRole('progressbar')[1]).toHaveAttribute('aria-valuenow', '0');

    const continueButtons = screen.getAllByRole('button', { name: /继续探索/ });
    expect(continueButtons).toHaveLength(2);
    await user.click(continueButtons[1]);
    expect(onContinuePersonalTree).toHaveBeenCalledWith('entry-2');
    expect(within(screen.getByTestId('workbench-home')).getByText('Python Agent')).toBeInTheDocument();
  });

  it('个人库未返回时只显示加载状态，不把空库当成已加载', () => {
    render(
      <WorkbenchHome
        mode="personal"
        publicTrees={[publicTree]}
        personalEntries={[]}
        personalLibraryPending
        onOpenPublicTree={vi.fn()}
        onContinuePersonalTree={vi.fn()}
        onCreateTree={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('正在读取学习地图');
    expect(screen.queryByText('还没有自己的学习地图')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '学习方向' })).not.toBeInTheDocument();
  });

  it('总节点数为 0 时仍显示确定的 0/0 进度，不产生无效百分比', () => {
    render(
      <WorkbenchHome
        mode="personal"
        publicTrees={[]}
        personalEntries={[
          {
            library_entry_id: 'empty-entry',
            tree: { ...publicTree, id: 'empty-tree', total_nodes: 0 },
            completed_nodes: 0,
          },
        ]}
        onOpenPublicTree={vi.fn()}
        onContinuePersonalTree={vi.fn()}
        onCreateTree={vi.fn()}
      />,
    );

    expect(screen.getByText('0 / 0 个节点已完成')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });
});
