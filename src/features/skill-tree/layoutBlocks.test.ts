import { describe, expect, it } from 'vitest';
import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
} from '../../types/learning';
import { computeBlockLayout, computeBlockLayoutModel } from './layoutBlocks';

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
  it('stacks blocks vertically and keeps nodes in each block on one horizontal row', () => {
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

    expect(positions.get('a')?.y).toBe(positions.get('b')?.y);
    expect(positions.get('b')?.x).toBeGreaterThan(positions.get('a')!.x);
    expect(positions.get('c')?.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('unassigned')?.y).toBeGreaterThan(
      positions.get('c')!.y,
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

  it('returns one lane per active block in block sort order', () => {
    const model = computeBlockLayoutModel(
      [node('a'), node('b'), node('unassigned')],
      [],
      [block('second', 2), block('first', 1)],
      [assignment('a', 'first'), assignment('b', 'second')],
    );

    expect(model.lanes.map((lane) => lane.name)).toEqual([
      'first',
      'second',
      '未分组节点',
    ]);
    expect(model.lanes[0].y).toBe(0);
    expect(model.lanes[1].y).toBeGreaterThan(model.lanes[0].y);
    expect(model.lanes[2].y).toBeGreaterThan(model.lanes[1].y);
  });

  it('keeps same-level nodes separated by the rendered card width', () => {
    const positions = computeBlockLayout(
      [node('a'), node('b')],
      [],
      [block('first', 1)],
      [assignment('a', 'first'), assignment('b', 'first')],
    );

    expect(Math.abs(positions.get('a')!.x - positions.get('b')!.x)).toBeGreaterThanOrEqual(
      200,
    );
  });
});
