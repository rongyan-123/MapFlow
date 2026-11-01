import type { LearningGroup, LearningTreeSnapshot, RecommendedDepth, SkillEdge, SkillNode } from '../../types/learning';
import { analyzeDependencies } from './dependencies';
import { computeTreeLayout } from './layoutTree';

type Point = { x: number; y: number };
type Unit = { id: string; width: number; height: number; depth: number };
export interface PlacedLearningGroup {
  id: string;
  group: LearningGroup;
  expanded: boolean;
  position: Point;
  width: number;
  height: number;
}
export const DEPTH_ORDER: Record<RecommendedDepth, number> = { Recognize: 0, Understand: 1, Use: 2, Transfer: 3, DeepMastery: 4 };
const nodeUnit = (node: SkillNode): Unit => ({ id: node.id, width: 240, height: 104, depth: DEPTH_ORDER[node.recommended_depth] });

/** Vary parallel nodes by existing learning depth. Real prerequisites always get a later row. */
function placeUnits(units: Unit[], edges: SkillEdge[], maximumRowWidth=Infinity): Map<string, Point> {
  const { layers, parents } = analyzeDependencies(units.map(unit => unit.id), edges);
  const rows = new Map<number, Unit[]>();
  for (const unit of units) {
    const layer = layers.get(unit.id) ?? 0;
    rows.set(layer, [...(rows.get(layer) ?? []), unit]);
  }
  const positions = new Map<string, Point>();
  const parentCenter = (id: string) => {
    const placed = [...(parents.get(id) ?? [])].flatMap(parent => positions.has(parent) ? [positions.get(parent)!.x] : []);
    return placed.length ? placed.reduce((sum, x) => sum + x, 0) / placed.length : 0;
  };
  let rowY = 0;
  for (const [, row] of [...rows].sort(([a], [b]) => a - b)) {
    row.sort((a,b) => parentCenter(a.id) - parentCenter(b.id) || a.depth - b.depth || a.id.localeCompare(b.id));
    const minimumDepth = Math.min(...row.map(unit => unit.depth));
    const wrappedRows:Unit[][]=[[]];
    let occupiedWidth=0;
    for(const unit of row) {
      if(occupiedWidth>0 && occupiedWidth+52+unit.width>maximumRowWidth) {
        wrappedRows.push([]);occupiedWidth=0;
      }
      wrappedRows[wrappedRows.length-1].push(unit);
      occupiedWidth+=(occupiedWidth>0?52:0)+unit.width;
    }
    for(const wrapped of wrappedRows) {
      let x = -(wrapped.reduce((sum, unit) => sum + unit.width, 0) + Math.max(0, wrapped.length - 1) * 52) / 2;
      let bottom = rowY;
      for (const unit of wrapped) {
        const y = rowY + (unit.depth - minimumDepth) * 14;
        positions.set(unit.id, { x, y });
        x += unit.width + 52;
        bottom = Math.max(bottom, y + unit.height);
      }
      rowY = bottom + 88;
    }
  }
  return positions;
}

export function computeLearningNodeLayout(nodes: SkillNode[], edges: SkillEdge[], maximumRowWidth=Infinity) {
  return placeUnits(nodes.map(nodeUnit), edges, maximumRowWidth);
}

function projectEdges(edges: SkillEdge[], resolve: (id: string) => string): SkillEdge[] {
  const seen = new Set<string>();
  return edges.flatMap(edge => {
    const source_node_id = resolve(edge.source_node_id), target_node_id = resolve(edge.target_node_id);
    if (source_node_id === target_node_id) return [];
    const key = JSON.stringify([source_node_id, target_node_id, edge.edge_type]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...edge, source_node_id, target_node_id }];
  });
}

