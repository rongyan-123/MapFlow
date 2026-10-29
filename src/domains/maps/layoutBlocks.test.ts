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
  it('preserves internal dependencies and keeps independent roots on the same layer', () => {
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

    expect(positions.get('b')?.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('c')?.y).toBe(positions.get('a')!.y);
    expect(positions.get('unassigned')?.y).toBe(
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
    expect(model.lanes[1].x).toBeGreaterThan(model.lanes[0].x);
    expect(model.lanes[2].x).toBeGreaterThan(model.lanes[1].x);
  });

  it('orders cross-block prerequisites regardless of the display order of blocks', () => {
    const edges = [['a','b'],['b','c']].map(([source,target]) => ({id:source+target,source_node_id:source,target_node_id:target,edge_type:'prerequisite',label:null}));
    const positions=computeBlockLayout([node('a'),node('b'),node('c')],edges,[block('first',0),block('second',1)],[assignment('a','second'),assignment('b','first'),assignment('c','second')]);
    expect(positions.get('b')!.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('c')!.y).toBeGreaterThan(positions.get('b')!.y);
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
