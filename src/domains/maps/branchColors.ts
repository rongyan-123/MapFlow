import type { LearningTreeSnapshot } from '../../types/learning';

const branchTones = ['blue', 'teal', 'violet', 'amber', 'rose'] as const;
export type BranchTone = typeof branchTones[number];
export interface NodeBranch { key: string; label: string; tone: BranchTone }

/** Stable identity hash: independent of titles, array order, learning state and theme. */
export function getBranchTone(key: string): BranchTone {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  return branchTones[hash % branchTones.length];
}

export function getNodeBranches(snapshot: LearningTreeSnapshot): Map<string, NodeBranch> {
  const blocks = new Map((snapshot.blocks ?? []).map(block => [block.id, block]));
  const assignments = new Map<string, string>();
  const orderedAssignments = [...(snapshot.node_block_assignments ?? [])]
    .filter(assignment => blocks.has(assignment.block_id))
    .sort((first, second) => blocks.get(first.block_id)!.sort_order - blocks.get(second.block_id)!.sort_order || first.block_id.localeCompare(second.block_id));
  for (const assignment of orderedAssignments) if (!assignments.has(assignment.node_id)) assignments.set(assignment.node_id, assignment.block_id);
  return new Map(snapshot.nodes.map(node => {
    const block = blocks.get(assignments.get(node.id) ?? '');
    const category = node.category?.trim();
    const key = block ? `block:${block.id}` : category ? `category:${category}` : `tree:${snapshot.tree.id}`;
    return [node.id, { key, label: block?.name ?? category ?? snapshot.tree.title, tone: getBranchTone(key) }];
  }));
}
