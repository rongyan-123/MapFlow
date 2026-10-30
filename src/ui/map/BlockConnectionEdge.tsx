import { memo, useId, useMemo, type CSSProperties } from 'react';
import { useStore, type ReactFlowState, type Node, type EdgeProps } from '@xyflow/react';
import { createConnectionRouter, type BlockConnection, type ConnectionRect } from '../../domains/maps/blockConnections';
import { BLOCK_NODE_HEIGHT, BLOCK_NODE_WIDTH } from '../../domains/maps/layoutBlocks';

type RoutingCard = ConnectionRect & { id: string };
const routingNodes = (state: ReactFlowState) => state.nodes;
const sameGeometry = (previous: Node[], next: Node[]) => previous === next || previous.length === next.length && previous.every((card, index) => {
  const other = next[index];
  return card.id === other.id && card.type === other.type && card.position.x === other.position.x && card.position.y === other.position.y && card.measured?.width === other.measured?.width && card.measured?.height === other.measured?.height;
});

type RoutingGeometry = { signature: string; cards: Map<string, RoutingCard>; router: ReturnType<typeof createConnectionRouter> };
const geometryCache = new WeakMap<Node[], RoutingGeometry>();
let recentGeometry: RoutingGeometry | undefined;
function getRoutingGeometry(nodes: Node[]): RoutingGeometry {
  const cached = geometryCache.get(nodes);
  if (cached) return cached;
  const cards: RoutingCard[] = nodes.filter(node => node.type === 'skill').map(node => ({
    id: node.id, x: node.position.x, y: node.position.y,
    width: node.measured?.width ?? BLOCK_NODE_WIDTH, height: node.measured?.height ?? BLOCK_NODE_HEIGHT,
  }));
  const signature = JSON.stringify(cards);
  if (recentGeometry?.signature !== signature) recentGeometry = { signature, cards: new Map(cards.map(card => [card.id, card])), router: createConnectionRouter(cards) };
  geometryCache.set(nodes, recentGeometry);
  return recentGeometry;
}

function BlockConnectionEdge({ source, target, data }: EdgeProps<BlockConnection>) {
  // Selection and viewport changes do not rerun obstacle sampling for every edge.
  const nodes = useStore(routingNodes, sameGeometry);
  const geometry = useMemo(() => getRoutingGeometry(nodes), [nodes]);
  const markerId = `connection-arrow-${useId().replace(/:/g, '')}`;
  const route = useMemo(() => {
    const sourceCard = geometry.cards.get(source);
    const targetCard = geometry.cards.get(target);
    if (!sourceCard || !targetCard) return null;
    return geometry.router.route(sourceCard, targetCard, data?.lane, { source: data?.sourcePort, target: data?.targetPort });
  }, [geometry, source, target, data?.lane, data?.sourcePort, data?.targetPort]);
  if (!route) return null;
  const highlighted = data?.relation === 'incoming' || data?.relation === 'outgoing';
  const sourceColor = data?.sourceLit === false ? 'var(--mf-map-unlit-accent)' : `var(--mf-branch-${data?.sourceTone ?? 'blue'})`;
  const targetColor = data?.targetLit === false ? 'var(--mf-map-unlit-accent)' : `var(--mf-branch-${data?.targetTone ?? data?.sourceTone ?? 'blue'})`;
  const gradientId = `${markerId}-branch`;
  const color = sourceColor === targetColor ? sourceColor : `url(#${gradientId})`;
  const duration = Math.min(14, Math.max(3, route.length / 85));
  const flowStyle = { '--flow-distance': `${route.length}px`, '--flow-duration': `${duration}s`, '--flow-delay': `${-(data?.lane ?? 0) * .7}s` } as CSSProperties;

  return (
    <g
      className="mapflow-block-connection"
      data-relation={data?.relation}
      data-has-focus={data?.hasFocus || undefined}
      data-source-tone={data?.sourceTone}
      data-target-tone={data?.targetTone}
      data-source-lit={data?.sourceLit}
      data-target-lit={data?.targetLit}
      style={{ ...flowStyle, '--connection-color': color } as CSSProperties}
      data-edge-type={data?.edgeType}
      aria-label={data?.relation === 'incoming' ? '直接前置' : data?.relation === 'outgoing' ? '直接后续' : data?.edgeType === 'prerequisite' ? '学习依赖' : '知识关联'}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={route.start.x} y1={route.start.y} x2={route.end.x} y2={route.end.y}>
          <stop offset="25%" stopColor={sourceColor} /><stop offset="85%" stopColor={targetColor} />
        </linearGradient>
        <marker id={markerId} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill={targetColor} />
        </marker>
      </defs>
      {highlighted && <path d={route.path} className="mapflow-connection-outline" />}
      <path d={route.path} className="mapflow-connection-line" markerEnd={`url(#${markerId})`} />
      {data?.sourceLit !== false && <><path d={route.path} className="mapflow-connection-flow mapflow-connection-flow--tail" strokeDasharray={`24 ${Math.max(1, route.length - 24)}`} />
      <path d={route.path} className="mapflow-connection-flow mapflow-connection-flow--head" strokeDasharray={`6 ${Math.max(1, route.length - 6)}`} style={{ '--flow-start': '-18px' } as CSSProperties} />
      <path d={route.path} className="mapflow-connection-flow mapflow-connection-flow--core" strokeDasharray={`6 ${Math.max(1, route.length - 6)}`} style={{ '--flow-start': '-18px' } as CSSProperties} /></>}
      <circle data-port="source" cx={route.start.x} cy={route.start.y} r={highlighted ? 3.5 : 2.5} className="mapflow-connection-port" style={{ fill: sourceColor }} />
      <circle data-port="target" cx={route.end.x} cy={route.end.y} r={highlighted ? 3.5 : 2.5} className="mapflow-connection-port" style={{ fill: targetColor }} />
    </g>
  );
}

export default memo(BlockConnectionEdge);
