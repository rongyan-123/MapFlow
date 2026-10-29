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
  const { applyNodeChanges } = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');

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

  function useNodesState<FlowNode extends import('@xyflow/react').Node>(initialNodes: FlowNode[]) {
    const [nodes, setNodes] = React.useState(initialNodes);
    const onNodesChange = React.useCallback((changes: import('@xyflow/react').NodeChange<FlowNode>[]) => {
      setNodes(current => applyNodeChanges(changes, current));
    }, []);
    return [nodes, setNodes, onNodesChange] as const;
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
    onMoveStart,
    onMove,
    onMoveEnd,
    onNodesChange,
    onNodeDragStart,
    onNodeDragStop,
    onNodeClick,
    children,
    reference,
  }: {
    nodes: unknown[];
    edges: Array<{ id: string; source: string; target: string; data?: { relation?: string } }>;
    onInit?: (instance: typeof flowInstance) => void;
    onMoveStart?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
    onMove?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
    onMoveEnd?: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
    onNodesChange?: (changes: import('@xyflow/react').NodeChange[]) => void;
    onNodeDragStart?: () => void;
    onNodeDragStop?: () => void;
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
        <svg aria-label="地图流光">{edges.map(edge=><g key={edge.id} className="mapflow-block-connection" data-edge-id={edge.id}><path className="mapflow-connection-flow" d="M 0 0 L 100 100" /></g>)}</svg>
        {(nodes as Array<{id:string;type?:string;position:{x:number;y:number};measured?:{width?:number;height?:number};selected?:boolean;data:{ready?:boolean;progress?:{progress_percent?:number}|null}}>).filter(node=>node.type==='skill').map(node=><div key={node.id}>
          <output aria-label={`节点 ${node.id} 准备状态`} data-ready={node.data.ready} data-progress={node.data.progress?.progress_percent}
            data-measured-width={node.measured?.width} data-measured-height={node.measured?.height} data-x={node.position.x} data-y={node.position.y} data-selected={node.selected} />
          <button onClick={event=>onNodeClick?.(event,node)}>选择节点 {node.id}</button>
          <button onClick={()=>onNodesChange?.([{id:node.id,type:'dimensions',dimensions:{width:240,height:104}}])}>测量节点 {node.id}</button>
          <button onClick={()=>onNodesChange?.([{id:node.id,type:'position',position:{x:321,y:654}}])}>拖动节点 {node.id}</button>
        </div>)}
        <button onClick={() => onMoveStart?.({}, { x: 72, y: -31, zoom: 0.63 })}>开始移动地图</button>
        <button onClick={() => onMove?.({ type: 'mousemove', buttons: 1 }, { x: 72, y: -31, zoom: 0.63 })}>拖动画布</button>
        <button onClick={() => onMove?.({ type: 'mousemove', buttons: 0 }, { x: 72, y: -31, zoom: 0.63 })}>悬停画布</button>
        <button onClick={() => onMove?.({ type: 'wheel' }, { x: 72, y: -31, zoom: 0.5 })}>滚轮缩放地图</button>
        <button onClick={() => onMove?.(null, { x: 72, y: -31, zoom: 0.63 })}>程序定位地图</button>
        <button onClick={() => onMove?.({ type: 'touchmove', touches: [{}] }, { x: 72, y: -31, zoom: 0.63 })}>单指平移地图</button>
        <button onClick={() => onMove?.({ type: 'touchmove', touches: [{}, {}] }, { x: 72, y: -31, zoom: 0.5 })}>双指缩放地图</button>
        <button onClick={() => onNodeDragStart?.()}>开始拖动节点</button>
        <button onClick={() => onNodeDragStop?.()}>结束拖动节点</button>
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
  it.each([undefined, 'mapflow.pan.viewport'])('hides connections only after real canvas panning and restores on release (%s)', async viewportStorageKey => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} viewportStorageKey={viewportStorageKey} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '开始移动地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
    const attributes = vi.spyOn(canvas, 'setAttribute');
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    expect(canvas).toHaveAttribute('data-mapflow-panning', 'true');
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    expect(attributes.mock.calls.filter(([name]) => name === 'data-mapflow-panning')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '移动地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
    expect(screen.getByLabelText('节点 node-1 准备状态')).toBeInTheDocument();
  });

  it('keeps connections visible for node drag, wheel zoom, hovering and programmatic centering', async () => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    for (const name of ['开始拖动节点', '悬停画布', '滚轮缩放地图', '程序定位地图']) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(canvas).not.toHaveAttribute('data-mapflow-panning');
    }
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    expect(canvas).toHaveAttribute('data-mapflow-panning', 'true');
    fireEvent.click(screen.getByRole('button', { name: '滚轮缩放地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    fireEvent.click(screen.getByRole('button', { name: '程序定位地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
  });

  it('hides connections for one-finger panning and restores them for two-finger zoom', async () => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '单指平移地图' }));
    expect(canvas).toHaveAttribute('data-mapflow-panning', 'true');
    fireEvent.click(screen.getByRole('button', { name: '双指缩放地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
  });

  it.each(['pointerup', 'pointercancel', 'blur', 'hidden'])('restores connections when a pan ends outside the canvas (%s)', async ending => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    expect(canvas).toHaveAttribute('data-mapflow-panning', 'true');
    if (ending === 'hidden') {
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      fireEvent(document, new Event('visibilitychange'));
      hidden.mockRestore();
    } else fireEvent(ending === 'blur' ? window : document, new Event(ending));
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
  });

  it('cleans pan visibility state and global cancellation listeners on unmount', async () => {
    const removed = vi.spyOn(window, 'removeEventListener');
    const view = render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '拖动画布' }));
    expect(canvas).toHaveAttribute('data-mapflow-panning', 'true');
    view.unmount();
    expect(canvas).not.toHaveAttribute('data-mapflow-panning');
    expect(removed.mock.calls.some(([name]) => name === 'blur')).toBe(true);
    removed.mockRestore();
  });

  it('retains measured node geometry through selection and progress changes while allowing layout positions to reset', async () => {
    const props = { snapshot, displayMode: 'personal' as const, layoutMode: 'relationship' as const,
      selectedNodeId: null, isGraphVisible: true, onSelectNode: () => undefined };
    const view = render(<SkillTreeCanvas {...props} />);
    const node = await screen.findByLabelText('节点 node-1 准备状态');
    const originalX = node.getAttribute('data-x');
    fireEvent.click(screen.getByRole('button', { name: '测量节点 node-1' }));
    fireEvent.click(screen.getByRole('button', { name: '拖动节点 node-1' }));
    expect(node).toHaveAttribute('data-measured-width', '240');
    expect(node).toHaveAttribute('data-x', '321');
    view.rerender(<SkillTreeCanvas {...props} selectedNodeId="node-1" />);
    await waitFor(() => expect(node).toHaveAttribute('data-selected', 'true'));
    expect(node).toHaveAttribute('data-measured-width', '240');
    expect(node).toHaveAttribute('data-measured-height', '104');
    expect(node).toHaveAttribute('data-x', '321');
    const completed: LearningTreeSnapshot = { ...snapshot, progress: [{ node_id: 'node-1', progress_percent: 100, status: 'completed', evidence: '' }] };
    view.rerender(<SkillTreeCanvas {...props} snapshot={completed} selectedNodeId="node-1" />);
    await waitFor(() => expect(node).toHaveAttribute('data-progress', '100'));
    expect(node).toHaveAttribute('data-measured-width', '240');
    expect(node).toHaveAttribute('data-y', '654');
    view.rerender(<SkillTreeCanvas {...props} snapshot={completed} layoutMode="blocks" selectedNodeId="node-1" />);
    await waitFor(() => expect(node).toHaveAttribute('data-x', originalX));
    expect(node).toHaveAttribute('data-measured-width', '240');
  });

  it.each([undefined, 'mapflow.motion.viewport'])('pauses flow during viewport interaction and resumes even without viewport persistence (%s)', async viewportStorageKey => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} viewportStorageKey={viewportStorageKey} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '开始移动地图' }));
    expect(canvas).toHaveAttribute('data-mapflow-moving', 'true');
    fireEvent.click(screen.getByRole('button', { name: '移动地图' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-moving', 'true');
    if (viewportStorageKey) expect(localStorage.getItem(viewportStorageKey + '.relationship')).toContain('0.63');
  });

  it('observes edge visibility, handles added and removed edges, and disconnects without late DOM writes', async () => {
    let notifyIntersections!: IntersectionObserverCallback;
    const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notifyIntersections = callback; }
      observe = observe; unobserve = unobserve; disconnect = disconnect;
    });
    const graph: LearningTreeSnapshot = { ...snapshot, nodes: [...snapshot.nodes, { ...snapshot.nodes[0], id: 'node-2', depth_level: 2 }],
      edges: [{ id: 'edge', source_node_id: 'node-1', target_node_id: 'node-2', edge_type: 'prerequisite', label: null }] };
    const view = render(<SkillTreeCanvas snapshot={graph} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    const canvas = screen.getByTestId('skill-tree-flow');
    await waitFor(() => expect(canvas.querySelector('.mapflow-block-connection')).toBeInTheDocument());
    const edge = canvas.querySelector('.mapflow-block-connection')!;
    await waitFor(() => expect(observe).toHaveBeenCalledWith(edge));
    expect(canvas).toHaveAttribute('data-mapflow-flow-visibility', 'observed');
    notifyIntersections([{ target: edge, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(edge).toHaveAttribute('data-mapflow-flow-visible', 'true');
    notifyIntersections([{ target: edge, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(edge).toHaveAttribute('data-mapflow-flow-visible', 'false');
    const added = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    added.classList.add('mapflow-block-connection');
    canvas.querySelector('svg')!.append(added);
    await waitFor(() => expect(observe).toHaveBeenCalledWith(added));
    added.remove();
    await waitFor(() => expect(unobserve).toHaveBeenCalledWith(added));
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    edge.removeAttribute('data-mapflow-flow-visible');
    notifyIntersections([{ target: edge, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(edge).not.toHaveAttribute('data-mapflow-flow-visible');
  });

  it('pauses the same flow animation while moving a card and resumes when the card is released', async () => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '开始拖动节点' }));
    expect(canvas).toHaveAttribute('data-mapflow-moving', 'true');
    fireEvent.click(screen.getByRole('button', { name: '拖动节点 node-1' }));
    expect(screen.getByLabelText('节点 node-1 准备状态')).toHaveAttribute('data-x', '321');
    fireEvent.click(screen.getByRole('button', { name: '结束拖动节点' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-moving', 'true');
  });

  it('keeps flow paused when card dragging overlaps viewport auto-pan', async () => {
    render(<SkillTreeCanvas snapshot={snapshot} displayMode="personal" layoutMode="relationship"
      selectedNodeId={null} isGraphVisible onSelectNode={() => undefined} />);
    await screen.findByLabelText('节点 node-1 准备状态');
    const canvas = screen.getByTestId('skill-tree-flow');
    fireEvent.click(screen.getByRole('button', { name: '开始拖动节点' }));
    fireEvent.click(screen.getByRole('button', { name: '开始移动地图' }));
    fireEvent.click(screen.getByRole('button', { name: '移动地图' }));
    expect(canvas).toHaveAttribute('data-mapflow-moving', 'true');
    fireEvent.click(screen.getByRole('button', { name: '结束拖动节点' }));
    expect(canvas).not.toHaveAttribute('data-mapflow-moving', 'true');
  });

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
      expect(screen.getByText('虚线：直接前置')).toBeVisible();
      expect(screen.getByText('实线：直接后续')).toBeVisible();
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
