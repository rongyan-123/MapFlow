import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
} from '../../types/learning';
import { computeTreeLayout } from './layoutTree';

const BASE_NODE_WIDTH = 200;
const BLOCK_NODE_WIDTH = 280;
const BLOCK_GAP = 96;

/**
 * 按 Agent 提供的 block 分组，把每个块排成独立的横向泳道。
 *
 * 节点坐标仍由前端计算：MCP 写入的 position_x/position_y 不参与布局。
 * 块内继续复用关系瀑布算法，块之间只负责提供稳定的横向分隔。
 */
export function computeBlockLayout(
  nodes: SkillNode[],
  edges: SkillEdge[],
  blocks: SkillBlock[],
  assignments: SkillNodeBlockAssignment[],
): Map<string, { x: number; y: number }> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const nodeBlock = new Map<string, string>();

  for (const assignment of assignments) {
    if (
      nodeById.has(assignment.node_id) &&
      blockById.has(assignment.block_id) &&
      !nodeBlock.has(assignment.node_id)
    ) {
      nodeBlock.set(assignment.node_id, assignment.block_id);
    }
  }

  if (nodeBlock.size === 0) return new Map();

  const blockIds = [...new Set(nodeBlock.values())].sort((a, b) => {
    const blockA = blockById.get(a)!;
    const blockB = blockById.get(b)!;
    return blockA.sort_order - blockB.sort_order || blockA.id.localeCompare(blockB.id);
  });
  const groups = new Map<string, SkillNode[]>();
  for (const blockId of blockIds) groups.set(blockId, []);
  groups.set('__unassigned__', []);

  for (const node of nodes) {
    groups.get(nodeBlock.get(node.id) ?? '__unassigned__')!.push(node);
  }
  if (groups.get('__unassigned__')!.length === 0) groups.delete('__unassigned__');

  const positions = new Map<string, { x: number; y: number }>();
  let cursorX = 0;

  for (const [groupId, groupNodes] of groups) {
    const groupNodeIds = new Set(groupNodes.map((node) => node.id));
    const groupEdges = edges.filter(
      (edge) =>
        groupNodeIds.has(edge.source_node_id) &&
        groupNodeIds.has(edge.target_node_id),
    );
    const local = computeTreeLayout(groupNodes, groupEdges);
    const localValues = groupNodes.map((node) => local.get(node.id) ?? { x: 0, y: 0 });
    const minX = Math.min(...localValues.map((position) => position.x));
    const maxX = Math.max(...localValues.map((position) => position.x));
    const minY = Math.min(...localValues.map((position) => position.y));
    const groupWidth = Math.max(
      BLOCK_NODE_WIDTH,
      (maxX - minX) * (BLOCK_NODE_WIDTH / BASE_NODE_WIDTH) + BLOCK_NODE_WIDTH,
    );

    for (const node of groupNodes) {
      const localPosition = local.get(node.id) ?? { x: 0, y: 0 };
      positions.set(node.id, {
        x: cursorX + (localPosition.x - minX) * (BLOCK_NODE_WIDTH / BASE_NODE_WIDTH),
        y: localPosition.y - minY,
      });
    }

    // Keep the unassigned lane at the end, so an Agent adding a block later does
    // not move already grouped lanes around unexpectedly.
    cursorX += groupWidth + BLOCK_GAP;
    void groupId;
  }

  return positions;
}
