import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SkillNodeComponent, { type SkillFlowNode } from './SkillNode';

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    Handle: () => React.createElement('div', { 'data-testid': 'handle' }),
    Position: { Top: 'top', Bottom: 'bottom' },
  };
});

function makeFlowNode(displayMode: 'showcase' | 'personal'): SkillFlowNode {
  return {
    id: 'node-1',
    type: 'skill',
    position: { x: 0, y: 0 },
    data: {
      node: {
        id: 'node-1',
        tree_id: 'tree-1',
        title: '测试节点',
        description: null,
        icon: '🐍',
        category: '测试',
        difficulty: 1,
        estimated_minutes: 10,
        depth_level: 1,
        position_x: 0,
        position_y: 0,
        order_in_level: 1,
        learning_objectives: null,
        key_concepts: null,
        recommended_depth: 'Understand',
        depth_rationale: 'test',
        observable_evidence: 'test',
      },
      progress: null,
      isCurrent: false,
      displayMode,
    },
  };
}

function renderNode(displayMode: 'showcase' | 'personal') {
  const node = makeFlowNode(displayMode);
  const props = {
    data: node.data,
    selected: false,
  } as React.ComponentProps<typeof SkillNodeComponent>;
  const { container } = render(<SkillNodeComponent {...props} />);
  return container.firstElementChild as HTMLElement;
}

describe('SkillNode 渲染', () => {
  it('showcase 节点带不透明底色兜底，渐变失效时不至于全黑', () => {
    const node = renderNode('showcase');
    expect(node.className).toContain('bg-cyan-400');
    expect(node.className).toContain('bg-gradient-to-br');
  });

  it('showcase 节点不使用未开始节点的深色样式', () => {
    const node = renderNode('showcase');
    expect(node.className).not.toContain('bg-slate-900/85');
  });
});
