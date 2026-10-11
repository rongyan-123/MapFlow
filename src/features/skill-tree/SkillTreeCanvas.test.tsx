import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningTreeSnapshot } from '../../types/learning';
import SkillTreeCanvas from './SkillTreeCanvas';

const flowProbe = vi.hoisted(() => ({
  fitView: vi.fn(),
  getZoom: vi.fn(() => 0.8),
  zoomTo: vi.fn().mockResolvedValue(undefined),
  setViewport: vi.fn().mockResolvedValue(undefined),
  nodesInitialized: false,
  fitViewBeforeNodesInitialized: [] as boolean[],
}));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');

  const flowInstance = {
    fitView: (...args: unknown[]) => {
      flowProbe.fitViewBeforeNodesInitialized.push(!flowProbe.nodesInitialized);
      return flowProbe.fitView(...args);
    },
    getZoom: () => flowProbe.getZoom(),
    zoomTo: (...args: unknown[]) => flowProbe.zoomTo(...args),
    setViewport: (...args: unknown[]) => flowProbe.setViewport(...args),
  };

  function useNodesState<Node>(initialNodes: Node[]) {
    const [nodes, setNodes] = React.useState(initialNodes);
    return [nodes, setNodes, () => undefined] as const;
  }

  function useEdgesState<Edge>(initialEdges: Edge[]) {
    const [edges, setEdges] = React.useState(initialEdges);
    return [edges, setEdges, () => undefined] as const;
  }

  function useNodesInitialized() {
    const [initialized, setInitialized] = React.useState(false);
    React.useEffect(() => {
      const timer = window.setTimeout(() => {
        flowProbe.nodesInitialized = true;
        setInitialized(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }, []);
    return initialized;
  }

  function ReactFlow({
    nodes,
    onInit,
    onMoveEnd,
    children,
  }: {
    nodes: unknown[];
    onInit?: (instance: typeof flowInstance) => void;
    onMoveEnd?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
    children?: React.ReactNode;
  }) {
    React.useEffect(() => {
      onInit?.(flowInstance);
    }, []);

    return (
      <div data-testid="skill-tree-flow" data-node-count={nodes.length}>
        <button onClick={() => onMoveEnd?.({}, { x: 72, y: -31, zoom: 0.63 })}>移动地图</button>
        {children}
      </div>
    );
  }

  return {
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    ReactFlow,
    useEdgesState,
    useNodesInitialized,
    useNodesState,
  };
});

const snapshot = {
  tree: {
    id: 'tree-1',
    topic: 'testing',
    title: '测试技能树',
    description: null,
    difficulty_level: 'beginner',
    total_nodes: 1,
  },
  nodes: [
    {
      id: 'node-1',
      tree_id: 'tree-1',
      title: '测试节点',
      description: null,
      icon: '📘',
      category: '基础',
      difficulty: 1,
      estimated_minutes: 10,
      depth_level: 1,
      position_x: 0,
      position_y: 0,
      order_in_level: 0,
      learning_objectives: null,
      key_concepts: null,
      recommended_depth: 'Recognize',
      depth_rationale: '先认识概念',
      observable_evidence: '能说出概念名称',
    },
  ],
  edges: [],
  current_node_id: 'node-1',
  progress: [],
} satisfies LearningTreeSnapshot;

describe('SkillTreeCanvas', () => {
  beforeEach(() => {
    flowProbe.fitView.mockClear();
    flowProbe.fitView.mockResolvedValue(true);
    flowProbe.getZoom.mockClear();
    flowProbe.zoomTo.mockClear();
    flowProbe.nodesInitialized = false;
    flowProbe.setViewport.mockClear(); localStorage.clear();
    flowProbe.fitViewBeforeNodesInitialized.length = 0;
  });

  it('restores an account/map viewport after leaving the page and does not replace it with fitView', async () => {
    const props = { snapshot, displayMode: 'personal' as const, layoutMode: 'relationship' as const,
      selectedNodeId: null, isGraphVisible: true, onSelectNode: () => undefined, viewportStorageKey: 'mapflow.map.viewport.v1.account-1.map-1' };
    const first = render(<SkillTreeCanvas {...props} />);
    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '移动地图' }));
    expect(localStorage.getItem(`${props.viewportStorageKey}.relationship`)).not.toBeNull();
    first.unmount(); flowProbe.fitView.mockClear();
    render(<SkillTreeCanvas {...props} />);
    await waitFor(() => expect(flowProbe.setViewport).toHaveBeenCalledWith({ x: 72, y: -31, zoom: 0.63 }, { duration: 0 }));
    expect(flowProbe.fitView).not.toHaveBeenCalled();
  });

  it('does not reuse another account viewport or restore coordinates from an obsolete layout revision', async () => {
    const props = { snapshot, displayMode: 'personal' as const, layoutMode: 'relationship' as const,
      selectedNodeId: null, isGraphVisible: true, onSelectNode: () => undefined, viewportStorageKey: 'mapflow.map.viewport.v1.account-1.map-1' };
    const first = render(<SkillTreeCanvas {...props} />);
    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '移动地图' })); first.unmount();
    flowProbe.fitView.mockClear();
    const other = render(<SkillTreeCanvas {...props} viewportStorageKey="mapflow.map.viewport.v1.account-2.map-1" />);
    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalled());
    expect(flowProbe.setViewport).not.toHaveBeenCalled(); other.unmount(); flowProbe.fitView.mockClear();
    render(<SkillTreeCanvas {...props} snapshot={{ ...snapshot, tree: { ...snapshot.tree, revision: 2 } }} />);
    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalled());
    expect(flowProbe.setViewport).not.toHaveBeenCalled();
  });

  it('等待 React Flow 节点完成测量后再 fitView，避免初始视口停留在原始坐标', async () => {
    render(
      <SkillTreeCanvas
        snapshot={snapshot}
        displayMode="personal"
        layoutMode="relationship"
        selectedNodeId={null}
        isGraphVisible={false}
        onSelectNode={() => undefined}
      />,
    );

    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalledTimes(1));
    expect(flowProbe.fitViewBeforeNodesInitialized).toEqual([false]);
  });

  it('节点详情切换导致画布重新显示时保留用户当前视口，不再次 fitView', async () => {
    const { rerender } = render(
      <SkillTreeCanvas
        snapshot={snapshot}
        displayMode="personal"
        layoutMode="relationship"
        selectedNodeId={null}
        isGraphVisible
        onSelectNode={() => undefined}
      />,
    );

    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalledTimes(1));
    flowProbe.fitView.mockClear();

    rerender(
      <SkillTreeCanvas
        snapshot={snapshot}
        displayMode="personal"
        layoutMode="relationship"
        selectedNodeId="node-1"
        isGraphVisible={false}
        onSelectNode={() => undefined}
      />,
    );
    rerender(
      <SkillTreeCanvas
        snapshot={snapshot}
        displayMode="personal"
        layoutMode="relationship"
        selectedNodeId="node-1"
        isGraphVisible
        onSelectNode={() => undefined}
      />,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    expect(flowProbe.fitView).not.toHaveBeenCalled();
  });
});
