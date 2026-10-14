import type { Edge } from '@xyflow/react';
import type { SkillEdge } from '../../types/learning';

export interface ConnectionRect { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
export type BlockConnection = Edge<{ relation: 'incoming' | 'outgoing'; lane: number }, 'blockConnection'>;

export function buildBlockConnections(edges: SkillEdge[], selectedNodeId: string | null): BlockConnection[] {
  if (!selectedNodeId) return [];
  return edges.filter((edge) => edge.source_node_id === selectedNodeId || edge.target_node_id === selectedNodeId)
    .map((edge, lane) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: 'blockConnection',
      selectable: false,
      zIndex: 2,
      data: { relation: edge.target_node_id === selectedNodeId ? 'incoming' : 'outgoing', lane },
    }));
}

type Cubic = [Point, Point, Point, Point];

function curveRoute(curves: Cubic[]) {
  const start = curves[0][0];
  const end = curves[curves.length - 1][3];
  const path = `M ${start.x} ${start.y} ` + curves.map(([, a, b, endPoint]) =>
    `C ${a.x} ${a.y} ${b.x} ${b.y} ${endPoint.x} ${endPoint.y}`,
  ).join(' ');
  // 与 SVG 同一条三次曲线的采样，用于检查卡片安全间隙。
  const points = curves.flatMap(([p0, p1, p2, p3]) => {
    const steps = Math.max(32, Math.ceil((Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y)) / 8));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const u = 1 - t;
      return {
        x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
        y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
      };
    });
  });
  return { start, end, path, points };
}

function intersects(points: Point[], obstacles: ConnectionRect[]) {
  return points.some(({ x, y }) => obstacles.some((rect) =>
    x > rect.x - 12 && x < rect.x + rect.width + 12 &&
    y > rect.y - 12 && y < rect.y + rect.height + 12,
  ));
}

export function getBlockConnectionRoute(source: ConnectionRect, target: ConnectionRect, obstacles: ConnectionRect[], lane = 0) {
  const sameRow = Math.abs(source.y - target.y) < Math.min(source.height, target.height) / 2;
  const down = target.y >= source.y;
  const direction = down ? 1 : -1;
  const start = { x: source.x + source.width / 2, y: source.y + (sameRow || down ? source.height : 0) };
  const end = { x: target.x + target.width / 2, y: target.y + (sameRow || !down ? target.height : 0) };
  const spread = (lane % 5) * 10;
  if (sameRow) {
    const bendY = Math.max(start.y, end.y) + 76 + spread;
    return curveRoute([[start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end]]);
  }
  const bend = Math.max(48, Math.abs(end.y - start.y) * 0.45);
  const sway = Math.abs(start.x - end.x) < 40 ? 32 + spread : spread;
  const direct = curveRoute([[start, { x: start.x + sway, y: start.y + direction * bend }, { x: end.x - sway, y: end.y - direction * bend }, end]]);
  if (!intersects(direct.points, obstacles)) return direct;

  // 跨多排时，从两端的排间空隙转入空列，避免曲线穿过中间卡片。
  const exitY = start.y + direction * (48 + spread);
  const entryY = end.y - direction * (48 + spread);
  const corridorGap = 18 + lane * 7;
  const candidates = [...new Set(obstacles.flatMap((rect) => [rect.x - corridorGap, rect.x + rect.width + corridorGap]))]
    .sort((a, b) => (Math.abs(a - start.x) + Math.abs(a - end.x)) - (Math.abs(b - start.x) + Math.abs(b - end.x)));
  for (const corridorX of candidates) {
    const exit = { x: corridorX, y: exitY + direction * 28 };
    const entry = { x: corridorX, y: entryY - direction * 28 };
    const leftmost = Math.min(...obstacles.map((rect) => rect.x));
    const rightmost = Math.max(...obstacles.map((rect) => rect.x + rect.width));
    const bow = corridorX < leftmost ? -24 : corridorX > rightmost ? 24 : 0;
    const routed = curveRoute([
      [start, { x: start.x, y: exitY }, { x: corridorX, y: exitY }, exit],
      [exit, { x: corridorX + bow, y: exit.y + (entry.y - exit.y) / 3 }, { x: corridorX + bow, y: exit.y + (entry.y - exit.y) * 2 / 3 }, entry],
      [entry, { x: corridorX, y: entryY }, { x: end.x, y: entryY }, end],
    ]);
    if (!intersects(routed.points, obstacles)) return routed;
  }
  return direct;
}