/** Display projection only. Never save its folded edges or group IDs as learning nodes. */
export function computeLearningGroupLayout(snapshot: LearningTreeSnapshot, expanded: ReadonlySet<string>, maximumGroupWidth=Infinity) {
  const groups = snapshot.learning_groups ?? [];
  const nodesById = new Map(snapshot.nodes.map(node => [node.id, node]));
  const ownerByNodeId = new Map<string, string>();
  const groupIds = new Set<string>();
  const displayIds = new Set(nodesById.keys());
  const displayIdByGroup = new Map<string, string>();
  const original = analyzeDependencies(snapshot.nodes.map(node=>node.id), snapshot.edges);
  let invalidGroups = nodesById.size !== snapshot.nodes.length || original.unresolved.length > 0 || original.missingEdges.length > 0;
  for (const group of groups) {
    if (!group.group_id.trim() || !group.title.trim() || groupIds.has(group.group_id) || group.node_ids.length < 2) invalidGroups = true;
    groupIds.add(group.group_id);
    let id = `learning-group:${group.group_id}`;
    while (displayIds.has(id)) id = `:${id}`;
    displayIds.add(id); displayIdByGroup.set(group.group_id, id);
    for (const member of group.node_ids) {
      if (!nodesById.has(member) || ownerByNodeId.has(member)) invalidGroups = true;
      ownerByNodeId.set(member, group.group_id);
    }
  }
  const unitId = (id: string) => displayIdByGroup.get(ownerByNodeId.get(id) ?? '') ?? id;
  const unitIds = [...new Set(snapshot.nodes.map(node => unitId(node.id)))];
  const outerEdges = projectEdges(snapshot.edges, unitId);
  if (analyzeDependencies(unitIds, outerEdges).unresolved.length) invalidGroups = true;
  if (invalidGroups || !groups.length) return {
    positions: snapshot.tree.generation_version === 2 ? computeLearningNodeLayout(snapshot.nodes, snapshot.edges) : computeTreeLayout(snapshot.nodes, snapshot.edges),
    visibleNodeIds: new Set(nodesById.keys()), groups: [] as PlacedLearningGroup[], edges: snapshot.edges,
    ownerByNodeId: new Map<string, string>(), invalidGroups,
  };
  const units = snapshot.nodes.filter(node => !ownerByNodeId.has(node.id)).map(nodeUnit);
  const placedGroups: PlacedLearningGroup[] = [];
  const interiors = new Map<string, Map<string, Point>>();
  for (const group of groups) {
    const id = displayIdByGroup.get(group.group_id)!;
    const members = group.node_ids.map(member => nodesById.get(member)!);
    const isExpanded = expanded.has(group.group_id);
    let width = 240, height = 104;
    if (isExpanded) {
      const memberIds = new Set(group.node_ids);
      const internalEdges = snapshot.edges.filter(edge => memberIds.has(edge.source_node_id) && memberIds.has(edge.target_node_id));
      const inner = computeLearningNodeLayout(members, internalEdges, Math.max(240,maximumGroupWidth-56));
      const left = Math.min(...[...inner.values()].map(point => point.x));
      width = Math.max(...[...inner.values()].map(point => point.x + 240)) - left + 56;
      height = Math.max(...[...inner.values()].map(point => point.y + 104)) + 114;
      interiors.set(id, new Map([...inner].map(([nodeId, point]) => [nodeId, { x: point.x - left + 28, y: point.y + 84 }])));
    }
    units.push({ id, width, height, depth: Math.min(...members.map(node => DEPTH_ORDER[node.recommended_depth])) });
    placedGroups.push({ id, group, expanded: isExpanded, width, height, position: { x: 0, y: 0 } });
  }
  const positions = placeUnits(units, outerEdges);
  for (const group of placedGroups) {
    group.position = positions.get(group.id)!;
    for (const [id, point] of interiors.get(group.id) ?? []) positions.set(id, { x: group.position.x + point.x, y: group.position.y + point.y });
  }
  const resolveVisible = (id: string) => expanded.has(ownerByNodeId.get(id) ?? '') ? id : unitId(id);
  return { positions, groups: placedGroups, ownerByNodeId, invalidGroups,
    visibleNodeIds: new Set(snapshot.nodes.filter(node => resolveVisible(node.id) === node.id).map(node => node.id)),
    edges: projectEdges(snapshot.edges, resolveVisible),
  };
}
