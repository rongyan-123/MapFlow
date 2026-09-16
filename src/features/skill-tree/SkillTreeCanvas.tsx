import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import type {
  LearningTreeSnapshot,
  TreeDisplayMode,
} from '../../types/learning';
import { computeTreeLayout } from './layoutTree';
import SkillNodeComponent, {
  type SkillFlowNode,
} from './SkillNode';
import {
  getMobileViewportAdjustment,
  shouldRefitViewport,
  SKILL_TREE_DESKTOP_BREAKPOINT,
  type ViewportSize,
} from './skillTreeViewport';
import './skill-tree-canvas.css';

const nodeTypes = { skill: SkillNodeComponent };
type SkillTreeFlowInstance = ReactFlowInstance<SkillFlowNode, Edge>;
export type SkillTreeInteractionMode = 'default' | 'landing-preview' | 'passive';
export type SkillTreeSurfaceTheme = 'default' | 'light';

function getViewportAnchorId(
  nodes: SkillFlowNode[],
  edges: Edge[],
  preferredNodeId: string | null,
  fallbackNodeId: string | null,
): string | null {
  if (preferredNodeId && nodes.some((node) => node.id === preferredNodeId)) {
    return preferredNodeId;
  }
  if (fallbackNodeId && nodes.some((node) => node.id === fallbackNodeId)) {
    return fallbackNodeId;
  }

  const childNodeIds = new Set(edges.map((edge) => edge.target));
  return (
    nodes.find((node) => !childNodeIds.has(node.id))?.id ?? nodes[0]?.id ?? null
  );
}

function isMobileViewport(size: ViewportSize): boolean {
  return size.width < SKILL_TREE_DESKTOP_BREAKPOINT;
}

function isUsableViewportSize(size: ViewportSize): boolean {
  return size.width > 0 && size.height > 0;
}

interface SkillTreeCanvasProps {
  snapshot: LearningTreeSnapshot;
  displayMode: TreeDisplayMode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  interactionMode?: SkillTreeInteractionMode;
  surfaceTheme?: SkillTreeSurfaceTheme;
  initialFitNodeIds?: string[];
}

