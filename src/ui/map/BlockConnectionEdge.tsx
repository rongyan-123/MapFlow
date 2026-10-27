import { memo, useId, useMemo, type CSSProperties } from 'react';
import { useStore, type ReactFlowState, type Node, type EdgeProps } from '@xyflow/react';
import { getBlockConnectionRoute, type BlockConnection, type ConnectionRect } from '../../domains/maps/blockConnections';
import { BLOCK_NODE_HEIGHT, BLOCK_NODE_WIDTH } from '../../domains/maps/layoutBlocks';

type RoutingCard = ConnectionRect & { id: string };
const routingNodes = (state: ReactFlowState) => state.nodes;
const sameGeometry = (previous: Node[], next: Node[]) => previous === next || previous.length === next.length && previous.every((card, index) => {
  const other = next[index];
  return card.id === other.id && card.type === other.type && card.position.x === other.position.x && card.position.y === other.position.y && card.measured?.width === other.measured?.width && card.measured?.height === other.measured?.height;
});

function BlockConnectionEdge({ source, target, data }: EdgeProps<BlockConnection>) {
  // Selection and viewport changes do not rerun obstacle sampling for every edge.
  const nodes = useStore(routingNodes, sameGeometry);
  const cards = useMemo<RoutingCard[]>(() => nodes.filter(node => node.type === 'skill').map(node => ({
    id: node.id, x: node.position.x, y: node.position.y,
    width: node.measured?.width ?? BLOCK_NODE_WIDTH,
    height: node.measured?.height ?? BLOCK_NODE_HEIGHT,
  })), [nodes]);
  const markerId = `connection-arrow-${useId().replace(/:/g, '')}`;
  const route = useMemo(() => {
    const sourceCard = cards.find((node) => node.id === source);
    const targetCard = cards.find((node) => node.id === target);
    if (!sourceCard || !targetCard) return null;
    return getBlockConnectionRoute(sourceCard, targetCard, cards.filter((node) => node.id !== source && node.id !== target), data?.lane);
  }, [cards, source, target, data?.lane]);
  if (!route) return null;
  const highlighted = data?.relation === 'incoming' || data?.relation === 'outgoing';
  const color = data?.relation === 'incoming' ? 'var(--mf-map-incoming)' : data?.relation === 'outgoing' ? 'var(--mf-map-outgoing)' : 'var(--mf-map-edge)';

  return (
    <g
      className="mapflow-block-connection"
      data-relation={data?.relation}
      style={{ '--connection-color': color } as CSSProperties}
      data-edge-type={data?.edgeType}
      aria-label={data?.relation === 'incoming' ? '直接前置' : data?.relation === 'outgoing' ? '直接后续' : data?.edgeType === 'prerequisite' ? '学习依赖' : '知识关联'}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill={color} />
        </marker>
      </defs>
      {highlighted && <path d={route.path} className="mapflow-connection-outline" />}
      <path d={route.path} className="mapflow-connection-line" markerEnd={`url(#${markerId})`} />
      {highlighted && <><circle cx={route.start.x} cy={route.start.y} r="4" className="mapflow-connection-port" /><circle cx={route.end.x} cy={route.end.y} r="3" className="mapflow-connection-port" /></>}
    </g>
  );
}

export default memo(BlockConnectionEdge);
