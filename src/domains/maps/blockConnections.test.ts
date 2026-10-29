import { describe, expect, it } from 'vitest';
import { buildBlockConnections, getBlockConnectionRoute } from './blockConnections';
import type { SkillEdge } from '../../types/learning';

const dependencies: SkillEdge[] = [
  { id: 'in', source_node_id: 'before', target_node_id: 'selected', edge_type: 'prerequisite', label: null },
  { id: 'out', source_node_id: 'selected', target_node_id: 'after', edge_type: 'prerequisite', label: null },
  { id: 'other', source_node_id: 'after', target_node_id: 'unrelated', edge_type: 'prerequisite', label: null },
];

describe('块布局关联线', () => {
  it('carries completion independently from the stable branch and selected relation',()=>{
    const edges=buildBlockConnections(dependencies,'selected','relationship',undefined,new Set(['before']));
    expect(edges[0].data).toMatchObject({relation:'incoming',sourceLit:true,targetLit:false});
    expect(edges[1].data).toMatchObject({relation:'outgoing',sourceLit:false,targetLit:false});
  });
  it('keeps each cross-branch endpoint in its own branch color without changing the dependency direction',()=>{
    const branches=new Map([
      ['before',{key:'category:a',label:'基础',tone:'teal' as const}],
      ['selected',{key:'category:b',label:'应用',tone:'violet' as const}],
    ]);
    const edge=buildBlockConnections(dependencies,'selected','relationship',branches)[0];
    expect(edge.source).toBe('before');expect(edge.target).toBe('selected');
    expect(edge.data).toMatchObject({sourceTone:'teal',targetTone:'violet',relation:'incoming'});
  });
  it('保留旧按块行为：未选不画边，选中只画该节点局部关系', () => {
    expect(buildBlockConnections(dependencies, null)).toEqual([]);
    expect(buildBlockConnections(dependencies, 'missing')).toEqual([]);
    expect(buildBlockConnections(dependencies, 'selected').map(edge => [edge.id, edge.data?.relation])).toEqual([
      ['in', 'incoming'], ['out', 'outgoing'],
    ]);
    const related = { ...dependencies[0], id: 'related', edge_type: 'related' };
    expect(buildBlockConnections([...dependencies, related], 'selected').map(edge => [edge.id, edge.data?.relation])).toEqual([
      ['in', 'incoming'], ['out', 'outgoing'], ['related', 'neutral'],
    ]);
  });
  it('主连接保持真实方向，只高亮选中节点的直接前置和直接后续', () => {
    expect(buildBlockConnections(dependencies, 'selected', 'relationship').map(({ source, target, data }) => ({ source, target, relation: data?.relation }))).toEqual([
      { source: 'before', target: 'selected', relation: 'incoming' },
      { source: 'selected', target: 'after', relation: 'outgoing' },
      { source: 'after', target: 'unrelated', relation: 'neutral' },
    ]);
    expect(buildBlockConnections(dependencies, null, 'relationship').map(edge => [edge.id, edge.data?.relation])).toEqual([
      ['in', 'neutral'], ['out', 'neutral'], ['other', 'neutral'],
    ]);
    expect(buildBlockConnections(dependencies, 'missing', 'relationship').map(edge => edge.data?.relation)).toEqual(['neutral', 'neutral', 'neutral']);
  });

  it('切换选中节点后重新判断进出关系', () => {
    expect(buildBlockConnections(dependencies, 'after', 'relationship').map(({ id, data }) => [id, data?.relation])).toEqual([
      ['in', 'neutral'], ['out', 'incoming'], ['other', 'outgoing'],
    ]);
  });

  it('related和未知类型保留原边，但不能伪装为前置知识', () => {
    const edges = [
      ...dependencies,
      { ...dependencies[0], id: 'related', edge_type: 'related' },
      { ...dependencies[1], id: 'unknown', edge_type: 'future_relation' },
    ];
    const selected = buildBlockConnections(edges, 'selected', 'relationship');
    expect(selected.map(edge => [edge.id, edge.source, edge.target])).toEqual(edges.map(edge => [edge.id, edge.source_node_id, edge.target_node_id]));
    expect(selected.filter(edge => edge.id === 'related' || edge.id === 'unknown').map(edge => edge.data?.relation)).toEqual(['neutral', 'neutral']);
  });

  it('局部路由有界且切换选择不会让连线路径跳动', () => {
    const edges = Array.from({ length: 170 }, (_, index) => ({ ...dependencies[0], id: `edge-${String(index).padStart(3, '0')}`, target_node_id: `target-${index}` }));
    const normal = buildBlockConnections(edges, null, 'relationship');
    const selected = buildBlockConnections(edges, 'before', 'relationship');
    expect(normal.map(edge => edge.data?.lane)).toEqual(selected.map(edge => edge.data?.lane));
    expect(normal.every(edge => edge.data!.lane >= 0 && edge.data!.lane <= 4)).toBe(true);
    expect(new Set(normal.map(edge => edge.data?.lane)).size).toBe(170);
  });

  it('知识关系布局默认为每个节点保留最近的一条直接前置', () => {
    const edges = [
      { ...dependencies[0], id: 'far', source_node_id: 'far' },
      { ...dependencies[0], id: 'near', source_node_id: 'near' },
    ];
    const positions = new Map([
      ['selected', { x: 0, y: 336 }],
      ['far', { x: 552, y: 0 }],
      ['near', { x: 0, y: 168 }],
    ]);
    expect(buildBlockConnections(edges, null, 'relationship', undefined, undefined, positions).map(edge => edge.id)).toEqual(['near']);
  });

  it('直接前置比距离更近的知识关联优先，没有前置时保留最近的知识关联', () => {
    const edges = [
      { ...dependencies[0], id: 'prerequisite', source_node_id: 'far' },
      { ...dependencies[0], id: 'related-near', source_node_id: 'near', edge_type: 'requires' },
      { ...dependencies[0], id: 'fallback-far', source_node_id: 'far', target_node_id: 'fallback', edge_type: 'requires' },
      { ...dependencies[0], id: 'fallback-near', source_node_id: 'near', target_node_id: 'fallback', edge_type: 'requires' },
    ];
    const positions = new Map([
      ['selected', { x: 0, y: 336 }], ['fallback', { x: 0, y: 504 }],
      ['far', { x: 552, y: 0 }], ['near', { x: 0, y: 168 }],
    ]);
    expect(buildBlockConnections(edges, null, 'relationship', undefined, undefined, positions).map(edge => edge.id)).toEqual(['prerequisite', 'fallback-near']);
  });

  it.each([new Map([
    ['selected', { x: 0, y: 336 }], ['left', { x: -276, y: 168 }], ['right', { x: 276, y: 168 }],
  ]), undefined])('距离相同或坐标缺失时，重排输入不会切换主连线 (%s)', positions => {
    const edges = [
      { ...dependencies[0], id: 'z-right', source_node_id: 'right' },
      { ...dependencies[0], id: 'a-left', source_node_id: 'left' },
    ];
    for (const ordered of [edges, [...edges].reverse()]) {
      expect(buildBlockConnections(ordered, null, 'relationship', undefined, undefined, positions).map(edge => edge.id)).toEqual(['a-left']);
    }
  });

  it('只展开选中节点的全部直接关系，切换或取消选择后恢复其他节点的主连接', () => {
    const edges = [
      { ...dependencies[0], id: 'near', source_node_id: 'near' },
      { ...dependencies[0], id: 'far', source_node_id: 'far' },
      { ...dependencies[0], id: 'expanded-related', source_node_id: 'selected', target_node_id: 'child', edge_type: 'requires' },
      { ...dependencies[0], id: 'child-primary', source_node_id: 'other', target_node_id: 'child' },
      { ...dependencies[0], id: 'remote-near', source_node_id: 'near', target_node_id: 'remote' },
      { ...dependencies[0], id: 'remote-far', source_node_id: 'far', target_node_id: 'remote' },
    ];
    const original = structuredClone(edges);
    const positions = new Map([
      ['selected', { x: 0, y: 336 }], ['near', { x: 0, y: 168 }], ['far', { x: 552, y: 0 }],
      ['child', { x: 0, y: 504 }], ['other', { x: 276, y: 336 }], ['remote', { x: 276, y: 336 }],
    ]);
    const visible = (selected: string | null) => buildBlockConnections(edges, selected, 'relationship', undefined, undefined, positions);
    expect(visible(null).map(edge => edge.id)).toEqual(['near', 'child-primary', 'remote-near']);
    expect(visible('selected').map(edge => edge.id)).toEqual(['near', 'far', 'expanded-related', 'child-primary', 'remote-near']);
    expect(visible('remote').map(edge => edge.id)).toEqual(['near', 'child-primary', 'remote-near', 'remote-far']);
    expect(visible(null).map(edge => edge.id)).toEqual(['near', 'child-primary', 'remote-near']);
    expect(edges).toEqual(original);
  });
});

