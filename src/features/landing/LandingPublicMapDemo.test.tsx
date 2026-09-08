import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillNode, SkillTree } from '../../types/learning';
import type { TreeGraph } from '../tree-library/types';
import LandingPublicMapDemo, {
  chooseLandingPublicTree,
  getLandingPreviewNodeIds,
  snapshotFromLandingGraph,
} from './LandingPublicMapDemo';

const apiMocks = vi.hoisted(() => ({
  fetchPublicTrees: vi.fn(),
  fetchPublicTree: vi.fn(),
}));

vi.mock('../tree-library/treeLibraryClient', () => apiMocks);

vi.mock('../skill-tree/SkillTreeCanvas', () => ({
  default: ({
    snapshot,
    onSelectNode,
    interactionMode,
  }: {
    snapshot: { nodes: SkillNode[] };
    onSelectNode: (nodeId: string) => void;
    interactionMode?: string;
  }) => (
    <div data-testid="mock-landing-map-canvas" data-interaction-mode={interactionMode}>
      {snapshot.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node.id)}>
          {node.title}
        </button>
      ))}
    </div>
  ),
}));

const agentTree: SkillTree = {
  id: 'agent-tree',
  topic: 'agent-development',
  title: 'Agent 工程地图',
  description: 'Agent foundations',
  difficulty_level: 'intermediate',
  total_nodes: 1,
};

const otherTree: SkillTree = {
  ...agentTree,
  id: 'other-tree',
  topic: 'frontend',
  title: '前端工程地图',
};

const pythonAgentTree: SkillTree = {
  ...agentTree,
  id: 'python-agent-tree',
  topic: 'python-agent-development',
  title: 'Python Agent 工程地图',
};

const agentNode: SkillNode = {
  id: 'agent-root',
  tree_id: agentTree.id,
  title: 'Agent 基础',
  description: '理解 Agent 的循环与工具调用。',
  icon: 'robot',
  category: 'foundation',
  difficulty: 1,
  estimated_minutes: 20,
  depth_level: 1,
  position_x: 0,
  position_y: 0,
  order_in_level: 1,
  learning_objectives: '能解释 Agent 循环',
  key_concepts: 'tool use',
  recommended_depth: 'Understand',
  depth_rationale: '先建立模型',
  observable_evidence: '能画出循环',
};

const agentGraph: TreeGraph = {
  tree: agentTree,
  nodes: [agentNode],
  edges: [],
};

describe('LandingPublicMapDemo', () => {
  beforeEach(() => {
    apiMocks.fetchPublicTrees.mockReset();
    apiMocks.fetchPublicTree.mockReset();
  });

  it('优先选择 Agent 相关的公共树，并把公共图转换成无进度快照', () => {
    expect(chooseLandingPublicTree([otherTree, agentTree])).toBe(agentTree);
    expect(chooseLandingPublicTree([agentTree, pythonAgentTree])).toBe(pythonAgentTree);

    expect(snapshotFromLandingGraph(agentGraph)).toMatchObject({
      tree: agentTree,
      nodes: [agentNode],
      edges: [],
      current_node_id: null,
      progress: [],
      demo_source: 'landing-public',
    });
    expect(getLandingPreviewNodeIds(agentGraph)).toEqual([agentNode.id]);
  });

  it('读取 Agent 公共树并在点击节点后只显示只读内容', async () => {
    apiMocks.fetchPublicTrees.mockResolvedValue({ trees: [otherTree, agentTree] });
    apiMocks.fetchPublicTree.mockResolvedValue({ view_mode: 'showcase', graph: agentGraph });

    const user = userEvent.setup();
    render(<LandingPublicMapDemo />);

    await waitFor(() => expect(screen.getByTestId('mock-landing-map-canvas')).toBeInTheDocument());
    expect(screen.getByText('Agent 工程地图')).toBeInTheDocument();
    expect(screen.getByText('公共地图预览')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Agent 基础' }));
    expect(screen.getByText('理解 Agent 的循环与工具调用。')).toBeInTheDocument();
    expect(screen.getByText('能解释 Agent 循环')).toBeInTheDocument();
    expect(apiMocks.fetchPublicTrees).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchPublicTree).toHaveBeenCalledWith('agent-tree');
  });

  it('公共树加载失败时提供明确的重试入口', async () => {
    apiMocks.fetchPublicTrees
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ trees: [agentTree] });
    apiMocks.fetchPublicTree.mockResolvedValue({ view_mode: 'showcase', graph: agentGraph });

    const user = userEvent.setup();
    render(<LandingPublicMapDemo />);

    const retry = await screen.findByRole('button', { name: '重新加载公共示例' });
    expect(screen.getByText('公共学习地图暂时无法加载。')).toBeInTheDocument();
    await user.click(retry);
    await waitFor(() => expect(screen.getByText('Agent 工程地图')).toBeInTheDocument());
    expect(apiMocks.fetchPublicTrees).toHaveBeenCalledTimes(2);
  });

  it('从手机被动阅读切到桌面后恢复地图探索模式', async () => {
    let mobileMatches = true;
    let viewportChangeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const previousMatchMedia = window.matchMedia;
    const mediaQueryList = {
      get matches() { return mobileMatches; },
      media: '(max-width: 860px)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        viewportChangeListener = listener;
      },
      removeEventListener: () => {},
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        viewportChangeListener = listener;
      },
      removeListener: () => {},
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => query === '(max-width: 860px)' ? mediaQueryList : {
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });

    try {
      apiMocks.fetchPublicTrees.mockResolvedValue({ trees: [agentTree] });
      apiMocks.fetchPublicTree.mockResolvedValue({ view_mode: 'showcase', graph: agentGraph });
      render(<LandingPublicMapDemo />);

      await waitFor(() => expect(screen.getByTestId('mock-landing-map-canvas')).toHaveAttribute(
        'data-interaction-mode',
        'passive',
      ));

      await act(async () => {
        mobileMatches = false;
        viewportChangeListener?.({ matches: false } as MediaQueryListEvent);
      });

      await waitFor(() => expect(screen.getByTestId('mock-landing-map-canvas')).toHaveAttribute(
        'data-interaction-mode',
        'landing-preview',
      ));
    } finally {
      if (previousMatchMedia) {
        window.matchMedia = previousMatchMedia;
      } else {
        Reflect.deleteProperty(window, 'matchMedia');
      }
    }
  });
});
