import { describe, expect, it } from 'vitest';
import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
} from '../../types/learning';
import { computeBlockLayout } from './layoutBlocks';

const node = (id: string, depth_level = 0, order_in_level = 0): SkillNode => ({
  id,
  tree_id: 'tree-1',
  title: id,
  description: null,
  icon: 'circle',
  category: 'test',
  difficulty: depth_level,
  estimated_minutes: 10,
  depth_level,
  position_x: 0,
  position_y: 0,
  order_in_level,
  learning_objectives: null,
  key_concepts: null,
  recommended_depth: 'Understand',
  depth_rationale: '',
  observable_evidence: '',
});

const block = (id: string, sort_order: number): SkillBlock => ({
  id,
  name: id,
  color: null,
  sort_order,
});

const assignment = (
  node_id: string,
  block_id: string,
): SkillNodeBlockAssignment => ({ node_id, block_id });

describe('computeBlockLayout', () => {
  it('places each block in a deterministic lane and keeps unassigned nodes visible', () => {
    const nodes = [node('a'), node('b', 1), node('c'), node('unassigned')];
    const edges: SkillEdge[] = [
      {
        id: 'a-b',
        source_node_id: 'a',
        target_node_id: 'b',
        edge_type: 'prerequisite',
        label: null,
      },
    ];
    const positions = computeBlockLayout(
      nodes,
      edges,
      [block('second', 2), block('first', 1)],
      [assignment('a', 'first'), assignment('b', 'first'), assignment('c', 'second')],
    );

    expect(positions.get('a')).toEqual({ x: 0, y: 0 });
    expect(positions.get('b')).toEqual({ x: 0, y: 136 });
    expect(positions.get('c')?.x).toBeGreaterThan(0);
    expect(positions.get('unassigned')?.x).toBeGreaterThan(
      positions.get('c')!.x,
    );
  });

  it('returns no layout when there are no valid block assignments', () => {
    const positions = computeBlockLayout(
      [node('a')],
      [],
      [block('first', 1)],
      [],
    );

    expect(positions.size).toBe(0);
  });

  it('keeps same-level nodes separated by the rendered card width', () => {
    const positions = computeBlockLayout(
      [node('a'), node('b')],
      [],
      [block('first', 1)],
      [assignment('a', 'first'), assignment('b', 'first')],
    );

    expect(Math.abs(positions.get('a')!.x - positions.get('b')!.x)).toBeGreaterThanOrEqual(
      280,
    );
  });
});
