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
} from '@xyflow/react';
import type {
  LearningTreeSnapshot,
  TreeLayoutMode,
  TreeDisplayMode,
} from '../../types/learning';
import { computeTreeLayout } from './layoutTree';
import {
  BLOCK_LABEL_GAP,
  BLOCK_LABEL_WIDTH,
  computeBlockLayoutModel,
  type BlockLayoutModel,
} from './layoutBlocks';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './SkillNode';
import { getReadableInitialZoom } from './viewport';

interface BlockLaneData extends Record<string, unknown> {
  name: string;
  description: string | null;
  color: string | null;
}

type BlockLaneFlowNode = Node<BlockLaneData, 'block'>;

function BlockLaneComponent({ data }: NodeProps<BlockLaneFlowNode>) {
  const accent = data.color ?? '#38bdf8';
  const labelOffset = BLOCK_LABEL_WIDTH + BLOCK_LABEL_GAP;

  return (
    <div
      data-mapflow-block-lane="true"
      className="pointer-events-none relative h-full w-full"
    >
      <div
        className="absolute inset-y-0 right-0 rounded-2xl border border-dashed bg-slate-950/35"
        style={{
          left: labelOffset,
          borderColor: `${accent}88`,
          boxShadow: `inset 0 0 32px ${accent}12`,
        }}
      />
      <div
        className="absolute top-1/2 flex -translate-y-1/2 items-center gap-3 rounded-xl border bg-slate-900 px-4 py-3 shadow-[0_8px_24px_rgba(2,6,23,0.35)]"
        style={{
          left: 0,
          width: BLOCK_LABEL_WIDTH,
          borderColor: `${accent}88`,
        }}
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}` }}
        />
        <div className="min-w-0 truncate text-sm font-semibold text-slate-100">
          {data.name}
        </div>
      </div>
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-px -translate-y-1/2"
        style={{
          left: BLOCK_LABEL_WIDTH,
          width: BLOCK_LABEL_GAP,
          backgroundColor: `${accent}88`,
        }}
      />
    </div>
  );
}

const nodeTypes = {
  skill: SkillNodeComponent,
  block: BlockLaneComponent,
};

interface SkillTreeCanvasProps {
  snapshot: LearningTreeSnapshot;
  displayMode: TreeDisplayMode;
  layoutMode: TreeLayoutMode;
  selectedNodeId: string | null;
  isGraphVisible: boolean;
  onSelectNode: (nodeId: string) => void;
}

export default function SkillTreeCanvas({
  snapshot,
  displayMode,
  layoutMode,
  selectedNodeId,
  isGraphVisible,
  onSelectNode,
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
      const visibleEdges =
        layoutMode === 'blocks' && !selectedNodeId
          ? []
          : layoutMode === 'blocks'
            ? snapshot.edges.filter(
                (edge) =>
                  edge.source_node_id === selectedNodeId ||
                  edge.target_node_id === selectedNodeId,
              )
            : snapshot.edges;
      return visibleEdges.map((edge) => {
        const sourceStatus = progressMap.get(edge.source_node_id)?.status;
        const mastered = sourceStatus === 'mastered';
        const completed = sourceStatus === 'completed';
        if (displayMode === 'showcase') {
          return {
            id: edge.id,
            source: edge.source_node_id,
            target: edge.target_node_id,
            type: 'smoothstep',
            style: { stroke: '#22d3ee', strokeWidth: 1.8 },
          };
        }
        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'smoothstep',
          animated: completed || mastered,
          style: {
            stroke: mastered ? '#facc15' : completed ? '#34d399' : '#334155',
            strokeWidth: completed || mastered ? 2 : 1.2,
          },
        };
      });
    },
    [displayMode, layoutMode, progressMap, selectedNodeId, snapshot.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<
    SkillFlowNode | BlockLaneFlowNode
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowRef = useRef<ReactFlowInstance<SkillFlowNode | BlockLaneFlowNode> | null>(
    null,
  );
  const layoutKey = `${snapshot.tree.id}:${snapshot.tree.revision ?? 0}:${layoutMode}`;
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
  }, [generatedNodes.length, layoutMode, snapshot.current_node_id]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onInit={(instance) => {
        flowRef.current = instance;
      }}
      minZoom={0.1}
      maxZoom={2.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
    >
      <FitViewWhenReady
        fitGraphView={fitGraphView}
        isGraphVisible={isGraphVisible}
        layoutKey={layoutKey}
      />
      <Background color="#1e293b" gap={20} />
      <Controls className="!rounded-lg !border-slate-700 !bg-slate-900" />
      <MiniMap
        nodeColor={(node) => {
          if (node.type === 'block') {
            return (node.data as BlockLaneData).color ?? '#1e293b';
          }
          if (displayMode === 'showcase') return '#22d3ee';
          const flowNode = node as SkillFlowNode;
          const status = flowNode.data.progress?.status ?? 'not_started';
          if (status === 'mastered') return '#facc15';
          if (status === 'completed') return '#34d399';
          if (status === 'in_progress') return '#fbbf24';
          return '#334155';
        }}
        maskColor="rgba(2, 6, 23, 0.78)"
        className="!border-slate-700 !bg-slate-950"
      />
    </ReactFlow>
  );
}

interface FitViewWhenReadyProps {
  fitGraphView: () => void;
  isGraphVisible: boolean;
  layoutKey: string;
}

function FitViewWhenReady({
  fitGraphView,
  isGraphVisible,
  layoutKey,
}: FitViewWhenReadyProps) {
  const nodesInitialized = useNodesInitialized();
  const previousGraphVisibleRef = useRef(false);

  useEffect(() => {
    if (!nodesInitialized) return;

    const timer = window.setTimeout(fitGraphView, 0);
    return () => window.clearTimeout(timer);
  }, [fitGraphView, layoutKey, nodesInitialized]);

  useEffect(() => {
    const wasVisible = previousGraphVisibleRef.current;
    previousGraphVisibleRef.current = isGraphVisible;
    if (!nodesInitialized || !isGraphVisible || wasVisible) return;

    const timer = window.setTimeout(fitGraphView, 0);
    return () => window.clearTimeout(timer);
  }, [fitGraphView, isGraphVisible, nodesInitialized]);

  return null;
}
