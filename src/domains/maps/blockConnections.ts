import type { Edge } from '@xyflow/react';
import type { SkillEdge, TreeLayoutMode } from '../../types/learning';
import type { BranchTone, NodeBranch } from './branchColors';

export interface ConnectionRect { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
export type BlockConnection = Edge<{ relation: 'neutral' | 'incoming' | 'outgoing'; lane: number; edgeType: string; sourceTone?: BranchTone; targetTone?: BranchTone; sourceLit?: boolean; targetLit?: boolean; hasFocus?: boolean }, 'blockConnection'>;

export function buildBlockConnections(edges: SkillEdge[], selectedNodeId: string | null, layoutMode: TreeLayoutMode = 'blocks', branches?: ReadonlyMap<string, NodeBranch>, litNodes?: ReadonlySet<string>): BlockConnection[] {
  if (layoutMode === 'blocks' && !selectedNodeId) return [];
  const groups = new Map<string, SkillEdge[]>();
  for (const edge of edges) {
    const group = groups.get(edge.source_node_id) ?? [];
    group.push(edge);
    groups.set(edge.source_node_id, group);
  }
  const lanes = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((first, second) => first.id.localeCompare(second.id));
    group.forEach((edge, index) => lanes.set(edge.id, group.length > 1 ? index * 4 / (group.length - 1) : 0));
  }
  const visible = layoutMode === 'blocks' ? edges.filter(edge => edge.source_node_id === selectedNodeId || edge.target_node_id === selectedNodeId) : edges;
  return visible.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: 'blockConnection',
      selectable: false,
      zIndex: edge.edge_type === 'prerequisite' && (edge.source_node_id === selectedNodeId || edge.target_node_id === selectedNodeId) ? 2 : 1,
      data: {
        relation: edge.edge_type !== 'prerequisite' || !selectedNodeId ? 'neutral'
          : edge.target_node_id === selectedNodeId ? 'incoming'
          : edge.source_node_id === selectedNodeId ? 'outgoing' : 'neutral',
        lane: lanes.get(edge.id) ?? 0,
        edgeType: edge.edge_type,
        sourceTone: branches?.get(edge.source_node_id)?.tone,
        targetTone: branches?.get(edge.target_node_id)?.tone,
        sourceLit: litNodes ? litNodes.has(edge.source_node_id) : true,
        targetLit: litNodes ? litNodes.has(edge.target_node_id) : true,
        hasFocus: !!selectedNodeId,
      },
    }));
}

function orthogonalRoute(vertices: Point[]) {
  const points: Point[] = [];
  for (const point of vertices) {
    const last = points[points.length - 1];
    if (last && last.x === point.x && last.y === point.y) continue;
    const before = points[points.length - 2];
    if (before && last && (before.x === last.x && last.x === point.x || before.y === last.y && last.y === point.y)) points.pop();
    points.push(point);
  }
  const start = points[0];
  const end = points[points.length - 1];
  const path = `M ${start.x} ${start.y} ` + points.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ');
  const length = points.slice(1).reduce((total, point, index) => total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
  return { start, end, path, points, length };
}

function intersects(points: Point[], obstacles: ConnectionRect[]) {
  return points.slice(1).some((end, index) => {
    const start = points[index];
    return obstacles.some(rect => start.x === end.x
      ? start.x > rect.x && start.x < rect.x + rect.width && Math.max(start.y, end.y) > rect.y && Math.min(start.y, end.y) < rect.y + rect.height
      : start.y > rect.y && start.y < rect.y + rect.height && Math.max(start.x, end.x) > rect.x && Math.min(start.x, end.x) < rect.x + rect.width);
  });
}

export function getBlockConnectionRoute(source: ConnectionRect, target: ConnectionRect, obstacles: ConnectionRect[], lane = 0) {
  const sameRow = Math.abs(source.y - target.y) < Math.min(source.height, target.height) / 2;
  const down = target.y >= source.y;
  const sourceDirection = sameRow || down ? 1 : -1;
  const targetDirection = sameRow || !down ? 1 : -1;
  const start = { x: source.x + source.width / 2, y: source.y + (sourceDirection === 1 ? source.height : 0) };
  const end = { x: target.x + target.width / 2, y: target.y + (targetDirection === 1 ? target.height : 0) };
  const blockers = [...obstacles.map(rect => ({ x: rect.x - 12, y: rect.y - 12, width: rect.width + 24, height: rect.height + 24 })), source, target];
  const exitY = start.y + sourceDirection * (20 + lane * 2);
  const entryY = end.y + targetDirection * (20 + lane * 2);
  const middleY = sameRow ? Math.max(start.y, end.y) + 56 + lane * 6 : (start.y + end.y) / 2 + lane * 4;
  const direct = orthogonalRoute(start.x === end.x && !sameRow
    ? [start, { x: start.x, y: exitY }, { x: start.x + lane * 8, y: exitY }, { x: end.x + lane * 8, y: entryY }, { x: end.x, y: entryY }, end]
    : [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end]);
  if (!intersects(direct.points, blockers)) return direct;

  // Share the same port directions while routing through clear row/column gutters.
  const gap = 18 + lane * 7;
  const corridors = [...new Set(blockers.flatMap(rect => [rect.x - gap, rect.x + rect.width + gap]))]
    .sort((first, second) => Math.abs(first - start.x) + Math.abs(first - end.x) - Math.abs(second - start.x) - Math.abs(second - end.x));
  for (const corridorX of corridors) {
    const routed = orthogonalRoute([start, { x: start.x, y: exitY }, { x: corridorX, y: exitY }, { x: corridorX, y: entryY }, { x: end.x, y: entryY }, end]);
    if (!intersects(routed.points, blockers)) return routed;
  }
  // A dragged card can obstruct the nearest exit. Try the other open row gutters.
  const exitRows = [...new Set(blockers.flatMap(rect => [rect.y - gap, rect.y + rect.height + gap]))]
    .filter(y => (y - start.y) * sourceDirection > 0)
    .sort((first, second) => Math.abs(first - start.y) - Math.abs(second - start.y));
  const entryRows = [...new Set(blockers.flatMap(rect => [rect.y - gap, rect.y + rect.height + gap]))]
    .filter(y => (y - end.y) * targetDirection > 0)
    .sort((first, second) => Math.abs(first - end.y) - Math.abs(second - end.y));
  for (const nextExit of [exitY, ...exitRows.slice(0, 4)]) for (const nextEntry of [entryY, ...entryRows.slice(0, 4)]) {
    if (intersects([start, { x: start.x, y: nextExit }], blockers) || intersects([{ x: end.x, y: nextEntry }, end], blockers)) continue;
    for (const corridorX of corridors) {
      const routed = orthogonalRoute([start, { x: start.x, y: nextExit }, { x: corridorX, y: nextExit }, { x: corridorX, y: nextEntry }, { x: end.x, y: nextEntry }, end]);
      if (!intersects(routed.points, blockers)) return routed;
    }
  }
  // Overlapping cards may leave no clear port exit; preserve the dependency and endpoints.
  return direct;
}
