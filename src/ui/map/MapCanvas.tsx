import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import type {
  LearningTreeSnapshot,
  TreeLayoutMode,
  TreeDisplayMode,
} from '../../types/learning';
import { computeTreeLayout } from '../../domains/maps/layoutTree';
import {
  BLOCK_LABEL_GAP,
  BLOCK_LABEL_WIDTH,
  computeBlockLayoutModel,
  type BlockLayoutModel,
} from '../../domains/maps/layoutBlocks';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './MapNode';
import { getReadableInitialZoom } from '../../domains/maps/viewport';
import BlockConnectionEdge from './BlockConnectionEdge';
import { buildBlockConnections } from '../../domains/maps/blockConnections';

interface BlockLaneData extends Record<string, unknown> {
  name: string;
  description: string | null;
  color: string | null;
}

type BlockLaneFlowNode = Node<BlockLaneData, 'block'>;

function BlockLaneComponent({data}:NodeProps<BlockLaneFlowNode>){
  const accent=data.color??'var(--mf-brand)';const labelOffset=BLOCK_LABEL_WIDTH+BLOCK_LABEL_GAP;
  return <div data-mapflow-block-lane="true" className="mf-block-lane">
    <div className="mf-block-lane-area" style={{left:labelOffset,borderColor:accent}} />
    <div className="mf-block-lane-label" style={{width:BLOCK_LABEL_WIDTH,borderColor:accent}}><span style={{backgroundColor:accent}} /><strong title={data.name}>{data.name}</strong></div>
    <span className="mf-block-lane-link" style={{left:BLOCK_LABEL_WIDTH,width:BLOCK_LABEL_GAP,backgroundColor:accent}} />
  </div>;
}

const nodeTypes = {
  skill: SkillNodeComponent,
  block: BlockLaneComponent,
};
const edgeTypes = { blockConnection: BlockConnectionEdge };

interface SkillTreeCanvasProps {
  snapshot: LearningTreeSnapshot;
  displayMode: TreeDisplayMode;
  layoutMode: TreeLayoutMode;
  selectedNodeId: string | null;
  isGraphVisible: boolean;
  onSelectNode: (nodeId: string) => void;
  viewportStorageKey?: string;
}

