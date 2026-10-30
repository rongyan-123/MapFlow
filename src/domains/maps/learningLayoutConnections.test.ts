import { expect, it } from 'vitest';
import type { SkillEdge, SkillNode } from '../../types/learning';
import { analyzeDependencies } from './dependencies';
import { computeTreeLayout } from './layoutTree';
import { buildBlockConnections } from './blockConnections';

it('simplifies connections on the prerequisite layout without moving independent roots or losing selected relations', () => {
  const ids = [...Array.from({ length: 13 }, (_, index) => `root-${String(index).padStart(2, '0')}`), 'goal', 'end'];
  const nodes = ids.map(id => ({ id }) as SkillNode);
  const edge = (id: string, source: string, target: string, type: string): SkillEdge => ({ id, source_node_id: source, target_node_id: target, edge_type: type, label: null });
  const edges = [
    edge('a-left', 'root-00', 'goal', 'prerequisite'),
    edge('b-right', 'root-12', 'goal', 'prerequisite'),
    edge('near-association', 'root-06', 'goal', 'related'),
    edge('next', 'goal', 'end', 'prerequisite'),
    edge('legacy', 'root-00', 'root-01', 'requires'),
    edge('support', 'end', 'root-07', 'supports'),
  ];
  const original = structuredClone(edges);
  const positions = computeTreeLayout(nodes, edges);
  const originalPositions = [...positions];
  const visible = buildBlockConnections(edges, null, 'relationship', undefined, new Set(['root-00']), positions);
  expect(visible.map(connection => connection.id)).toEqual(['a-left', 'next', 'legacy', 'support']);
  const focused = buildBlockConnections(edges, 'goal', 'relationship', undefined, new Set(['root-00']), positions);
  expect(focused.map(connection => connection.id)).toEqual(edges.map(connection => connection.id));
  expect(focused.find(connection => connection.id === 'near-association')?.data?.relation).toBe('neutral');
  for (const connection of visible) {
    const selected = focused.find(candidate => candidate.id === connection.id)!;
    expect([selected.data?.lane, selected.data?.sourcePort, selected.data?.targetPort, selected.data?.sourceLit, selected.data?.targetLit])
      .toEqual([connection.data?.lane, connection.data?.sourcePort, connection.data?.targetPort, connection.data?.sourceLit, connection.data?.targetLit]);
  }
  expect(visible.find(connection => connection.id === 'a-left')?.data?.sourcePort)
    .not.toEqual(visible.find(connection => connection.id === 'legacy')?.data?.sourcePort);
  expect(ids.slice(0, 13).map(id => positions.get(id)?.y)).toEqual(Array(13).fill(0));
  expect(positions.get('goal')?.y).toBe(168);
  expect(positions.get('end')?.y).toBe(336);
  expect([...positions]).toEqual(originalPositions);
  expect(edges).toEqual(original);
  expect(analyzeDependencies(ids, edges).ambiguousEdges).toEqual(['legacy']);
  expect(buildBlockConnections(edges, null, 'blocks', undefined, undefined, positions)).toEqual([]);
  expect(buildBlockConnections(edges, 'goal', 'blocks', undefined, undefined, positions).map(connection => connection.id))
    .toEqual(['a-left', 'b-right', 'near-association', 'next']);
});
