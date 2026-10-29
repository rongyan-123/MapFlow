import type { NodeLearningProgress, SkillEdge } from '../../types/learning';
import { progressPercentForNode } from '../../types/learning';
import { isPrerequisite } from './dependencies';

export function getNodeReadiness(nodeIds: readonly string[], edges: readonly SkillEdge[], progress: readonly NodeLearningProgress[]): Map<string, boolean> {
  const knownNodes = new Set(nodeIds);
  const progressByNode = new Map(progress.map(item => [item.node_id, item]));
  const readiness = new Map(nodeIds.map(nodeId => [nodeId, true]));
  for (const edge of edges) {
    if (!isPrerequisite(edge)) continue;
    if (!knownNodes.has(edge.source_node_id) || progressPercentForNode(progressByNode.get(edge.source_node_id)) !== 100) {
      if (knownNodes.has(edge.target_node_id)) readiness.set(edge.target_node_id, false);
    }
  }
  return readiness;
}
