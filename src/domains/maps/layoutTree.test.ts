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

  it('does not promote a cycle or its downstream nodes to a normal root row', () => {
    const nodes = ['root', 'a', 'b', 'tail'].map(id => makeNode(id, 0, 0));
    const edges = [['a', 'b'], ['b', 'a'], ['b', 'tail']].map(([source, target]) => ({
      id: `${source}-${target}`, source_node_id: source, target_node_id: target, edge_type: 'prerequisite', label: null,
    }));
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.size).toBe(4);
    for (const id of ['a', 'b', 'tail']) expect(positions.get(id)!.y).toBeGreaterThan(positions.get('root')!.y);
  });

  it('keeps a legal dependency chain when a related edge points backwards', () => {
    const nodes = ['a', 'b', 'c'].map(id => makeNode(id, 0, 0));
    const edges = [['a', 'b', 'prerequisite'], ['b', 'c', 'prerequisite'], ['c', 'a', 'related']].map(([source, target, type]) => ({
      id: `${source}-${target}`, source_node_id: source, target_node_id: target, edge_type: type, label: null,
    }));
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.get('b')!.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('c')!.y).toBeGreaterThan(positions.get('b')!.y);
  });

  it('keeps all nodes visible when a legacy edge references a missing node', () => {
    const nodes = [makeNode('a', 0, 0)];
    expect(() => computeTreeLayout(nodes, [{ id: 'broken', source_node_id: 'missing', target_node_id: 'a', edge_type: 'prerequisite', label: null }])).not.toThrow();
    expect(computeTreeLayout(nodes, []).size).toBe(1);
  });
});
