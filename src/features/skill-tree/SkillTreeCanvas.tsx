import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
} from '@xyflow/react';
import type { LearningTreeSnapshot } from '../../types/learning';
import { computeTreeLayout } from './layoutTree';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './SkillNode';

const nodeTypes = { skill: SkillNodeComponent };

interface SkillTreeCanvasProps {
  snapshot: LearningTreeSnapshot;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export default function SkillTreeCanvas({
  snapshot,
  selectedNodeId,
  onSelectNode,
}: SkillTreeCanvasProps) {
  const progressMap = useMemo(
    () => new Map(snapshot.progress.map((item) => [item.node_id, item])),
    [snapshot.progress],
  );
  const positions = useMemo(
    () => computeTreeLayout(snapshot.nodes, snapshot.edges),
    [snapshot.nodes, snapshot.edges],
  );
  const generatedNodes = useMemo<SkillFlowNode[]>(
    () =>
      snapshot.nodes.map((node) => ({
        id: node.id,
        type: 'skill',
        position: positions.get(node.id) ?? {
          x: node.position_x,
          y: node.position_y,
        },
        data: {
          node,
          progress: progressMap.get(node.id) ?? null,
          isCurrent: node.id === snapshot.current_node_id,
        },
      })),
    [positions, progressMap, snapshot.current_node_id, snapshot.nodes],
  );
  const generatedEdges = useMemo<Edge[]>(
    () =>
      snapshot.edges.map((edge) => {
        const sourceStatus = progressMap.get(edge.source_node_id)?.status;
        const mastered = sourceStatus === 'mastered';
        const completed = sourceStatus === 'completed';
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
      }),
    [progressMap, snapshot.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes((existingNodes) => {
      const existingPositions = new Map(
        existingNodes.map((node) => [node.id, node.position]),
      );
      return generatedNodes.map((node) => ({
        ...node,
        position: existingPositions.get(node.id) ?? node.position,
      }));
    });
  }, [generatedNodes, setNodes]);

  useEffect(() => {
    setEdges(generatedEdges);
  }, [generatedEdges, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      fitView
      fitViewOptions={{
        nodes: snapshot.current_node_id ? [{ id: snapshot.current_node_id }] : [],
        padding: 0.5,
        maxZoom: 1.5,
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
