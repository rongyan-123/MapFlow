import { createConnectionRouter } from './connectionRouting';
export { createConnectionRouter } from './connectionRouting';
import type { Edge } from '@xyflow/react';
import type { SkillEdge, TreeLayoutMode } from '../../types/learning';
import type { BranchTone, NodeBranch } from './branchColors';

export interface ConnectionRect { x: number; y: number; width: number; height: number }
interface Point { x: number; y: number }
export type BlockConnection = Edge<{ relation: 'neutral' | 'incoming' | 'outgoing'; lane: number; sourcePort?: number; targetPort?: number; edgeType: string; sourceTone?: BranchTone; targetTone?: BranchTone; sourceLit?: boolean; targetLit?: boolean; hasFocus?: boolean }, 'blockConnection'>;

export function buildBlockConnections(edges: SkillEdge[], selectedNodeId: string | null, layoutMode: TreeLayoutMode = 'blocks', branches?: ReadonlyMap<string, NodeBranch>, litNodes?: ReadonlySet<string>, positions?: ReadonlyMap<string, Point>): BlockConnection[] {
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
  const incoming = new Map<string, SkillEdge[]>();
  for (const edge of edges) {
    const group = incoming.get(edge.target_node_id) ?? [];
    group.push(edge); incoming.set(edge.target_node_id, group);
  }
  const assignPorts = (groups: Iterable<SkillEdge[]>, peer: 'source_node_id' | 'target_node_id', first: number, last: number) => {
    const ports = new Map<string, number>();
    for (const group of groups) {
      const ordered = [...group].sort((a, b) => {
        const firstPeer = positions?.get(a[peer]), secondPeer = positions?.get(b[peer]);
        return (firstPeer?.x ?? 0) - (secondPeer?.x ?? 0) || (firstPeer?.y ?? 0) - (secondPeer?.y ?? 0) || a.id.localeCompare(b.id);
      });
      ordered.forEach((edge, index) => ports.set(edge.id, ordered.length === 1 ? .5 : first + (last - first) * index / (ordered.length - 1)));
    }
    return ports;
  };
  const sourcePorts = assignPorts(groups.values(), 'target_node_id', .2, .8);
  // Keep incoming arrows clear of the readiness badge at the card's top left.
  const targetPorts = assignPorts(incoming.values(), 'source_node_id', .5, .88);
  const nearestByTarget = new Map<string, SkillEdge>();
  const priority = (edge: SkillEdge) => edge.edge_type === 'prerequisite' ? 0 : 1;
  const distance = (edge: SkillEdge) => {
    const source = positions?.get(edge.source_node_id);
    const target = positions?.get(edge.target_node_id);
    return source && target ? Math.hypot(source.x - target.x, source.y - target.y) : Infinity;
  };
  for (const edge of edges) {
    const nearest = nearestByTarget.get(edge.target_node_id);
    if (!nearest || priority(edge) < priority(nearest)
      || priority(edge) === priority(nearest) && (distance(edge) < distance(nearest)
        || distance(edge) === distance(nearest) && edge.id.localeCompare(nearest.id) < 0)) nearestByTarget.set(edge.target_node_id, edge);
  }
  const primaryIds = new Set([...nearestByTarget.values()].map(edge => edge.id));
  const visible = edges.filter(edge => edge.source_node_id === selectedNodeId || edge.target_node_id === selectedNodeId
    || layoutMode === 'relationship' && primaryIds.has(edge.id));
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
        sourcePort: sourcePorts.get(edge.id),
        targetPort: targetPorts.get(edge.id),
        edgeType: edge.edge_type,
        sourceTone: branches?.get(edge.source_node_id)?.tone,
        targetTone: branches?.get(edge.target_node_id)?.tone,
        sourceLit: litNodes ? litNodes.has(edge.source_node_id) : true,
        targetLit: litNodes ? litNodes.has(edge.target_node_id) : true,
        hasFocus: !!selectedNodeId,
      },
    }));
}

export function getBlockConnectionRoute(source: ConnectionRect, target: ConnectionRect, obstacles: ConnectionRect[], lane = 0, ports?: { source?: number; target?: number }) {
  return createConnectionRouter([...obstacles, source, target]).route(source, target, lane, ports);
}
