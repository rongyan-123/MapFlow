import type { SkillEdge, SkillNode } from '../../types/learning';
import { analyzeDependencies } from './dependencies';

/** Longest prerequisite path; related edges and stored depth never invent dependencies. */
export function computeTreeLayout(nodes: SkillNode[], edges: SkillEdge[]): Map<string, { x: number; y: number }> {
  const { layers, parents } = analyzeDependencies(nodes.map(node => node.id), edges);
  const levels = new Map<number, SkillNode[]>();
  for (const node of nodes) {
    const level = layers.get(node.id)!;
    levels.set(level, [...(levels.get(level) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  const parentCenter = (id: string) => {
    const placed = [...parents.get(id)!].map(parent => positions.get(parent)?.x).filter((x): x is number => x !== undefined);
    return placed.length ? placed.reduce((sum, x) => sum + x, 0) / placed.length : 0;
  };
  for (const [level, levelNodes] of [...levels].sort(([a], [b]) => a - b)) {
    const ordered = levelNodes.sort((a, b) => parentCenter(a.id) - parentCenter(b.id) || a.id.localeCompare(b.id));
    ordered.forEach((node, index) => positions.set(node.id, { x: index * 276 - (ordered.length * 276 - 36) / 2, y: level * 168 }));
  }
  return positions;
}