const first = { x: 0, y: 0, width: 240, height: 104 };

describe('正交连接方向与避让', () => {
  it('同排节点从底部绕行，折线中段离开分块边框', () => {
    const route = getBlockConnectionRoute(first, { ...first, x: 552 }, []);
    expect(route.start).toEqual({ x: 120, y: 104 });
    expect(route.end).toEqual({ x: 672, y: 104 });
    expect(route.points.some((point) => point.y > 144)).toBe(true);
    expect(route.points.every((point) => point.y >= 104)).toBe(true);
  });

  it('同列跨排使用直接垂线，末端到达后置节点顶部', () => {
    const route = getBlockConnectionRoute(first, { ...first, y: 264 }, []);
    expect(route.start).toEqual({ x: 120, y: 104 });
    expect(route.end).toEqual({ x: 120, y: 264 });
    expect(route.path).not.toMatch(/[CQSA]/i);
    expect(route.points.every((point) => point.x === 120)).toBe(true);
  });

  it('反向依赖从上排方向离开前置，指向后置节点底部', () => {
    const route = getBlockConnectionRoute({ ...first, y: 264 }, first, []);
    expect(route.start).toEqual({ x: 120, y: 264 });
    expect(route.end).toEqual({ x: 120, y: 104 });
  });

  it('跨越多排时绕开中间卡片，包括卡片旁的安全间隙', () => {
    const obstacle = { ...first, y: 264 };
    const route = getBlockConnectionRoute(first, { ...first, y: 528 }, [obstacle]);
    expect(route.points.every(({ x, y }) =>
      !(x > -12 && x < 252 && y > 252 && y < 380),
    )).toBe(true);
    expect(route.end).toEqual({ x: 120, y: 528 });
  });

  it('多条同列连接分开折线路径，并始终保持端点不变', () => {
    const target = { ...first, y: 264 };
    const firstRoute = getBlockConnectionRoute(first, target, [], 0);
    const nextRoute = getBlockConnectionRoute(first, target, [], 1);
    expect(firstRoute.path).not.toBe(nextRoute.path);
    expect(firstRoute.start).toEqual(nextRoute.start);
    expect(firstRoute.end).toEqual(nextRoute.end);
  });

  it('跨排绕行的多条连接不共用同一条长路径', () => {
    const target = { ...first, y: 528 };
    const obstacles = [{ ...first, y: 264 }];
    const paths = [0, 1, 2].map((lane) => getBlockConnectionRoute(first, target, obstacles, lane).path);
    expect(new Set(paths).size).toBe(3);
  });
});
