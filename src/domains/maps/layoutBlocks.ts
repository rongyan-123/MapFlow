import { analyzeDependencies } from './dependencies';
import type {
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
} from '../../types/learning';

export const BLOCK_NODE_WIDTH = 240;
export const BLOCK_NODE_HEIGHT = 104;
export const BLOCK_HORIZONTAL_GAP = 36;
export const BLOCK_VERTICAL_GAP = 112;
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

/** Block columns share global prerequisite layers; grouping never flattens dependencies. */
export function computeBlockLayoutModel(
  nodes: SkillNode[],
  edges: SkillEdge[],
  blocks: SkillBlock[],
  assignments: SkillNodeBlockAssignment[],
): BlockLayoutModel {
  const { layers } = analyzeDependencies(nodes.map(node => node.id), edges);
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
  let cursorX = 0;
  const headerHeight = 72;
  const maximumLayer = Math.max(0, ...layers.values());
  for (const [groupId, groupNodes] of groups) {
    if (!groupNodes.length) continue;
    const rows = new Map<number, SkillNode[]>();
    for (const node of groupNodes) {
      const layer = layers.get(node.id)!;
      rows.set(layer, [...(rows.get(layer) ?? []), node]);
    }
    const columns = Math.max(...[...rows.values()].map(row => row.length));
    const laneWidth = columns * (BLOCK_NODE_WIDTH + BLOCK_HORIZONTAL_GAP) - BLOCK_HORIZONTAL_GAP + BLOCK_PADDING * 2;
    for (const [layer, row] of rows) {
      row.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, column) => positions.set(node.id, {
        x: cursorX + BLOCK_PADDING + column * (BLOCK_NODE_WIDTH + BLOCK_HORIZONTAL_GAP),
        y: headerHeight + BLOCK_PADDING + layer * (BLOCK_NODE_HEIGHT + BLOCK_VERTICAL_GAP),
      }));
    }
    const block = blockById.get(groupId);
    lanes.push({ blockId: groupId, name: block?.name ?? '未分组节点', color: block?.color ?? null,
      x: cursorX, y: 0, width: laneWidth,
      height: headerHeight + BLOCK_PADDING * 2 + maximumLayer * (BLOCK_NODE_HEIGHT + BLOCK_VERTICAL_GAP) + BLOCK_NODE_HEIGHT,
    });
    cursorX += laneWidth + BLOCK_HORIZONTAL_GAP;
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
