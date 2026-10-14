import { describe, expect, it } from 'vitest';
import { buildBlockConnections, getBlockConnectionRoute } from './blockConnections';
import type { SkillEdge } from '../../types/learning';

const dependencies: SkillEdge[] = [
  { id: 'in', source_node_id: 'before', target_node_id: 'selected', edge_type: 'prerequisite', label: null },
  { id: 'out', source_node_id: 'selected', target_node_id: 'after', edge_type: 'prerequisite', label: null },
  { id: 'other', source_node_id: 'after', target_node_id: 'unrelated', edge_type: 'prerequisite', label: null },
];

describe('块布局关联线', () => {
  it('只展示直接关联线，并保留前置到后置的真实方向', () => {
    expect(buildBlockConnections(dependencies, 'selected').map(({ source, target, data }) => ({ source, target, relation: data?.relation }))).toEqual([
      { source: 'before', target: 'selected', relation: 'incoming' },
      { source: 'selected', target: 'after', relation: 'outgoing' },
    ]);
    expect(buildBlockConnections(dependencies, null)).toEqual([]);
    expect(buildBlockConnections(dependencies, 'missing')).toEqual([]);
  });

  it('切换选中节点后重新判断进出关系', () => {
    expect(buildBlockConnections(dependencies, 'after').map(({ id, data }) => [id, data?.relation])).toEqual([
      ['out', 'incoming'], ['other', 'outgoing'],
    ]);
  });
});

const first = { x: 0, y: 0, width: 240, height: 104 };

describe('曲线方向与避让', () => {
  it('同排节点从底部绕行，曲线中段离开分块边框', () => {
    const route = getBlockConnectionRoute(first, { ...first, x: 552 }, []);
    expect(route.start).toEqual({ x: 120, y: 104 });
    expect(route.end).toEqual({ x: 672, y: 104 });
    expect(route.points.some((point) => point.y > 144)).toBe(true);
    expect(route.points.every((point) => point.y >= 104)).toBe(true);
  });

  it('同列跨排连接仍有弧度，末端到达后置节点顶部', () => {
    const route = getBlockConnectionRoute(first, { ...first, y: 264 }, []);
    expect(route.start).toEqual({ x: 120, y: 104 });
    expect(route.end).toEqual({ x: 120, y: 264 });
    expect(route.points.some((point) => Math.abs(point.x - 120) > 5)).toBe(true);
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

  it('多条同列连接分开弧度，并始终保持端点不变', () => {
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
