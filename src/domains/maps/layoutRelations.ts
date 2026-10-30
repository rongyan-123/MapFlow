import type { SkillEdge } from '../../types/learning';
import { analyzeDependencies, isPrerequisite } from './dependencies';

/** Layout-only constraints. Never pass this projection to learning readiness or plans. */
export function analyzeLayoutRelations(nodeIds: readonly string[], edges: readonly SkillEdge[]) {
  const constraints = edges.filter(isPrerequisite);
  const { children, unresolved } = analyzeDependencies(nodeIds, constraints);
  const unresolvedNodes = new Set(unresolved);
  const reaches = (start: string, target: string) => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === target) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...children.get(current) ?? []);
    }
    return false;
  };
  // Fixed ordering keeps a legacy cycle's layout stable across API/input ordering.
  const legacy = edges.filter(edge => edge.edge_type === 'requires').sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of legacy) {
    // Keep existing hard-cycle diagnostics local; support must not spread them.
    if (unresolvedNodes.has(edge.source_node_id) || unresolvedNodes.has(edge.target_node_id)) continue;
    const sourceChildren = children.get(edge.source_node_id);
    if (!sourceChildren || !children.has(edge.target_node_id) || sourceChildren.has(edge.target_node_id)) continue;
    if (reaches(edge.target_node_id, edge.source_node_id)) continue;
    sourceChildren.add(edge.target_node_id);
    constraints.push({ ...edge, edge_type: 'prerequisite' });
  }
  return analyzeDependencies(nodeIds, constraints);
}
