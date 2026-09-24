import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PublicTreeCatalogPanel, filterPublicTrees } from './PublicTreeCatalogPanel';
import type { PublicTreeAttribution } from './types';
import type { SkillTree } from '../../types/learning';

const trees: SkillTree[] = [
  { id: 'official', title: '官方 TypeScript 路线', topic: 'TypeScript', description: null, difficulty_level: 'beginner', total_nodes: 24 },
  { id: 'alice', title: 'Rust 系统进阶', topic: 'Systems', description: null, difficulty_level: 'advanced', total_nodes: 72 },
  { id: 'bob', title: 'Python Agent', topic: 'AI Agent', description: null, difficulty_level: 'intermediate', total_nodes: 45 },
];

const attributions: Record<string, PublicTreeAttribution> = {
  alice: { publisher_display_name: 'Alice', derived_from_public_tree_id: null, root_public_tree_id: null, derived_from_title: null, derived_from_publisher_display_name: null },
  bob: { publisher_display_name: 'Bob', derived_from_public_tree_id: null, root_public_tree_id: null, derived_from_title: null, derived_from_publisher_display_name: null },
};

describe('PublicTreeCatalogPanel', () => {
  it('搜索标题、主题和发布者，并支持来源、难度、节点数组合筛选', () => {
    expect(filterPublicTrees(trees, attributions, { query: 'alice', source: 'all', difficulty: 'all', nodeCount: 'all', sort: 'newest' }).map((tree) => tree.id)).toEqual(['alice']);
    expect(filterPublicTrees(trees, attributions, { query: 'agent', source: 'all', difficulty: 'all', nodeCount: 'all', sort: 'newest' }).map((tree) => tree.id)).toEqual(['bob']);
    expect(filterPublicTrees(trees, attributions, { query: '', source: 'user', difficulty: 'advanced', nodeCount: '61+', sort: 'newest' }).map((tree) => tree.id)).toEqual(['alice']);
    expect(filterPublicTrees(trees, attributions, { query: '', source: 'official', difficulty: 'all', nodeCount: '1-30', sort: 'newest' }).map((tree) => tree.id)).toEqual(['official']);
  });

  it('展示不可选择的热度入口和地图结果摘要', () => {
    render(
      <PublicTreeCatalogPanel
        trees={trees}
        attributions={attributions}
        selectedTreeId={null}
        onSelect={vi.fn()}
        onCollapse={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: '热度（即将上线）' })).toBeDisabled();
    expect(screen.getByText('共 3 张地图')).toBeInTheDocument();
  });

  it('查询启用时持续请求后续目录页，以覆盖完整公共池', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <PublicTreeCatalogPanel
        trees={trees}
        attributions={attributions}
        selectedTreeId={null}
        onSelect={vi.fn()}
        onCollapse={vi.fn()}
        hasNextPage
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: '搜索公共地图' }), '远端地图');
    await waitFor(() => expect(onLoadMore).toHaveBeenCalled());
  });
});
