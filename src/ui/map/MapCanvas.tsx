import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
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
  BLOCK_NODE_HEIGHT,
  BLOCK_NODE_WIDTH,
  computeBlockLayoutModel,
  type BlockLayoutModel,
} from '../../domains/maps/layoutBlocks';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './MapNode';
import { getReadableInitialZoom,getStartingViewport } from '../../domains/maps/viewport';
import BlockConnectionEdge from './BlockConnectionEdge';
import { buildBlockConnections } from '../../domains/maps/blockConnections';

interface BlockLaneData extends Record<string, unknown> {
  name: string;
  description: string | null;
  color: string | null;
}

type BlockLaneFlowNode = Node<BlockLaneData, 'block'>;

function BlockLaneComponent({data}:NodeProps<BlockLaneFlowNode>){
  const accent=data.color??'var(--mf-map-incoming)';const labelOffset=BLOCK_LABEL_WIDTH+BLOCK_LABEL_GAP;
  return <div data-mapflow-block-lane="true" className="mf-block-lane" style={{'--lane-accent':accent} as CSSProperties}>
    <div className="mf-block-lane-area" style={{left:labelOffset}} />
    <div className="mf-block-lane-label" style={{width:BLOCK_LABEL_WIDTH}}><span /><strong title={data.name}>{data.name}</strong></div>
    <span className="mf-block-lane-link" style={{left:BLOCK_LABEL_WIDTH,width:BLOCK_LABEL_GAP}} />
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
        selected: node.id === selectedNodeId,
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
      selectedNodeId,
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
            style: { stroke: 'var(--mf-map-edge)', strokeWidth: 1.8 },
          };
        }
        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: completed || mastered,
          style: {
            stroke: mastered ? 'var(--mf-map-mastery)' : completed ? 'var(--mf-map-complete)' : 'var(--mf-map-edge)',
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
  const containerRef=useRef<HTMLDivElement>(null);
  const canvasSize=()=>({width:containerRef.current?.clientWidth||window.innerWidth,height:containerRef.current?.clientHeight||window.innerHeight});
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let previous = canvasSize();
    const observer = new ResizeObserver(() => {
      const next = canvasSize();
      const flow = flowRef.current;
      if (flow && previous.width > 0 && previous.height > 0 && (next.width !== previous.width || next.height !== previous.height)) {
        const viewport = flow.getViewport();
        void flow.setViewport({ ...viewport, x: viewport.x + (next.width - previous.width) / 2, y: viewport.y + (next.height - previous.height) / 2 }, { duration: 0 });
      }
      previous = next;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
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
    const selectedNode = generatedNodes.find(node => node.type === 'skill' && node.id === selectedNodeId);
    const remembered = readMapViewport(viewportKey, layoutKey,canvasSize());
    if (remembered && !selectedNode) { void flow.setViewport(remembered, { duration: 0 }); return; }
    const startingNode=selectedNode?.id??snapshot.current_node_id??generatedNodes.filter(node=>node.type==='skill').sort((first,second)=>first.position.y-second.position.y||first.position.x-second.position.x)[0]?.id;

    void flow
      .fitView({
        nodes:
          (layoutMode === 'relationship' || selectedNode) && startingNode
            ? [{ id: startingNode }]
            : undefined,
        padding: layoutMode === 'blocks' ? 0.2 : 0.18,
        maxZoom: layoutMode === 'blocks' ? 1 : 1.15,
        duration: 0,
      })
      .then((didFit) => {
        if (!didFit || layoutMode !== 'relationship') return;
        const fittedZoom = flow.getZoom();
        const readableZoom = getReadableInitialZoom(fittedZoom);
        const starting=generatedNodes.find(node=>node.id===startingNode);
        if(starting)void flow.setViewport(getStartingViewport(canvasSize(),starting.position,readableZoom),{duration:0});
      });
  }, [generatedNodes, layoutMode, selectedNodeId, snapshot.current_node_id, viewportKey, layoutKey]);

  function selectAndCenterNode(node: SkillFlowNode | BlockLaneFlowNode) {
    if (node.type !== 'skill') return;
    onSelectNode(node.id);
    const flow = flowRef.current;
    window.requestAnimationFrame(() => {
      if (!flow || flowRef.current !== flow || !containerRef.current?.isConnected) return;
      const size = canvasSize();
      const zoom = flow.getZoom();
      void flow.setViewport({
        x: size.width / 2 - (node.position.x + BLOCK_NODE_WIDTH / 2) * zoom,
        y: size.height / 2 - (node.position.y + BLOCK_NODE_HEIGHT / 2) * zoom,
        zoom,
      }, { duration: 0 });
    });
  }

  return (
    <ReactFlow
      ref={containerRef}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => selectAndCenterNode(node)}
      onKeyDown={event => {
        if ((event.key !== 'Enter' && event.key !== ' ') || !(event.target instanceof HTMLElement)) return;
        const nodeElement = event.target.closest<HTMLElement>('.react-flow__node-skill');
        const node = nodes.find(item => item.id === nodeElement?.dataset.id);
        if (node) { event.preventDefault(); selectAndCenterNode(node); }
      }}
      onMoveEnd={(_, viewport) => {
        if (!viewportKey) return;
        try { localStorage.setItem(viewportKey, JSON.stringify({ layoutKey, viewport,canvas:canvasSize() })); }
        catch { /* Viewport preferences are optional and never affect server-owned map data. */ }
      }}
      onInit={(instance) => {
        flowRef.current = instance;
      }}
      minZoom={0.1}
      maxZoom={2.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
      ariaLabelConfig={{'controls.ariaLabel':'地图操作','controls.zoomIn.ariaLabel':'放大地图','controls.zoomOut.ariaLabel':'缩小地图','controls.fitView.ariaLabel':'显示整张地图','controls.interactive.ariaLabel':'切换地图拖动','minimap.ariaLabel':'地图总览'}}
    >
      {layoutMode === 'blocks' && selectedNodeId && <div className="mf-map-legend"><span>前置流入</span><span>→ 选中节点 →</span><span>后置流出</span></div>}
      <FitViewWhenReady
        fitGraphView={fitGraphView}
        fitViewKey={fitViewKey}
        isGraphVisible={isGraphVisible}
      />
      <Background color="var(--mf-map-edge)" gap={24} size={.8} />
      <Controls className="mf-flow-controls" />
      <MiniMap
        nodeColor={(node) => {
          if (node.type === 'block') {
            return (node.data as BlockLaneData).color ?? 'var(--mf-map-edge)';
          }
          if (displayMode === 'showcase') return 'var(--mf-map-incoming)';
          const flowNode = node as SkillFlowNode;
          const status = flowNode.data.progress?.status ?? 'not_started';
          if (status === 'mastered') return 'var(--mf-map-mastery)';
          if (status === 'completed') return 'var(--mf-map-complete)';
          if (status === 'in_progress') return 'var(--mf-map-active)';
          return 'var(--mf-map-edge)';
        }}
        maskColor="color-mix(in srgb, var(--mf-map-paper) 75%, transparent)"
        className="mf-flow-minimap"
      />
    </ReactFlow>
  );
}

function readMapViewport(storageKey: string | undefined, layoutKey: string,canvas:{width:number;height:number}): Viewport | null {
  if (!storageKey) return null;
  try {
    const serialized = localStorage.getItem(storageKey);
    if (!serialized) return null;
    const saved = JSON.parse(serialized) as { layoutKey?: unknown; viewport?: Partial<Viewport>;canvas?:{width:number;height:number} } | null;
    const viewport = saved?.viewport;
    return saved?.layoutKey === layoutKey && viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y)
      && typeof viewport.zoom === 'number' && viewport.zoom >= 0.1 && viewport.zoom <= 2.5&&saved.canvas&&Number.isFinite(saved.canvas.width)&&saved.canvas.width>0&&Number.isFinite(saved.canvas.height)&&saved.canvas.height>0 ? {x:viewport.x!+(canvas.width-saved.canvas.width)/2,y:viewport.y!+(canvas.height-saved.canvas.height)/2,zoom:viewport.zoom} : null;
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
