import type { NodeProgress, TreeGraph } from '../tree-library/types';
import type { LearningTreeSnapshot } from '../../types/learning';
import { learningStatusFromProgressPercent, normalizeProgressPercent } from '../../types/learning';

export function snapshotFromGraph(graph: TreeGraph, completedNodeIds: readonly string[], nodeProgress?: readonly NodeProgress[]): LearningTreeSnapshot {
  const progressByNodeId = new Map((nodeProgress ?? []).map(item => [item.node_id, normalizeProgressPercent(item.progress_percent)]));
  for (const nodeId of completedNodeIds) if (!progressByNodeId.has(nodeId)) progressByNodeId.set(nodeId, 100);
  return {
    tree: graph.tree, nodes: graph.nodes, edges: graph.edges, current_node_id: null,
    progress: [...progressByNodeId.entries()]
      .filter(([nodeId, percent]) => graph.nodes.some(node => node.id === nodeId) && percent > 0)
      .map(([nodeId, percent]) => ({ node_id: nodeId, status: learningStatusFromProgressPercent(percent), evidence: '', progress_percent: percent })),
    blocks: graph.blocks ?? [], node_block_assignments: graph.node_block_assignments ?? [],
  };
}
