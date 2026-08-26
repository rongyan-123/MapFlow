import { describe, expect, it, vi } from 'vitest';
import {
  buildTreeExportJson,
  buildTreeExportMarkdown,
  downloadTreeExport,
} from './treeExport';
import type { PersonalTreeDetail } from './types';

const detail: PersonalTreeDetail = {
  view_mode: 'personal',
  library_entry_id: 'private-entry-id',
  graph: {
    tree: {
      id: 'tree-id',
      topic: 'Rust',
      title: 'Rust 学习树',
      description: '学习所有权和借用',
      difficulty_level: 'beginner',
      total_nodes: 2,
    },
    nodes: [
      {
        id: 'node-1',
        tree_id: 'tree-id',
        title: '所有权',
        description: '资源只有一个所有者。',
        icon: 'book',
        category: '基础',
        difficulty: 2,
        estimated_minutes: 30,
        depth_level: 0,
        position_x: 0,
        position_y: 0,
        order_in_level: 0,
        learning_objectives: '["解释所有权"]',
        key_concepts: '["move"]',
        recommended_depth: 'Understand',
        depth_rationale: '先掌握基础规则。',
        observable_evidence: '能解释 move。',
      },
      {
        id: 'node-2',
        tree_id: 'tree-id',
        title: '借用',
        description: null,
        icon: 'link',
        category: '基础',
        difficulty: 3,
        estimated_minutes: 45,
        depth_level: 1,
        position_x: 0,
        position_y: 100,
        order_in_level: 0,
        learning_objectives: null,
        key_concepts: null,
        recommended_depth: 'Use',
        depth_rationale: '在代码中使用借用。',
        observable_evidence: '能写出借用示例。',
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source_node_id: 'node-1',
        target_node_id: 'node-2',
        edge_type: 'prerequisite',
        label: '前置知识',
      },
    ],
  },
  completed_node_ids: ['node-1'],
};

describe('tree export', () => {
  it('exports only tree graph and learning progress, never account or platform data', () => {
    const exported = buildTreeExportJson(detail);

    expect(exported).toEqual({
      format_version: 1,
      tree: detail.graph.tree,
      nodes: detail.graph.nodes,
      edges: detail.graph.edges,
      completedNodeIds: ['node-1'],
      progress: { completed: 1, total: 2 },
    });
    expect(JSON.stringify(exported)).not.toContain('private-entry-id');
    expect(JSON.stringify(exported)).not.toContain('apiKey');
  });

  it('builds readable markdown with progress checkboxes and relationships', () => {
    const markdown = buildTreeExportMarkdown(detail);

    expect(markdown).toContain('# Rust 学习树');
    expect(markdown).toContain('进度：1/2');
    expect(markdown).toContain('- [x] 所有权');
    expect(markdown).toContain('- [ ] 借用');
    expect(markdown).toContain('所有权 → 借用（前置知识）');
    expect(markdown).not.toContain('private-entry-id');
  });

  it('keeps the object URL alive until the browser has had time to start the download', () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.fn(() => 'blob:test-tree-export');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    try {
      downloadTreeExport(detail, 'markdown');

      const anchor = document.querySelector(
        'a[download="Rust 学习树.md"]',
      );
      expect(anchor).not.toBeNull();
      expect(anchor?.parentElement).toBe(document.body);
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectUrl).not.toHaveBeenCalled();

      vi.advanceTimersByTime(999);
      expect(anchor?.isConnected).toBe(true);
      expect(revokeObjectUrl).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(anchor?.isConnected).toBe(false);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-tree-export');
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      document.body.replaceChildren();
    }
  });
});
