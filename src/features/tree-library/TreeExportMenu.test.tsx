import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TreeExportMenu from './TreeExportMenu';
import type { PersonalTreeDetail } from './types';

const detail: PersonalTreeDetail = {
  view_mode: 'personal',
  library_entry_id: 'library-entry-id',
  graph: {
    tree: {
      id: 'tree-id',
      topic: 'Rust',
      title: 'Rust 学习树',
      description: '学习所有权和借用',
      difficulty_level: 'beginner',
      total_nodes: 1,
    },
    nodes: [
      {
        id: 'node-1',
        tree_id: 'tree-id',
        title: '所有权',
        description: null,
        icon: 'book',
        category: '基础',
        difficulty: 2,
        estimated_minutes: 30,
        depth_level: 0,
        position_x: 0,
        position_y: 0,
        order_in_level: 0,
        learning_objectives: null,
        key_concepts: null,
        recommended_depth: 'Understand',
        depth_rationale: '先掌握基础规则。',
        observable_evidence: '能解释所有权。',
      },
    ],
    edges: [],
  },
  completed_node_ids: [],
};

describe('TreeExportMenu', () => {
  it('opens export choices in a viewport dialog instead of an inline menu', async () => {
    const user = userEvent.setup();
    render(<TreeExportMenu detail={detail} />);

    const trigger = screen.getByRole('button', { name: '导出技能树' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger.querySelector('span:last-child')).not.toHaveClass('hidden');
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '导出技能树' });
    expect(dialog.parentElement).toHaveClass('fixed', 'inset-0');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '下载 JSON（完整结构）' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '下载 Markdown（便于阅读）' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '导出技能树' })).not.toBeInTheDocument();
  });

  it('loads the tree detail only after a card export action is opened', async () => {
    const user = userEvent.setup();
    const loadDetail = vi.fn().mockResolvedValue(detail);
    render(
      <TreeExportMenu
        detail={null}
        loadDetail={loadDetail}
        triggerAriaLabel="导出技能树：Rust 学习树"
        compact
      />,
    );

    expect(loadDetail).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: '导出技能树：Rust 学习树' }),
    );

    expect(loadDetail).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('dialog', { name: '导出技能树' }),
    ).toBeInTheDocument();
  });
});