export default function SkillTreeCanvas({
  snapshot,
  displayMode,
  layoutMode,
  selectedNodeId,
  isGraphVisible,
  onSelectNode,
  viewportStorageKey,
}: SkillTreeCanvasProps) {
  const progressMap = useMemo(
    () => new Map(snapshot.progress.map((item) => [item.node_id, item])),
    [snapshot.progress],
  );
  const blockNameByNodeId = useMemo(() => {
    const blockNameById = new Map(
      (snapshot.blocks ?? []).map((block) => [block.id, block.name]),
    );
    return new Map(
      (snapshot.node_block_assignments ?? [])
        .map((assignment) => [
          assignment.node_id,
          blockNameById.get(assignment.block_id),
        ])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  }, [snapshot.blocks, snapshot.node_block_assignments]);
  const blockLayout = useMemo<BlockLayoutModel>(
    () =>
      computeBlockLayoutModel(
        snapshot.nodes,
        snapshot.edges,
        snapshot.blocks ?? [],
        snapshot.node_block_assignments ?? [],
      ),
    [
      snapshot.blocks,
      snapshot.edges,
      snapshot.node_block_assignments,
      snapshot.nodes,
    ],
  );
  const positions = useMemo(() => {
    if (layoutMode === 'blocks' && blockLayout.positions.size > 0) {
      return blockLayout.positions;
    }
    return computeTreeLayout(snapshot.nodes, snapshot.edges);
  }, [blockLayout.positions, layoutMode, snapshot.edges, snapshot.nodes]);
  const blockConnections = useMemo(
    () => buildBlockConnections(snapshot.edges, selectedNodeId),
    [snapshot.edges, selectedNodeId],
  );
  const connectionRoles = useMemo(() => {
    const roles = new Map<string, 'focus' | 'incoming' | 'outgoing'>();
    if (layoutMode !== 'blocks' || !selectedNodeId) return roles;
    for (const edge of blockConnections) {
      if (edge.source !== selectedNodeId) roles.set(edge.source, 'incoming');
      if (edge.target !== selectedNodeId) roles.set(edge.target, 'outgoing');
    }
    roles.set(selectedNodeId, 'focus');
    return roles;
  }, [blockConnections, layoutMode, selectedNodeId]);
  const generatedNodes = useMemo<
    Array<SkillFlowNode | BlockLaneFlowNode>
  >(
    () => {
      const lanes: BlockLaneFlowNode[] =
        layoutMode === 'blocks'
          ? blockLayout.lanes.map((lane) => ({
              id: `block-${lane.blockId}`,
              type: 'block',
              position: { x: lane.x, y: lane.y },
              width: lane.width,
              height: lane.height,
              draggable: false,
              selectable: false,
              zIndex: 0,
              style: { pointerEvents: 'none' },
              data: {
                name: lane.name,
                description: null,
                color: lane.color,
              },
            }))
          : [];
      const skills: SkillFlowNode[] = snapshot.nodes.map((node) => ({
        id: node.id,
        type: 'skill',
        position: positions.get(node.id) ?? {
          x: node.position_x,
          y: node.position_y,
        },
        zIndex: 1,
        data: {
          node,
          progress: progressMap.get(node.id) ?? null,
          isCurrent: node.id === snapshot.current_node_id,
          displayMode,
          layoutMode,
          connectionRole: connectionRoles.get(node.id),
          // 块模式由泳道统一标注，避免每个节点重复显示块名造成拥挤。
          blockName:
            layoutMode === 'blocks' ? undefined : blockNameByNodeId.get(node.id),
        },
      }));
      return [...lanes, ...skills];
    },
    [
      blockLayout.lanes,
      blockNameByNodeId,
      connectionRoles,
      displayMode,
      layoutMode,
      positions,
      progressMap,
      snapshot.current_node_id,
      snapshot.nodes,
    ],
  );
  const generatedEdges = useMemo<Edge[]>(
    () => {
      if (layoutMode === 'blocks') return blockConnections;
      return snapshot.edges.map((edge) => {
        const sourceStatus = progressMap.get(edge.source_node_id)?.status;
        const mastered = sourceStatus === 'mastered';
        const completed = sourceStatus === 'completed';
        if (displayMode === 'showcase') {
          return {
            id: edge.id,
            source: edge.source_node_id,
            target: edge.target_node_id,
            type: 'smoothstep',
            style: { stroke: 'var(--mf-brand)', strokeWidth: 1.8 },
          };
        }
        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: completed || mastered,
          style: {
            stroke: mastered ? 'var(--mf-warning)' : completed ? 'var(--mf-brand)' : 'var(--mf-muted)',
            strokeWidth: completed || mastered ? 2 : 1.2,
          },
        };
      });
    },
    [blockConnections, displayMode, layoutMode, progressMap, snapshot.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<
    SkillFlowNode | BlockLaneFlowNode
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowRef = useRef<ReactFlowInstance<SkillFlowNode | BlockLaneFlowNode> | null>(
    null,
  );
  const layoutKey = `${snapshot.tree.id}:${snapshot.tree.revision ?? 0}:${layoutMode}`;
  const fitViewKey = `${viewportStorageKey ?? ''}:${layoutKey}:${snapshot.current_node_id ?? ''}`;
  const viewportKey = viewportStorageKey ? `${viewportStorageKey}.${layoutMode}` : undefined;
  const previousLayoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const layoutChanged = previousLayoutKeyRef.current !== layoutKey;
    previousLayoutKeyRef.current = layoutKey;
    setNodes((existingNodes) => {
      const existingPositions = new Map(
        layoutChanged
          ? []
          : existingNodes.map((node) => [node.id, node.position]),
      );
      return generatedNodes.map((node) => ({
        ...node,
        position: existingPositions.get(node.id) ?? node.position,
      }));
    });
  }, [generatedNodes, layoutKey, setNodes]);

  useEffect(() => {
    setEdges(generatedEdges);
  }, [generatedEdges, setEdges]);

  const fitGraphView = useCallback(() => {
    const flow = flowRef.current;
    if (!flow || generatedNodes.length === 0) return;
    const remembered = readMapViewport(viewportKey, layoutKey);
    if (remembered) { void flow.setViewport(remembered, { duration: 0 }); return; }

    void flow
      .fitView({
        nodes:
          layoutMode === 'relationship' && snapshot.current_node_id
            ? [{ id: snapshot.current_node_id }]
            : undefined,
        padding: layoutMode === 'blocks' ? 0.2 : 0.18,
        maxZoom: layoutMode === 'blocks' ? 1 : 1.15,
        duration: 0,
      })
      .then((didFit) => {
        if (!didFit || layoutMode !== 'relationship') return;
        const fittedZoom = flow.getZoom();
        const readableZoom = getReadableInitialZoom(fittedZoom);
        if (readableZoom > fittedZoom + 0.01) {
          void flow.zoomTo(readableZoom, { duration: 180 });
        }
      });
  }, [generatedNodes.length, layoutMode, snapshot.current_node_id, viewportKey, layoutKey]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onMoveEnd={(_, viewport) => {
        if (!viewportKey) return;
        try { localStorage.setItem(viewportKey, JSON.stringify({ layoutKey, viewport })); }
        catch { /* Viewport preferences are optional and never affect server-owned map data. */ }
      }}
      onInit={(instance) => {
        flowRef.current = instance;
      }}
      minZoom={0.1}
      maxZoom={2.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
    >
      {layoutMode === 'blocks' && selectedNodeId && <div className="mf-map-legend"><span>前置流入</span><span>→ 选中节点 →</span><span>后置流出</span></div>}
      <FitViewWhenReady
        fitGraphView={fitGraphView}
        fitViewKey={fitViewKey}
        isGraphVisible={isGraphVisible}
      />
      <Background color="var(--mf-line)" gap={24} />
      <Controls className="mf-flow-controls" />
      <MiniMap
        nodeColor={(node) => {
          if (node.type === 'block') {
            return (node.data as BlockLaneData).color ?? '#1e293b';
          }
          if (displayMode === 'showcase') return '#1b7558';
          const flowNode = node as SkillFlowNode;
          const status = flowNode.data.progress?.status ?? 'not_started';
          if (status === 'mastered') return '#facc15';
          if (status === 'completed') return '#34d399';
          if (status === 'in_progress') return '#fbbf24';
          return '#b9c9bf';
        }}
        maskColor="var(--mf-soft)"
        className="mf-flow-minimap"
      />
    </ReactFlow>
  );
}

function readMapViewport(storageKey: string | undefined, layoutKey: string): Viewport | null {
  if (!storageKey) return null;
  try {
    const serialized = localStorage.getItem(storageKey);
    if (!serialized) return null;
    const saved = JSON.parse(serialized) as { layoutKey?: unknown; viewport?: Partial<Viewport> } | null;
    const viewport = saved?.viewport;
    return saved?.layoutKey === layoutKey && viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y)
      && typeof viewport.zoom === 'number' && viewport.zoom >= 0.1 && viewport.zoom <= 2.5 ? viewport as Viewport : null;
  } catch { return null; }
}

