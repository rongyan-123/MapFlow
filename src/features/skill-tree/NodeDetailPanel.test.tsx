import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NodeDetailPanel from './NodeDetailPanel';
import type { LearningTreeSnapshot } from '../../types/learning';

const snapshot: LearningTreeSnapshot = {
  tree: {
    id: 'tree-1',
    topic: 'NestJS',
    title: 'NestJS 学习树',
    description: null,
    difficulty_level: 'intermediate',
    total_nodes: 1,
  },
  nodes: [
    {
      id: 'node-1',
      tree_id: 'tree-1',
      title: '模块基础',
      description: '理解模块边界。',
      icon: 'box',
      category: '基础',
      difficulty: 1,
      estimated_minutes: 20,
      depth_level: 0,
      position_x: 0,
      position_y: 0,
      order_in_level: 0,
      learning_objectives: null,
      key_concepts: null,
      recommended_depth: 'Understand',
      depth_rationale: '建立基础模型。',
      observable_evidence: '可以解释模块边界。',
    },
  ],
  edges: [],
  current_node_id: null,
  progress: [],
};

describe('NodeDetailPanel 知识聊天入口', () => {
  it('在个人树节点详情中点击聊天入口会通知上层', async () => {
    const user = userEvent.setup();
    const onOpenChat = vi.fn();
    render(
      <NodeDetailPanel
        snapshot={snapshot}
        selectedNodeId="node-1"
        displayMode="personal"
        onOpenChat={onOpenChat}
      />,
    );

    await user.click(screen.getByRole('button', { name: '与这棵树聊天' }));

    expect(onOpenChat).toHaveBeenCalledOnce();
  });

  it('公共示例树和未选中节点不显示聊天入口', () => {
    const { rerender } = render(
      <NodeDetailPanel
        snapshot={snapshot}
        selectedNodeId="node-1"
        displayMode="showcase"
        onOpenChat={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '与这棵树聊天' })).not.toBeInTheDocument();

    rerender(
      <NodeDetailPanel
        snapshot={snapshot}
        selectedNodeId={null}
        displayMode="personal"
        onOpenChat={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '与这棵树聊天' })).not.toBeInTheDocument();
  });
});
