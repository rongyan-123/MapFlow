import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge } from '@xyflow/react';
import type {
  LearningTreeSnapshot,
  SkillNode,
} from '../../types/learning';
import SkillTreeCanvas from './SkillTreeCanvas';

const flowMocks = vi.hoisted(() => ({
  fitView: vi.fn(),
  setViewport: vi.fn(),
  nodes: [] as Array<{
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>,
  edges: [] as Edge[],
  reactFlowProps: {} as Record<string, unknown>,
  backgroundProps: {} as Record<string, unknown>,
  minimapProps: {} as Record<string, unknown>,
}));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');

  function useNodesState<Node>(initial: Node[]) {
    const [nodes, setNodes] = React.useState(initial);
    return [nodes, setNodes, () => undefined] as const;
  }

  function useEdgesState<EdgeType>(initial: EdgeType[]) {
    const [edges, setEdges] = React.useState(initial);
    return [edges, setEdges, () => undefined] as const;
  }

  function getBounds(
    nodes: Array<{
      position: { x: number; y: number };
      width?: number;
      height?: number;
    }>,
  ) {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const left = Math.min(...nodes.map((node) => node.position.x));
    const top = Math.min(...nodes.map((node) => node.position.y));
    const right = Math.max(
      ...nodes.map((node) => node.position.x + (node.width ?? 200)),
    );
    const bottom = Math.max(
      ...nodes.map((node) => node.position.y + (node.height ?? 80)),
    );
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function ReactFlow({
    nodes,
    edges,
    onInit,
    children,
    ...reactFlowProps
  }: {
    nodes: Array<{
      id: string;
      position: { x: number; y: number };
    }>;
    edges: Edge[];
    onInit?: (instance: unknown) => void;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) {
    flowMocks.nodes = nodes;
    flowMocks.edges = edges;
    flowMocks.reactFlowProps = reactFlowProps;
    const instance = {
      fitView: flowMocks.fitView,
      setViewport: flowMocks.setViewport,
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      getNodes: () => flowMocks.nodes,
      getEdges: () => flowMocks.edges,
      getNodesBounds: (selectedNodes = flowMocks.nodes) =>
        getBounds(selectedNodes),
    };

    React.useEffect(() => {
      onInit?.(instance);
    }, [onInit]);

    return <div data-testid="react-flow-boundary">{children}</div>;
  }

  return {
    Background: (props: { color?: string; gap?: number }) => {
      flowMocks.backgroundProps = props;
      return null;
    },
    Controls: ({ className, showInteractive }: { className?: string; showInteractive?: boolean }) => (
      <div data-testid="controls" data-show-interactive={showInteractive ? 'true' : 'false'} className={className} />
    ),
    MiniMap: (props: { className?: string; maskColor?: string }) => {
      flowMocks.minimapProps = props;
      return <div data-testid="minimap" className={props.className} />;
    },
    ReactFlow,
    useEdgesState,
    useNodesState,
  };
});

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;
let resizeCallback: ResizeCallback | undefined;

class TestResizeObserver {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe() {}

  disconnect() {}
}

function emitResize(width: number, height: number) {
  resizeCallback?.([
    {
      contentRect: { width, height },
    } as ResizeObserverEntry,
  ]);
}

const rootNode: SkillNode = {
  id: 'root',
  tree_id: 'tree-1',
  title: 'Root',
  description: 'Root node',
  icon: 'R',
  category: 'foundation',
  difficulty: 1,
  estimated_minutes: 10,
  depth_level: 1,
  position_x: 0,
  position_y: 0,
  order_in_level: 1,
  learning_objectives: null,
  key_concepts: null,
  recommended_depth: 'Recognize',
  depth_rationale: 'Start here',
  observable_evidence: 'Can explain it',
};

const childNode: SkillNode = {
  ...rootNode,
  id: 'child',
  title: 'Child',
  depth_level: 2,
  order_in_level: 1,
};

const baseSnapshot = (progress = 'not_started'): LearningTreeSnapshot => ({
  tree: {
    id: 'tree-1',
    topic: 'Testing',
    title: 'Testing map',
    description: null,
    difficulty_level: 'beginner',
    total_nodes: 2,
  },
  nodes: [rootNode, childNode],
  edges: [
    {
      id: 'edge-1',
      source_node_id: rootNode.id,
      target_node_id: childNode.id,
      edge_type: 'prerequisite',
      label: null,
    },
  ],
  current_node_id: rootNode.id,
  progress: [
    { node_id: rootNode.id, status: progress as 'not_started', evidence: '' },
  ],
});

describe('SkillTreeCanvas viewport lifecycle', () => {
  beforeEach(() => {
    resizeCallback = undefined;
    flowMocks.fitView.mockReset();
    flowMocks.fitView.mockResolvedValue(true);
    flowMocks.setViewport.mockReset();
    flowMocks.nodes = [];
    flowMocks.edges = [];
    flowMocks.reactFlowProps = {};
    flowMocks.backgroundProps = {};
    flowMocks.minimapProps = {};
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });

  it('refits on a significant viewport change without reacting to small changes or progress updates', async () => {
    const { rerender } = render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="personal"
        selectedNodeId={rootNode.id}
        onSelectNode={vi.fn()}
      />,
    );

    emitResize(1440, 900);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));

    flowMocks.fitView.mockClear();
    emitResize(1432, 892);
    await Promise.resolve();
    expect(flowMocks.fitView).not.toHaveBeenCalled();

    emitResize(1360, 892);
    await Promise.resolve();
    expect(flowMocks.fitView).not.toHaveBeenCalled();

    emitResize(1280, 892);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));
    flowMocks.fitView.mockClear();

    rerender(
      <SkillTreeCanvas
        snapshot={baseSnapshot('completed')}
        displayMode="personal"
        selectedNodeId={rootNode.id}
        onSelectNode={vi.fn()}
      />,
    );
    await Promise.resolve();
    expect(flowMocks.fitView).not.toHaveBeenCalled();

    emitResize(390, 844);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));
    expect(flowMocks.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: rootNode.id }] }),
    );
  });

  it('exposes compact mobile map chrome hooks', () => {
    const { getByTestId } = render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="personal"
        selectedNodeId={rootNode.id}
        onSelectNode={vi.fn()}
      />,
    );

    expect(getByTestId('controls')).toHaveClass('skill-tree-canvas__controls');
    expect(getByTestId('minimap')).toHaveClass('skill-tree-canvas__minimap');
  });

  it('keeps the selected node as the resize anchor ahead of the current node', async () => {
    render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="personal"
        selectedNodeId={childNode.id}
        onSelectNode={vi.fn()}
      />,
    );

    emitResize(1440, 900);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));
    expect(flowMocks.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: childNode.id }] }),
    );
  });

  it('在 landing 预览中把普通滚轮还给页面，并锁定节点布局拖动', () => {
    render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="showcase"
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        interactionMode="landing-preview"
      />,
    );

    expect(flowMocks.reactFlowProps).toMatchObject({
      fitView: false,
      zoomOnScroll: false,
      zoomOnPinch: true,
      zoomOnDoubleClick: false,
      preventScrolling: false,
      nodesDraggable: false,
      nodesConnectable: false,
      panOnDrag: true,
    });
    expect(screen.getByTestId('controls')).toHaveAttribute('data-show-interactive', 'false');
  });

  it('为 landing 预览提供浅色画布和 minimap 遮罩，同时保持默认主题契约', () => {
    render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="showcase"
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        surfaceTheme="light"
      />,
    );

    expect(flowMocks.backgroundProps).toMatchObject({ color: '#8ccfc5' });
    expect(flowMocks.minimapProps).toMatchObject({
      maskColor: 'rgba(231, 248, 244, 0.84)',
    });
  });

  it('landing 首次 fit 可以展示一簇节点，后续仍由 anchor 接管', async () => {
    render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="showcase"
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        interactionMode="landing-preview"
        initialFitNodeIds={[rootNode.id, childNode.id]}
      />,
    );

    emitResize(390, 844);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));
    expect(flowMocks.fitView).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [{ id: rootNode.id }, { id: childNode.id }],
      }),
    );
  });

  it('landing 首次 fit 保留整簇视口，不再用单锚点移动窄画布', async () => {
    render(
      <SkillTreeCanvas
        snapshot={baseSnapshot()}
        displayMode="showcase"
        selectedNodeId={null}
        onSelectNode={vi.fn()}
        interactionMode="landing-preview"
        initialFitNodeIds={[rootNode.id, childNode.id]}
      />,
    );

    emitResize(740, 560);
    await waitFor(() => expect(flowMocks.fitView).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(flowMocks.setViewport).not.toHaveBeenCalled();
  });
});