interface FitViewWhenReadyProps {
  fitGraphView: () => void;
  fitViewKey: string;
  isGraphVisible: boolean;
}

function FitViewWhenReady({
  fitGraphView,
  fitViewKey,
  isGraphVisible,
}: FitViewWhenReadyProps) {
  const nodesInitialized = useNodesInitialized();
  const previousGraphVisibleRef = useRef(false);
  const lastFittedViewKeyRef = useRef<string | null>(null);
  const lastVisibleFittedViewKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || lastFittedViewKeyRef.current === fitViewKey) return;

    lastFittedViewKeyRef.current = fitViewKey;
    if (isGraphVisible) {
      lastVisibleFittedViewKeyRef.current = fitViewKey;
    }

    const timer = window.setTimeout(fitGraphView, 0);
    return () => window.clearTimeout(timer);
  }, [fitGraphView, fitViewKey, isGraphVisible, nodesInitialized]);

  useEffect(() => {
    const wasVisible = previousGraphVisibleRef.current;
    previousGraphVisibleRef.current = isGraphVisible;
    if (
      !nodesInitialized ||
      !isGraphVisible ||
      wasVisible ||
      lastVisibleFittedViewKeyRef.current === fitViewKey
    ) {
      return;
    }

    lastVisibleFittedViewKeyRef.current = fitViewKey;

    const timer = window.setTimeout(fitGraphView, 0);
    return () => window.clearTimeout(timer);
  }, [fitGraphView, fitViewKey, isGraphVisible, nodesInitialized]);

  return null;
}
