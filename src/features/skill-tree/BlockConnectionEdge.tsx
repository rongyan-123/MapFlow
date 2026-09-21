import { memo, useId, useMemo, type CSSProperties } from 'react';
import { useNodes, type EdgeProps } from '@xyflow/react';
import { getBlockConnectionRoute, type BlockConnection } from './blockConnections';
import { BLOCK_NODE_HEIGHT, BLOCK_NODE_WIDTH } from './layoutBlocks';

function BlockConnectionEdge({ source, target, data }: EdgeProps<BlockConnection>) {
  const nodes = useNodes();
  const markerId = `connection-arrow-${useId().replace(/:/g, '')}`;
  const route = useMemo(() => {
    const cards = nodes.filter((node) => node.type === 'skill').map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? BLOCK_NODE_WIDTH,
      height: node.measured?.height ?? BLOCK_NODE_HEIGHT,
    }));
    const sourceCard = cards.find((node) => node.id === source);
    const targetCard = cards.find((node) => node.id === target);
    if (!sourceCard || !targetCard) return null;
    return getBlockConnectionRoute(sourceCard, targetCard, cards.filter((node) => node.id !== source && node.id !== target), data?.lane);
  }, [nodes, source, target, data?.lane]);
  if (!route) return null;
  const color = data?.relation === 'incoming' ? '#22d3ee' : '#c084fc';

  return (
    <g
      className="mapflow-block-connection"
      data-relation={data?.relation}
      style={{ '--connection-color': color, '--flow-delay': `${-(data?.lane ?? 0) * 0.23}s` } as CSSProperties}
      aria-label={data?.relation === 'incoming' ? '前置节点流入' : '流向后置节点'}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 1 1 L 11 6 L 1 11 L 4 6 Z" fill={color} />
        </marker>
      </defs>
      <path d={route.path} className="mapflow-connection-halo" />
      <path d={route.path} className="mapflow-connection-outline" />
      <path d={route.path} className="mapflow-connection-line" markerEnd={`url(#${markerId})`} />
      <path d={route.path} className="mapflow-connection-flow" />
      <circle cx={route.start.x} cy={route.start.y} r="4" className="mapflow-connection-port" />
      <circle cx={route.end.x} cy={route.end.y} r="3" className="mapflow-connection-port" />
    </g>
  );
}

export default memo(BlockConnectionEdge);
