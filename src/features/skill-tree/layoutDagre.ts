import dagre from '@dagrejs/dagre';
import type { SkillEdge, SkillNode } from '../../types/learning';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 36;

export function computeCompactLayout(
  nodes: SkillNode[],
  edges: SkillEdge[],
): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph({
    compound: false,
    directed: true,
    multigraph: false,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'TB',
    nodesep: HORIZONTAL_GAP,
    ranksep: VERTICAL_GAP,
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    graph.setEdge(edge.source_node_id, edge.target_node_id);
  });
  dagre.layout(graph);

  const levels = new Map<number, SkillNode[]>();
  nodes.forEach((node) => {
    const level = levels.get(node.depth_level) ?? [];
    level.push(node);
    levels.set(node.depth_level, level);
  });

  const orderedLevels = [...levels.entries()].sort(
    ([left], [right]) => left - right,
  );
  const widestLevel = Math.max(
    ...orderedLevels.map(([, levelNodes]) => levelNodes.length),
  );
  const columnStep = NODE_WIDTH + HORIZONTAL_GAP;
  const rowStep = NODE_HEIGHT + VERTICAL_GAP;
  const canvasWidth =
    widestLevel * NODE_WIDTH + (widestLevel - 1) * HORIZONTAL_GAP;
  const positions = new Map<string, { x: number; y: number }>();

  orderedLevels.forEach(([level, levelNodes]) => {
    levelNodes.sort((left, right) => {
      const leftX = graph.node(left.id)?.x ?? left.order_in_level;
      const rightX = graph.node(right.id)?.x ?? right.order_in_level;
      return leftX - rightX || left.order_in_level - right.order_in_level;
    });
    const levelWidth =
      levelNodes.length * NODE_WIDTH +
      (levelNodes.length - 1) * HORIZONTAL_GAP;
    const startX = (canvasWidth - levelWidth) / 2;
    levelNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: startX + index * columnStep,
        y: level * rowStep,
      });
    });
  });

  return positions;
}