export default function SkillTreeCanvas({
  snapshot,
  displayMode,
  selectedNodeId,
  onSelectNode,
  interactionMode = 'default',
  surfaceTheme = 'default',
  initialFitNodeIds = [],
}: SkillTreeCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<SkillTreeFlowInstance | null>(null);
  const viewportSizeRef = useRef<ViewportSize | null>(null);
  const lastFittedViewportSizeRef = useRef<ViewportSize | null>(null);
  const pendingFitSizeRef = useRef<ViewportSize | null>(null);
  const scheduledFitRef = useRef<number | null>(null);
  const currentNodeIdRef = useRef(snapshot.current_node_id);
  const selectedNodeIdRef = useRef(selectedNodeId);
  currentNodeIdRef.current = snapshot.current_node_id;
  selectedNodeIdRef.current = selectedNodeId;

  const isLandingPreview = interactionMode === 'landing-preview';
  const isPassive = interactionMode === 'passive';
  const isLandingMode = interactionMode !== 'default';
  const isLightSurface = surfaceTheme === 'light';

  const progressMap = useMemo(
    () => new Map(snapshot.progress.map((item) => [item.node_id, item])),
    [snapshot.progress],
  );
  const positions = useMemo(
    () =>
      snapshot.tree.layout_mode === 'manual'
        ? new Map(
            snapshot.nodes.map((node) => [
              node.id,
              { x: node.position_x, y: node.position_y },
            ]),
          )
        : computeTreeLayout(snapshot.nodes, snapshot.edges),
    [snapshot.edges, snapshot.nodes, snapshot.tree.layout_mode],
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
          displayMode,
        },
      })),
    [displayMode, positions, progressMap, snapshot.current_node_id, snapshot.nodes],
  );
  const generatedEdges = useMemo<Edge[]>(
    () =>
      snapshot.edges.map((edge) => {
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
      }),
    [displayMode, progressMap, snapshot.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<SkillFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const graphSignature = useMemo(
    () =>
      [
        snapshot.tree.id,
        snapshot.tree.layout_mode ?? 'auto',
        snapshot.current_node_id ?? '',
        snapshot.nodes.map((node) => node.id).join(','),
        snapshot.edges.map((edge) => edge.id).join(','),
      ].join('|'),
    [
      snapshot.current_node_id,
      snapshot.edges,
      snapshot.nodes,
      snapshot.tree.id,
      snapshot.tree.layout_mode,
    ],
  );

  const fitViewport = useCallback(async (size: ViewportSize): Promise<boolean> => {
    const instance = flowInstanceRef.current;
    if (!instance) return false;

    const flowNodes = instance.getNodes();
    if (flowNodes.length === 0) return false;

    const fallbackNodeId = currentNodeIdRef.current ?? initialFitNodeIds[0] ?? null;
    const anchorId = getViewportAnchorId(
      flowNodes,
      instance.getEdges(),
      selectedNodeIdRef.current,
      fallbackNodeId,
    );
    const initialFitNodes = lastFittedViewportSizeRef.current === null
      ? initialFitNodeIds.filter((nodeId) => flowNodes.some((node) => node.id === nodeId))
      : [];
    const isInitialClusterFit = initialFitNodes.length > 0;
    const fitOptions = {
      ...(isInitialClusterFit
        ? { nodes: initialFitNodes.map((nodeId) => ({ id: nodeId })) }
        : anchorId
          ? { nodes: [{ id: anchorId }] }
          : {}),
      padding: isMobileViewport(size) ? 0.32 : 0.5,
      maxZoom: 1.5,
    };

    const fitCompleted = await instance.fitView(fitOptions);
    if (!fitCompleted) return false;

    if (isInitialClusterFit || !isMobileViewport(size) || !anchorId) return true;

    const fittedNodes = instance.getNodes();
    const anchorNode = fittedNodes.find((node) => node.id === anchorId);
    if (!anchorNode) return true;

    const anchorBounds = instance.getNodesBounds([anchorNode]);
    if (anchorBounds.width <= 0 || anchorBounds.height <= 0) return true;

    const adjustedViewport = getMobileViewportAdjustment(
      instance.getViewport(),
      instance.getNodesBounds(fittedNodes),
      anchorBounds,
      size,
    );
    const currentViewport = instance.getViewport();
    if (adjustedViewport.y !== currentViewport.y) {
      await instance.setViewport(adjustedViewport);
    }
    return true;
  }, [initialFitNodeIds]);

  const scheduleViewportFit = useCallback(
    (size: ViewportSize) => {
      pendingFitSizeRef.current = size;
      if (scheduledFitRef.current !== null) return;

      const run = () => {
        scheduledFitRef.current = null;
        const pendingSize = pendingFitSizeRef.current;
        pendingFitSizeRef.current = null;
        if (pendingSize) {
          void fitViewport(pendingSize).then((didFit) => {
            if (didFit) lastFittedViewportSizeRef.current = pendingSize;
          });
        }
      };

      scheduledFitRef.current = window.setTimeout(run, 0);
    },
    [fitViewport],
  );

  const measureCanvas = useCallback(
    (entry?: ResizeObserverEntry) => {
      const element = canvasRef.current;
      if (!element) return;

      const elementRect = element.getBoundingClientRect();
      const width = entry?.contentRect.width || elementRect.width;
      const height = entry?.contentRect.height || elementRect.height;
      const nextSize = { width, height };
      if (!isUsableViewportSize(nextSize)) return;

      const previousSize = lastFittedViewportSizeRef.current;
      viewportSizeRef.current = nextSize;
      if (shouldRefitViewport(previousSize, nextSize)) {
        scheduleViewportFit(nextSize);
      }
    },
    [scheduleViewportFit],
  );

  const handleFlowInit = useCallback(
    (instance: SkillTreeFlowInstance) => {
      flowInstanceRef.current = instance;
      if (viewportSizeRef.current) {
        scheduleViewportFit(viewportSizeRef.current);
      }
    },
    [scheduleViewportFit],
  );

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

  useEffect(() => {
    if (!isLandingMode || nodes.length === 0) return;
    const measuredSize = viewportSizeRef.current;
    if (measuredSize && !lastFittedViewportSizeRef.current) {
      scheduleViewportFit(measuredSize);
    }
  }, [isLandingMode, nodes.length, scheduleViewportFit]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    measureCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        measureCanvas(entries[0]);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    const handleWindowResize = () => measureCanvas();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [measureCanvas]);

  const graphSignatureRef = useRef(graphSignature);
  useEffect(() => {
    if (graphSignatureRef.current === graphSignature) return;
    graphSignatureRef.current = graphSignature;
    if (viewportSizeRef.current) {
      scheduleViewportFit(viewportSizeRef.current);
    }
  }, [graphSignature, scheduleViewportFit]);

  useEffect(
    () => () => {
      if (scheduledFitRef.current !== null) {
        window.clearTimeout(scheduledFitRef.current);
        scheduledFitRef.current = null;
      }
    },
    [],
  );

  return (
    <div
      ref={canvasRef}
      className="skill-tree-canvas"
      data-interaction-mode={interactionMode}
      data-mapflow-onboarding-target="map-surface"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={handleFlowInit}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        nodesDraggable={!isLandingPreview && !isPassive}
        nodesConnectable={!isLandingPreview && !isPassive}
        panOnDrag={!isPassive}
        zoomOnScroll={interactionMode === 'default'}
        zoomOnPinch={!isPassive}
        zoomOnDoubleClick={interactionMode === 'default'}
        zoomActivationKeyCode={isLandingPreview ? 'Control' : undefined}
        preventScrolling={interactionMode === 'default'}
        fitView={!isLandingMode}
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
        <Background color={isLightSurface ? '#8ccfc5' : '#1e293b'} gap={20} />
        <Controls
          showInteractive={interactionMode === 'default'}
          className="skill-tree-canvas__controls !rounded-lg !border-slate-700 !bg-slate-900"
        />
        <MiniMap
          nodeColor={(node) => {
            if (displayMode === 'showcase') return '#22d3ee';
            const flowNode = node as SkillFlowNode;
            const status = flowNode.data.progress?.status ?? 'not_started';
            if (status === 'mastered') return '#facc15';
            if (status === 'completed') return '#34d399';
            if (status === 'in_progress') return '#fbbf24';
            return '#334155';
          }}
          maskColor={isLightSurface ? 'rgba(231, 248, 244, 0.84)' : 'rgba(2, 6, 23, 0.78)'}
          className="skill-tree-canvas__minimap !border-slate-700 !bg-slate-950"
        />
      </ReactFlow>
    </div>
  );
}
