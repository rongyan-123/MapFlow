import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
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
  computeBlockLayoutModel,
  type BlockLayoutModel,
} from './layoutBlocks';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './SkillNode';

interface BlockLaneData extends Record<string, unknown> {
  name: string;
  description: string | null;
  color: string | null;
}

type BlockLaneFlowNode = Node<BlockLaneData, 'block'>;

function BlockLaneComponent({ data }: NodeProps<BlockLaneFlowNode>) {
  const accent = data.color ?? '#38bdf8';

  return (
    <div
      data-mapflow-block-lane="true"
      className="pointer-events-none flex h-full w-full items-center rounded-2xl border border-dashed bg-slate-950/55 px-5 py-4"
      style={{
        borderColor: `${accent}88`,
        boxShadow: `inset 0 0 32px ${accent}12`,
      }}
    >
      <div className="flex w-[180px] shrink-0 items-center gap-3 pr-4">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}` }}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">
            {data.name}
          </div>
          {data.description && (
            <div className="mt-1 truncate text-[10px] text-slate-400">
              {data.description}
            </div>
          )}
        </div>
      </div>
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
  onSelectNode: (nodeId: string) => void;
}

export default function SkillTreeCanvas({
  snapshot,
  displayMode,
  layoutMode,
  selectedNodeId,
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

  useEffect(() => {
    if (!flowRef.current || generatedNodes.length === 0) return;
    const timer = window.setTimeout(() => {
      flowRef.current?.fitView({
        nodes:
          layoutMode === 'relationship' && snapshot.current_node_id
            ? [{ id: snapshot.current_node_id }]
            : undefined,
        padding: layoutMode === 'blocks' ? 0.2 : 0.5,
        maxZoom: layoutMode === 'blocks' ? 1 : 1.5,
        duration: 180,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [generatedNodes.length, layoutKey, layoutMode, snapshot.current_node_id]);

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
      fitView
      fitViewOptions={{
        nodes:
          layoutMode === 'relationship' && snapshot.current_node_id
            ? [{ id: snapshot.current_node_id }]
            : undefined,
        padding: layoutMode === 'blocks' ? 0.2 : 0.5,
        maxZoom: layoutMode === 'blocks' ? 1 : 1.5,
      }}
      minZoom={0.1}
      maxZoom={2.5}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
    >
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
