import { describe, expect, it } from 'vitest';
import type { SkillEdge, SkillNode } from '../../types/learning';
import { computeTreeLayout } from './layoutTree';
import { analyzeDependencies } from './dependencies';
import { getNodeReadiness } from './nodeReadiness';

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
  it('preserves legacy support ordering without turning support into a learning prerequisite', () => {
    const nodes = [makeNode('foundation', 0, 0), makeNode('advanced', 18, 0)];
    const edges: SkillEdge[] = [{ id: 'support', source_node_id: 'foundation', target_node_id: 'advanced', edge_type: 'requires', label: '支撑能力' }];
    const original = structuredClone(edges);
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.get('advanced')!.y).toBeGreaterThan(positions.get('foundation')!.y);
    expect(getNodeReadiness(nodes.map(node => node.id), edges, []).get('advanced')).toBe(true);
    expect(analyzeDependencies(nodes.map(node => node.id), edges).ambiguousEdges).toEqual(['support']);
    expect(edges).toEqual(original);
  });

  it('keeps explicit prerequisites ahead of conflicting legacy cycles and still places the legacy tail', () => {
    const nodes = ['a', 'b', 'c', 'independent'].map(id => makeNode(id, 0, 0));
    const edges = [
      { id: 'hard', source_node_id: 'a', target_node_id: 'b', edge_type: 'prerequisite', label: null },
      { id: 'back', source_node_id: 'b', target_node_id: 'a', edge_type: 'requires', label: null },
      { id: 'tail', source_node_id: 'b', target_node_id: 'c', edge_type: 'requires', label: null },
    ];
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.get('a')!.y).toBe(positions.get('independent')!.y);
    expect(positions.get('b')!.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('c')!.y).toBeGreaterThan(positions.get('b')!.y);
    expect(computeTreeLayout([...nodes].reverse(), [...edges].reverse())).toEqual(positions);
  });

  it('does not let a legacy relation pull a healthy node into an unresolved prerequisite cycle', () => {
    const nodes = ['a', 'b', 'tail', 'healthy'].map(id => makeNode(id, 0, 0));
    const edges = [
      ['a', 'b', 'prerequisite'], ['b', 'a', 'prerequisite'], ['b', 'tail', 'prerequisite'], ['tail', 'healthy', 'requires'],
    ].map(([source, target, type]) => ({ id: source + target, source_node_id: source, target_node_id: target, edge_type: type, label: null }));
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.get('healthy')!.y).toBe(0);
    for (const id of ['a', 'b', 'tail']) expect(positions.get(id)!.y).toBeGreaterThan(positions.get('healthy')!.y);
  });

  it('lays out a legacy-only cycle deterministically while preserving its original relations for review', () => {
    const nodes = ['a', 'b', 'c', 'independent'].map(id => makeNode(id, 0, 0));
    const edges = [['a', 'b'], ['b', 'c'], ['c', 'a']].map(([source, target]) => ({
      id: source + target, source_node_id: source, target_node_id: target, edge_type: 'requires', label: null,
    }));
    const original = structuredClone(edges);
    const positions = computeTreeLayout(nodes, edges);
    expect(positions.get('a')!.y).toBe(positions.get('independent')!.y);
    expect(positions.get('b')!.y).toBeGreaterThan(positions.get('a')!.y);
    expect(positions.get('c')!.y).toBeGreaterThan(positions.get('b')!.y);
    expect(computeTreeLayout([...nodes].reverse(), [...edges].reverse())).toEqual(positions);
    expect(analyzeDependencies(nodes.map(node => node.id), edges).ambiguousEdges).toHaveLength(3);
    expect(edges).toEqual(original);
  });

  it('keeps every truly independent root on the same layer without imposing a column limit', () => {
    const nodes = Array.from({ length: 17 }, (_, index) => makeNode(`root-${index}`, index, index));
    const positions = computeTreeLayout(nodes, []);
    expect([...positions.values()].map(position => position.y)).toEqual(Array(17).fill(0));
    expect(new Set([...positions.values()].map(position => position.x)).size).toBe(17);
  });

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
