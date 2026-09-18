import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningTreeSnapshot } from '../../types/learning';
import SkillTreeCanvas from './SkillTreeCanvas';

const flowProbe = vi.hoisted(() => ({
  fitView: vi.fn(),
  getZoom: vi.fn(() => 0.8),
  zoomTo: vi.fn().mockResolvedValue(undefined),
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
    children,
  }: {
    nodes: unknown[];
    onInit?: (instance: typeof flowInstance) => void;
    children?: React.ReactNode;
  }) {
    React.useEffect(() => {
      onInit?.(flowInstance);
    }, []);

    return (
      <div data-testid="skill-tree-flow" data-node-count={nodes.length}>
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
    flowProbe.fitViewBeforeNodesInitialized.length = 0;
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
});
