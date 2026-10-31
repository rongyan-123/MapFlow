import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  progressPercentForNode,
} from '../../types/learning';
import {
  Background,
  BackgroundVariant,
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
import { getNodeReadiness } from '../../domains/maps/nodeReadiness';
import { getBranchTone, getNodeBranches } from '../../domains/maps/branchColors';
import { observeMapAnimations, type MapAnimationController } from './mapAnimations';
import { computeLearningGroupLayout, computeLearningNodeLayout } from '../../domains/maps/learningGroupLayout';
import LearningGroupComponent, { type LearningGroupFlowNode } from './LearningGroupNode';

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
  learningGroup: LearningGroupComponent,
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
  condensed?: boolean;
}

export default function SkillTreeCanvas({
  snapshot,
  displayMode,
  layoutMode,
  selectedNodeId,
  isGraphVisible,
  onSelectNode,
  viewportStorageKey,
  condensed = true,
}: SkillTreeCanvasProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [closingGroups, setClosingGroups] = useState<Set<string>>(() => new Set());
  const closingTimers = useRef(new Map<string, number>());
  const grouped = condensed && layoutMode === 'relationship' && snapshot.tree.generation_version === 2 && !!snapshot.learning_groups?.length;
  const toggleGroup = useCallback((id: string) => {
    const timer = closingTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    closingTimers.current.delete(id);
    if (!expandedGroups.has(id) || closingGroups.has(id)) {
      setClosingGroups(current => new Set([...current].filter(groupId => groupId !== id)));
      setExpandedGroups(current => new Set(current).add(id));
    } else {
      setClosingGroups(current => new Set(current).add(id));
      const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 260;
      closingTimers.current.set(id, window.setTimeout(() => {
        closingTimers.current.delete(id);
        setClosingGroups(current => new Set([...current].filter(groupId => groupId !== id)));
        setExpandedGroups(current => new Set([...current].filter(groupId => groupId !== id)));
      }, delay));
    }
  }, [expandedGroups, closingGroups]);
  useEffect(() => {
    setExpandedGroups(new Set());setClosingGroups(new Set());
    return () => {for (const timer of closingTimers.current.values()) window.clearTimeout(timer);closingTimers.current.clear();};
  }, [snapshot.tree.id]);
  useEffect(() => {
    if (!isGraphVisible) return;
    const group = snapshot.learning_groups?.find(group => group.node_ids.includes(selectedNodeId ?? snapshot.current_node_id ?? ''));
    if (!group) return;
    const timer = closingTimers.current.get(group.group_id);
    if (timer !== undefined) window.clearTimeout(timer);
    closingTimers.current.delete(group.group_id);
    setClosingGroups(current => new Set([...current].filter(id => id !== group.group_id)));
    setExpandedGroups(current => new Set(current).add(group.group_id));
  }, [selectedNodeId, snapshot.current_node_id, snapshot.tree.id, snapshot.learning_groups, isGraphVisible]);
  const groupLayout = useMemo(() => grouped ? computeLearningGroupLayout(snapshot, expandedGroups) : null,
    [grouped, snapshot.nodes, snapshot.edges, snapshot.learning_groups, snapshot.tree.generation_version, expandedGroups]);
  const branches = useMemo(() => getNodeBranches(snapshot), [snapshot.nodes, snapshot.blocks, snapshot.node_block_assignments, snapshot.tree.id]);
  const progressMap = useMemo(
    () => new Map(snapshot.progress.map((item) => [item.node_id, item])),
    [snapshot.progress],
  );
  const litNodes = useMemo(() => displayMode === 'personal'
    ? new Set(snapshot.nodes.filter(node => progressPercentForNode(progressMap.get(node.id)) === 100).map(node => node.id))
    : undefined, [displayMode, snapshot.nodes, progressMap]);
  const readiness = useMemo(
    () => getNodeReadiness(snapshot.nodes.map(node => node.id), snapshot.edges, snapshot.progress),
    [snapshot.nodes, snapshot.edges, snapshot.progress],
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
        snapshot.tree.generation_version === 2,
      ),
    [
      snapshot.blocks,
      snapshot.edges,
      snapshot.node_block_assignments,
      snapshot.nodes,
      snapshot.tree.generation_version,
    ],
  );
  const positions = useMemo(() => {
    if (groupLayout) return groupLayout.positions;
    if (layoutMode === 'blocks' && blockLayout.positions.size > 0) {
      return blockLayout.positions;
    }
    return snapshot.tree.generation_version === 2 ? computeLearningNodeLayout(snapshot.nodes, snapshot.edges) : computeTreeLayout(snapshot.nodes, snapshot.edges);
  }, [groupLayout, blockLayout.positions, layoutMode, snapshot.edges, snapshot.nodes, snapshot.tree.generation_version]);
  const visibleBranches = useMemo(() => {
    const visible = new Map(branches);
    for (const group of groupLayout?.groups ?? []) {
      const branch = branches.get(group.group.node_ids[0]);
      if (branch) visible.set(group.id, branch);
    }
    return visible;
  }, [branches, groupLayout]);
  const visibleLitNodes = useMemo(() => {
    if (!litNodes) return undefined;
    const visible = new Set(litNodes);
    for (const group of groupLayout?.groups ?? []) if (group.group.node_ids.every(id => litNodes.has(id))) visible.add(group.id);
    return visible;
  }, [litNodes, groupLayout]);
  const blockConnections = useMemo(
    () => buildBlockConnections(groupLayout?.edges ?? snapshot.edges, selectedNodeId, layoutMode, visibleBranches, visibleLitNodes, positions,
      groupLayout ? new Set(groupLayout.edges.filter(edge=>groupLayout.ownerByNodeId.has(edge.source_node_id)&&groupLayout.ownerByNodeId.get(edge.source_node_id)===groupLayout.ownerByNodeId.get(edge.target_node_id)).map(edge=>edge.id)) : undefined),
    [snapshot.edges, groupLayout, selectedNodeId, layoutMode, visibleBranches, visibleLitNodes, positions],
  );
  const connectionRoles = useMemo(() => {
    const roles = new Map<string, 'focus' | 'incoming' | 'outgoing'>();
    if (!selectedNodeId) return roles;
    for (const edge of blockConnections) {
      if (edge.data?.relation === 'incoming') roles.set(edge.source, 'incoming');
      if (edge.data?.relation === 'outgoing') roles.set(edge.target, 'outgoing');
    }
    roles.set(selectedNodeId, 'focus');
    return roles;
  }, [blockConnections, layoutMode, selectedNodeId]);
  const generatedNodes = useMemo<
    Array<SkillFlowNode | BlockLaneFlowNode | LearningGroupFlowNode>
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
                color: `var(--mf-branch-${getBranchTone(`block:${lane.blockId}`)})`,
              },
            }))
          : [];
      const skills: SkillFlowNode[] = snapshot.nodes.filter(node => !groupLayout || groupLayout.visibleNodeIds.has(node.id)).map((node) => ({
        id: node.id,
        type: 'skill',
        position: positions.get(node.id) ?? {
          x: node.position_x,
          y: node.position_y,
        },
        zIndex: 1,
        selected: node.id === selectedNodeId,
        draggable: !grouped,
        className: groupLayout?.ownerByNodeId.has(node.id) ? (closingGroups.has(groupLayout.ownerByNodeId.get(node.id)!) ? 'mf-group-member mf-group-member--closing' : 'mf-group-member') : undefined,
        data: {
          node,
          progress: progressMap.get(node.id) ?? null,
          ready: readiness.get(node.id) ?? true,
          branchTone: branches.get(node.id)?.tone,
          isCurrent: node.id === snapshot.current_node_id,
          displayMode,
          layoutMode,
          connectionRole: connectionRoles.get(node.id),
          // 块模式由泳道统一标注，避免每个节点重复显示块名造成拥挤。
          blockName:
            layoutMode === 'blocks' ? undefined : blockNameByNodeId.get(node.id),
        },
      }));
      const groups: LearningGroupFlowNode[] = (groupLayout?.groups ?? []).map(group => ({
        id:group.id,type:'learningGroup',position:group.position,width:group.width,height:group.height,
        zIndex:0,draggable:false,selectable:false,style:{width:group.width,height:group.height},
        data:{title:group.group.title,count:group.group.node_ids.length,expanded:group.expanded&&!closingGroups.has(group.group.group_id),frameExpanded:group.expanded,
          percent:group.group.node_ids.every(id=>progressPercentForNode(progressMap.get(id))===100) ? 100
            : Math.min(99,Math.round(group.group.node_ids.reduce((sum,id)=>sum+progressPercentForNode(progressMap.get(id)),0)/group.group.node_ids.length)),
          readyCount:group.group.node_ids.filter(id=>readiness.get(id)&&progressPercentForNode(progressMap.get(id))<100).length,
          displayMode,branchTone:visibleBranches.get(group.id)?.tone,onToggle:()=>toggleGroup(group.group.group_id)},
      }));
      return [...lanes, ...groups, ...skills];
    },
    [
      blockLayout.lanes,
      branches,
      blockNameByNodeId,
      connectionRoles,
      displayMode,
      layoutMode,
      positions,
      progressMap,
      readiness,
      snapshot.current_node_id,
      snapshot.nodes,
      selectedNodeId,
      groupLayout, grouped, closingGroups, visibleBranches, toggleGroup,
    ],
  );
  const generatedEdges = useMemo(() => blockConnections.map(edge => ({...edge,
    className: grouped ? 'mf-group-connection' : undefined,
    data: {...edge.data!, closing: [edge.source,edge.target].some(id=>closingGroups.has(groupLayout?.ownerByNodeId.get(id)??''))},
  })), [blockConnections, grouped, closingGroups, groupLayout]);

  const [nodes, setNodes, onNodesChange] = useNodesState<
    SkillFlowNode | BlockLaneFlowNode | LearningGroupFlowNode
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowRef = useRef<ReactFlowInstance<SkillFlowNode | BlockLaneFlowNode | LearningGroupFlowNode> | null>(
    null,
  );
  const containerRef=useRef<HTMLDivElement>(null);
  const animationControllerRef = useRef<MapAnimationController | null>(null);
  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;
    const controller = observeMapAnimations(canvas);
    animationControllerRef.current = controller;
    return () => {
      animationControllerRef.current = null;
      controller.dispose();
    };
  }, []);
  const canvasSize=()=>({width:containerRef.current?.clientWidth||window.innerWidth,height:containerRef.current?.clientHeight||window.innerHeight});
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isGraphVisible || typeof ResizeObserver === 'undefined') return;
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
  }, [isGraphVisible]);
  const baseLayoutKey = `${snapshot.tree.id}:${snapshot.tree.revision ?? 0}:${layoutMode}`;
  const layoutKey = snapshot.tree.generation_version === 2 ? `${baseLayoutKey}:${grouped?'condensed':'full'}` : baseLayoutKey;
  const shapeKey = grouped ? `${layoutKey}:${JSON.stringify([...expandedGroups].sort())}` : layoutKey;
  const fitViewKey = `${viewportStorageKey ?? ''}:${layoutKey}:${snapshot.current_node_id ?? ''}`;
  const viewportKey = viewportStorageKey ? `${viewportStorageKey}.${layoutMode}` : undefined;
  const previousLayoutKeyRef = useRef<string | null>(null);
  const previousTransitionKey = useRef(shapeKey);
  const [layoutMoving, setLayoutMoving] = useState(false);
  useLayoutEffect(() => {
    const changed = previousTransitionKey.current !== shapeKey;
    previousTransitionKey.current = shapeKey;
    if (!changed || !grouped || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setLayoutMoving(false);
      return;
    }
    // Routes use final coordinates. Reveal them once the cards reach those coordinates.
    setLayoutMoving(true);
    const timer = window.setTimeout(() => setLayoutMoving(false), 340);
    return () => window.clearTimeout(timer);
  }, [shapeKey, grouped]);

  useEffect(() => {
    const layoutChanged = previousLayoutKeyRef.current !== shapeKey;
    previousLayoutKeyRef.current = shapeKey;
    setNodes((existingNodes) => {
      const existingById = new Map(existingNodes.map(node => [node.id, node]));
      return generatedNodes.map(node => {
        const previous = existingById.get(node.id);
        const sameSize = previous && previous.type === node.type && previous.width === node.width && previous.height === node.height;
        return {
          ...node,
          ...(sameSize ? { measured: previous.measured } : {}),
          position: !layoutChanged && previous ? previous.position : node.position,
        };
      });
    });
  }, [generatedNodes, shapeKey, setNodes]);

  useEffect(() => {
    setEdges(generatedEdges);
  }, [generatedEdges, setEdges]);

  const fitGraphView = useCallback(() => {
    const flow = flowRef.current;
    if (!flow || generatedNodes.length === 0) return;
    const selectedNode = generatedNodes.find(node => node.type === 'skill' && node.id === selectedNodeId);
    const remembered = readMapViewport(viewportKey, shapeKey,canvasSize());
    if (remembered && !selectedNode) { void flow.setViewport(remembered, { duration: 0 }); return; }
    const startingNode=selectedNode?.id??(generatedNodes.some(node=>node.id===snapshot.current_node_id)?snapshot.current_node_id:null)??generatedNodes.filter(node=>node.type!=='block').sort((first,second)=>first.position.y-second.position.y||first.position.x-second.position.x)[0]?.id;

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
  }, [generatedNodes, layoutMode, selectedNodeId, snapshot.current_node_id, viewportKey, shapeKey]);

  const lastLocatedSelection = useRef<string | null>(null);
  useEffect(() => {
    if (snapshot.tree.generation_version !== 2) return;
    if (!selectedNodeId || !isGraphVisible) {lastLocatedSelection.current=null;return;}
    if (lastLocatedSelection.current===selectedNodeId || !nodes.some(node=>node.type==='skill'&&node.id===selectedNodeId)) return;
    const point=positions.get(selectedNodeId); const flow=flowRef.current;
    if (!point||!flow) return;
    lastLocatedSelection.current=selectedNodeId;
    const size=canvasSize(),zoom=flow.getZoom();
    void flow.setViewport({x:size.width/2-(point.x+120)*zoom,y:size.height/2-(point.y+52)*zoom,zoom},{duration:0});
  }, [selectedNodeId,nodes,positions,snapshot.tree.generation_version,isGraphVisible]);

  function selectAndCenterNode(node: SkillFlowNode | BlockLaneFlowNode | LearningGroupFlowNode) {
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
      className={grouped?'mf-inline-groups':undefined}
      data-mapflow-layout-moving={layoutMoving || undefined}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onMoveStart={() => animationControllerRef.current?.setMoving(true)}
      onMove={event => {
        const panning = event?.type === 'touchmove'
          ? 'touches' in event && event.touches.length === 1
          : Boolean(event && (event.type === 'mousemove' || event.type === 'pointermove') && 'buttons' in event && event.buttons > 0);
        animationControllerRef.current?.setPanning(panning);
      }}
      onNodeDragStart={() => animationControllerRef.current?.setMoving(true, 'node')}
      onNodeDragStop={() => animationControllerRef.current?.setMoving(false, 'node')}
      onNodeClick={(_, node) => selectAndCenterNode(node)}
      onKeyDown={event => {
        if ((event.key !== 'Enter' && event.key !== ' ') || !(event.target instanceof HTMLElement)) return;
        const nodeElement = event.target.closest<HTMLElement>('.react-flow__node-skill');
        const node = nodes.find(item => item.id === nodeElement?.dataset.id);
        if (node) { event.preventDefault(); selectAndCenterNode(node); }
      }}
      onMoveEnd={(_, viewport) => {
        animationControllerRef.current?.setPanning(false);
        animationControllerRef.current?.setMoving(false);
        if (!viewportKey || !isGraphVisible) return;
        try { localStorage.setItem(viewportKey, JSON.stringify({ layoutKey:shapeKey, viewport,canvas:canvasSize() })); }
        catch { /* Viewport preferences are optional and never affect server-owned map data. */ }
      }}
      onInit={(instance) => {
        flowRef.current = instance;
      }}
      minZoom={0.1}
      maxZoom={2.5}
      defaultEdgeOptions={{ type: 'blockConnection' }}
      proOptions={{ hideAttribution: true }}
      ariaLabelConfig={{'controls.ariaLabel':'地图操作','controls.zoomIn.ariaLabel':'放大地图','controls.zoomOut.ariaLabel':'缩小地图','controls.fitView.ariaLabel':'显示整张地图','controls.interactive.ariaLabel':'切换地图拖动','minimap.ariaLabel':'地图总览'}}
    >
      {groupLayout?.invalidGroups && <p className="mf-map-legend" role="status">收纳信息需要整理，已展示全部知识点。</p>}
      {selectedNodeId && <div className="mf-map-legend"><span>虚线：直接前置</span><span>→ 选中节点 →</span><span>实线：直接后续</span></div>}
      <FitViewWhenReady
        fitGraphView={fitGraphView}
        fitViewKey={fitViewKey}
        isGraphVisible={isGraphVisible}
      />
      <Background variant={BackgroundVariant.Lines} color="color-mix(in srgb, var(--mf-map-edge) 30%, transparent)" gap={24} size={.8} />
      <Controls className="mf-flow-controls" />
      <MiniMap
        nodeColor={(node) => {
          if (node.type === 'block') {
            return (node.data as BlockLaneData).color ?? 'var(--mf-map-edge)';
          }
          if (node.type === 'learningGroup') {
            const group=node as LearningGroupFlowNode;
            return displayMode==='personal'&&group.data.percent<100?'var(--mf-map-unlit-accent)':`var(--mf-branch-${group.data.branchTone??'blue'})`;
          }
          const flowNode = node as SkillFlowNode;
          if (displayMode === 'personal' && progressPercentForNode(flowNode.data.progress) < 100) return 'var(--mf-map-unlit-accent)';
          return `var(--mf-branch-${flowNode.data.branchTone??'blue'})`;
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
  const lastFittedViewKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || !isGraphVisible || lastFittedViewKeyRef.current === fitViewKey) return;
    const timer = window.setTimeout(() => {
      lastFittedViewKeyRef.current = fitViewKey;
      fitGraphView();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fitGraphView, fitViewKey, isGraphVisible, nodesInitialized]);

  return null;
}
