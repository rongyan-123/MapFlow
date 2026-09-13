import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
} from '../../types/learning';

export const BLOCK_NODE_WIDTH = 200;
export const BLOCK_NODE_HEIGHT = 80;
export const BLOCK_HORIZONTAL_GAP = 32;
export const BLOCK_VERTICAL_GAP = 96;
export const BLOCK_PADDING = 24;
export const BLOCK_LABEL_WIDTH = 180;
export const BLOCK_LABEL_GAP = 24;

export interface BlockLaneLayout {
  blockId: string;
  name: string;
  color: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockLayoutModel {
  positions: Map<string, { x: number; y: number }>;
  lanes: BlockLaneLayout[];
}

/**
 * 按 Agent 提供的 block 分组，把每个块排成独立的纵向泳道。
 *
 * 每个块占一整行，节点按学习深度与稳定顺序横向展开；块之间只负责提供
 * 稳定的纵向分隔。MCP 写入的 position_x/position_y 不参与布局。
 */
export function computeBlockLayoutModel(
  nodes: SkillNode[],
  edges: SkillEdge[],
  blocks: SkillBlock[],
  assignments: SkillNodeBlockAssignment[],
): BlockLayoutModel {
  void edges;
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

  if (nodeBlock.size === 0) return { positions: new Map(), lanes: [] };

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
  const lanes: BlockLaneLayout[] = [];
  let cursorY = 0;

  for (const [groupId, groupNodes] of groups) {
    if (groupNodes.length === 0) continue;

    const orderedNodes = [...groupNodes].sort(
      (a, b) =>
        a.depth_level - b.depth_level ||
        a.order_in_level - b.order_in_level ||
        a.id.localeCompare(b.id),
    );
    const contentWidth =
      orderedNodes.length * BLOCK_NODE_WIDTH +
      Math.max(0, orderedNodes.length - 1) * BLOCK_HORIZONTAL_GAP;
    const laneWidth =
      BLOCK_LABEL_WIDTH +
      BLOCK_LABEL_GAP +
      contentWidth +
      BLOCK_PADDING * 2;
    const laneHeight = BLOCK_NODE_HEIGHT + BLOCK_PADDING * 2;
    const laneX = -laneWidth / 2;
    const contentStartX =
      laneX + BLOCK_LABEL_WIDTH + BLOCK_LABEL_GAP + BLOCK_PADDING;
    const nodeY = cursorY + BLOCK_PADDING;

    orderedNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: contentStartX + index * (BLOCK_NODE_WIDTH + BLOCK_HORIZONTAL_GAP),
        y: nodeY,
      });
    });

    const block = groupId === '__unassigned__' ? null : blockById.get(groupId);
    lanes.push({
      blockId: groupId,
      name: block?.name ?? '未分组节点',
      color: block?.color ?? null,
      x: laneX,
      y: cursorY,
      width: laneWidth,
      height: laneHeight,
    });
    cursorY += laneHeight + BLOCK_VERTICAL_GAP;
  }

  return { positions, lanes };
}

export function computeBlockLayout(
  nodes: SkillNode[],
  edges: SkillEdge[],
  blocks: SkillBlock[],
  assignments: SkillNodeBlockAssignment[],
): Map<string, { x: number; y: number }> {
  return computeBlockLayoutModel(nodes, edges, blocks, assignments).positions;
}
