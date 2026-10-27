import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningTreeSnapshot } from '../../types/learning';
import SkillTreeCanvas from './MapCanvas';

const flowProbe = vi.hoisted(() => ({
  fitView: vi.fn(),
  getZoom: vi.fn(() => 0.8),
  getViewport: vi.fn(() => ({x:72,y:-31,zoom:.63})),
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
    getViewport: () => flowProbe.getViewport(),
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
    edges,
    onInit,
    onMoveEnd,
    onNodeClick,
    children,
    reference,
  }: {
    nodes: unknown[];
    edges: Array<{ id: string; source: string; target: string; data?: { relation?: string } }>;
    onInit?: (instance: typeof flowInstance) => void;
    onMoveEnd?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
    onNodeClick?: (event: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => void;
    children?: React.ReactNode;
    reference?: React.Ref<HTMLDivElement>;
  }) {
    React.useEffect(() => {
      onInit?.(flowInstance);
    }, []);

    return (
      <div ref={reference} data-testid="skill-tree-flow" data-node-count={nodes.length}>
        <div aria-label="地图连接">{edges.map(edge => <output key={edge.id} aria-label={`连接 ${edge.id}`} data-relation={edge.data?.relation}>{edge.source} → {edge.target}</output>)}</div>
        {(nodes as Array<{id:string;type?:string;data:{ready?:boolean;progress?:{progress_percent?:number}|null}}>).filter(node=>node.type==='skill').map(node=><div key={node.id}><output aria-label={`节点 ${node.id} 准备状态`} data-ready={node.data.ready} data-progress={node.data.progress?.progress_percent} /><button onClick={event=>onNodeClick?.(event,node as unknown as {id:string;position:{x:number;y:number}})}>选择节点 {node.id}</button></div>)}
        <button onClick={() => onMoveEnd?.({}, { x: 72, y: -31, zoom: 0.63 })}>移动地图</button>
        {nodes.length > 0 && <button onClick={event => onNodeClick?.(event, nodes[0] as { id: string; position: { x: number; y: number } })}>选择地图节点</button>}
        {children}
      </div>
    );
  }

  return {
    Background: ({variant}:{variant?:string}) => <div aria-label="地图网格" data-variant={variant} />,
    BackgroundVariant: { Lines: 'lines' },
    Controls: () => null,
    MiniMap: () => null,
    ReactFlow:React.forwardRef((props:React.ComponentProps<typeof ReactFlow>,ref:React.ForwardedRef<HTMLDivElement>)=><ReactFlow {...props} reference={ref} />),
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
  it('updates readiness from prerequisite progress while preserving a waiting node progress and selection', async () => {
    const graph: LearningTreeSnapshot = { ...snapshot, nodes: [{ ...snapshot.nodes[0], id: 'before' }, snapshot.nodes[0]],
      edges: [{ id: 'dependency', source_node_id: 'before', target_node_id: 'node-1', edge_type: 'prerequisite', label: null }],
      progress: [{ node_id: 'before', progress_percent: 99, status: 'in_progress', evidence: '' }, { node_id: 'node-1', progress_percent: 100, status: 'completed', evidence: '' }],
    };
    const select = vi.fn();
    const props = { snapshot: graph, layoutMode: 'relationship' as const, displayMode: 'personal' as const, selectedNodeId: null, isGraphVisible: true, onSelectNode: select };
    const view = render(<SkillTreeCanvas {...props} />);
    await waitFor(() => expect(screen.getByLabelText('节点 node-1 准备状态')).toHaveAttribute('data-ready', 'false'));
    expect(screen.getByLabelText('节点 before 准备状态')).toHaveAttribute('data-ready', 'true');
    expect(screen.getByLabelText('节点 node-1 准备状态')).toHaveAttribute('data-progress', '100');
    fireEvent.click(screen.getByRole('button', { name: '选择节点 node-1' }));
    expect(select).toHaveBeenCalledWith('node-1');
    view.rerender(<SkillTreeCanvas {...props} snapshot={{ ...graph, progress: graph.progress.map(item => ({ ...item, progress_percent: 100, status: 'completed' })) }} />);
    await waitFor(() => expect(screen.getByLabelText('节点 node-1 准备状态')).toHaveAttribute('data-ready', 'true'));
    expect(screen.getByLabelText('节点 node-1 准备状态')).toHaveAttribute('data-progress', '100');
  });
  it('keeps real edges neutral by default and highlights only direct prerequisites in either layout', async () => {
    const connected = { ...snapshot, current_node_id: null,
      nodes: [{ ...snapshot.nodes[0], id: 'before' }, snapshot.nodes[0], { ...snapshot.nodes[0], id: 'after' }],
      edges: [
        { id: 'in', source_node_id: 'before', target_node_id: 'node-1', edge_type: 'prerequisite', label: null },
        { id: 'out', source_node_id: 'node-1', target_node_id: 'after', edge_type: 'prerequisite', label: null },
        { id: 'related', source_node_id: 'before', target_node_id: 'node-1', edge_type: 'related', label: null },
      ],
    } satisfies LearningTreeSnapshot;
    const props = { snapshot: connected, displayMode: 'personal' as const, isGraphVisible: true, onSelectNode: () => {} };
    const view = render(<SkillTreeCanvas {...props} layoutMode="relationship" selectedNodeId={null} />);
    for (const layoutMode of ['relationship', 'blocks'] as const) {
      view.rerender(<SkillTreeCanvas {...props} layoutMode={layoutMode} selectedNodeId={null} />);
      if (layoutMode === 'blocks') await waitFor(() => expect(screen.queryByLabelText('连接 in')).not.toBeInTheDocument());
      else {
        await waitFor(() => expect(screen.getByLabelText('连接 in')).toHaveAttribute('data-relation', 'neutral'));
        expect(screen.getByLabelText('连接 out')).toHaveTextContent('node-1 → after');
        expect(screen.getByLabelText('连接 related')).toHaveAttribute('data-relation', 'neutral');
      }
      view.rerender(<SkillTreeCanvas {...props} layoutMode={layoutMode} selectedNodeId="node-1" />);
      await waitFor(() => expect(screen.getByLabelText('连接 in')).toHaveAttribute('data-relation', 'incoming'));
      expect(screen.getByLabelText('连接 out')).toHaveAttribute('data-relation', 'outgoing');
      expect(screen.getByLabelText('连接 related')).toHaveAttribute('data-relation', 'neutral');
      expect(screen.getByText('直接前置')).toBeVisible();
      expect(screen.getByText('直接后续')).toBeVisible();
      view.rerender(<SkillTreeCanvas {...props} layoutMode={layoutMode} selectedNodeId={null} />);
      if (layoutMode === 'blocks') await waitFor(() => expect(screen.queryByLabelText('连接 in')).not.toBeInTheDocument());
      else await waitFor(() => expect(screen.getByLabelText('连接 in')).toHaveAttribute('data-relation', 'neutral'));
    }
    expect(screen.getByLabelText('地图网格')).toHaveAttribute('data-variant', 'lines');
  });
  afterEach(()=>vi.unstubAllGlobals());
  beforeEach(() => {
    flowProbe.fitView.mockClear();
    flowProbe.fitView.mockResolvedValue(true);
    flowProbe.getZoom.mockClear();
    flowProbe.zoomTo.mockClear();
    flowProbe.nodesInitialized = false;
    flowProbe.setViewport.mockClear(); localStorage.clear();
    flowProbe.fitViewBeforeNodesInitialized.length = 0;
  });
  it('opens a large map around a learning starting node rather than shrinking all nodes into unreadable dots',async()=>{
    render(<SkillTreeCanvas snapshot={{...snapshot,current_node_id:null}} displayMode="personal" layoutMode="relationship" selectedNodeId={null} isGraphVisible onSelectNode={()=>{}} />);
    await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());expect(flowProbe.fitView.mock.calls[0][0].nodes).toEqual([{id:'node-1'}]);
  });
  it('opens a node deep link around that node instead of the map starting node',async()=>{
    const target={...snapshot.nodes[0],id:'node-target',depth_level:2};
    render(<SkillTreeCanvas snapshot={{...snapshot,nodes:[...snapshot.nodes,target]}} displayMode="personal" layoutMode="relationship" selectedNodeId="node-target" isGraphVisible onSelectNode={()=>{}} />);
    await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());
    expect(flowProbe.fitView.mock.calls[0][0].nodes).toEqual([{id:'node-target'}]);
  });
  it('falls back to the map starting node when a deep link refers to a missing node',async()=>{
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship" selectedNodeId="missing-node" isGraphVisible onSelectNode={()=>{}} />);
    await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());
    expect(flowProbe.fitView.mock.calls[0][0].nodes).toEqual([{id:'node-1'}]);
  });
  it('keeps the same graph center when a saved viewport is restored at a wider screen',async()=>{
    const previousWidth=window.innerWidth;const props={snapshot,displayMode:'personal' as const,layoutMode:'relationship' as const,selectedNodeId:null,isGraphVisible:true,onSelectNode:()=>{},viewportStorageKey:'mapflow.map.test.resize'};
    const first=render(<SkillTreeCanvas {...props} />);await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());fireEvent.click(screen.getByRole('button',{name:'移动地图'}));first.unmount();window.innerWidth=previousWidth+400;
    render(<SkillTreeCanvas {...props} />);await waitFor(()=>expect(flowProbe.setViewport).toHaveBeenCalledWith({x:272,y:-31,zoom:.63},{duration:0}));window.innerWidth=previousWidth;
  });

  it('keeps the viewed graph center when resizing the live canvas, without fitting the whole graph again',async()=>{
    let notifyResize!:ResizeObserverCallback;
    const observed:Element[]=[];
    vi.stubGlobal('ResizeObserver',class {
      constructor(callback:ResizeObserverCallback){notifyResize=callback;}
      observe(element:Element){observed.push(element);}
      unobserve(){}
      disconnect(){}
    });
    vi.stubGlobal('innerWidth',1000);vi.stubGlobal('innerHeight',800);
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship" selectedNodeId={null} isGraphVisible onSelectNode={()=>{}} />);
    await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());
    const canvas=screen.getByTestId('skill-tree-flow');
    expect(observed).toContain(canvas);
    flowProbe.fitView.mockClear();flowProbe.setViewport.mockClear();
    Object.defineProperties(canvas,{clientWidth:{value:600},clientHeight:{value:500}});
    notifyResize([],{} as ResizeObserver);
    expect(flowProbe.setViewport).toHaveBeenCalledWith({x:-128,y:-181,zoom:.63},{duration:0});
    expect(flowProbe.fitView).not.toHaveBeenCalled();
  });

  it('centers the chosen node in the remaining canvas after its detail panel opens',async()=>{
    const onSelectNode=vi.fn(()=>{
      Object.defineProperties(screen.getByTestId('skill-tree-flow'),{clientWidth:{value:390},clientHeight:{value:280}});
    });
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship" selectedNodeId={null} isGraphVisible onSelectNode={onSelectNode} />);
    await waitFor(()=>expect(flowProbe.fitView).toHaveBeenCalled());
    flowProbe.setViewport.mockClear();
    fireEvent.click(screen.getByRole('button',{name:'选择地图节点'}));
    expect(onSelectNode).toHaveBeenCalledWith('node-1');
    await waitFor(()=>expect(flowProbe.setViewport).toHaveBeenCalledWith({x:195,y:98.4,zoom:.8},{duration:0}));
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
    expect(flowProbe.setViewport).not.toHaveBeenCalledWith({x:72,y:-31,zoom:.63},{duration:0}); other.unmount(); flowProbe.fitView.mockClear();
    render(<SkillTreeCanvas {...props} snapshot={{ ...snapshot, tree: { ...snapshot.tree, revision: 2 } }} />);
    await waitFor(() => expect(flowProbe.fitView).toHaveBeenCalled());
    expect(flowProbe.setViewport).not.toHaveBeenCalledWith({x:72,y:-31,zoom:.63},{duration:0});
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
