import type { SkillEdge } from '../../types/learning';

/** Only explicit prerequisites constrain learning. Legacy requires edges need review. */
export function isPrerequisite(edge: SkillEdge): boolean { return edge.edge_type === 'prerequisite'; }

export function analyzeDependencies(nodeIds: readonly string[], edges: readonly SkillEdge[]) {
  const known = new Set(nodeIds);
  const parents = new Map(nodeIds.map(id => [id, new Set<string>()]));
  const children = new Map(nodeIds.map(id => [id, new Set<string>()]));
  const missingEdges: string[] = [];
  const ambiguousEdges: string[] = [];
  for (const edge of edges) {
    if (!known.has(edge.source_node_id) || !known.has(edge.target_node_id)) { missingEdges.push(edge.id); continue; }
    if (!isPrerequisite(edge)) {
      if (!['related', 'supports'].includes(edge.edge_type)) ambiguousEdges.push(edge.id);
      continue;
    }
    parents.get(edge.target_node_id)!.add(edge.source_node_id);
    children.get(edge.source_node_id)!.add(edge.target_node_id);
  }
  const remaining = new Map(nodeIds.map(id => [id, parents.get(id)!.size]));
  const queue = nodeIds.filter(id => remaining.get(id) === 0).sort();
  const layers = new Map<string, number>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    layers.set(id, Math.max(0, ...[...parents.get(id)!].map(parent => layers.get(parent)! + 1)));
    for (const child of children.get(id)!) {
      remaining.set(child, remaining.get(child)! - 1);
      if (remaining.get(child) === 0) queue.push(child);
    }
  }
  const unresolved = nodeIds.filter(id => !layers.has(id)).sort();
  // Unresolved nodes remain visible in a separate area, never advertised as roots.
  const unresolvedLayer = Math.max(0, ...layers.values()) + 2;
  for (const id of unresolved) layers.set(id, unresolvedLayer);
  return { layers, parents, children, unresolved, missingEdges, ambiguousEdges };
}
