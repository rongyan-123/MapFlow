import { describe, expect, it } from 'vitest';
import type { SkillEdge, SkillNode } from '../../types/learning';
import { computeTreeLayout } from './layoutTree';

const makeNode = (
  id: string,
  depth_level: number,
  order_in_level: number,
  position_x = 0,
  position_y = 0,
): SkillNode => ({
  id,
  tree_id: 'tree-1',
  title: id,
  description: null,
  icon: 'circle',
  category: 'test',
  difficulty: depth_level,
  estimated_minutes: 10,
  depth_level,
  position_x,
  position_y,
  order_in_level,
  learning_objectives: null,
  key_concepts: null,
  recommended_depth: 'Understand',
  depth_rationale: '',
  observable_evidence: '',
});

describe('computeTreeLayout', () => {
  it('ignores Agent coordinates and within-level ordering', () => {
    const edges: SkillEdge[] = [
      {
        id: 'root-child',
        source_node_id: 'root',
        target_node_id: 'child',
        edge_type: 'prerequisite',
        label: null,
      },
    ];
    const original = [
      makeNode('root', 0, 0),
      makeNode('sibling', 0, 1),
      makeNode('child', 1, 0),
    ];
    const agentRepositioned = original.map((node) => ({
      ...node,
      order_in_level: 99 - node.order_in_level,
      position_x: 999_999,
      position_y: -999_999,
    }));

    expect(computeTreeLayout(agentRepositioned, edges)).toEqual(
      computeTreeLayout(original, edges),
    );
  });
});
