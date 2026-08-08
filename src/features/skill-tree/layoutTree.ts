import type { SkillEdge, SkillNode } from '../../types/learning';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 32;
const VERTICAL_GAP = 56;

/**
 * 树状瀑布布局：从根节点开始按真实依赖关系逐层展开。
 *
 * 分层不用数据里的 depth_level（阶段号），因为树内存在跨阶段长边
 * （如阶段 1 → 阶段 8）和阶段内依赖链，按阶段号分层会退化成等宽网格。
 * 这里用「最长路径 + 边跨度」分层：每条边至少跨 1 层（阶段内链逐节点
 * 展开成瀑布），跨阶段边按阶段差拉开层距，保证树按依赖深度自然生长。
 * 层内节点按父节点平均位置排序（barycenter），等距排列并居中。
 */
export function computeTreeLayout(
  nodes: SkillNode[],
  edges: SkillEdge[],
): Map<string, { x: number; y: number }> {
  const children = new Map(nodes.map((n) => [n.id, []] as [string, string[]]));
  const parents = new Map(nodes.map((n) => [n.id, []] as [string, string[]]));
  const depthLevel = new Map(nodes.map((n) => [n.id, n.depth_level]));
  const span = new Map<string, number>();
  edges.forEach((edge) => {
    children.get(edge.source_node_id)!.push(edge.target_node_id);
    parents.get(edge.target_node_id)!.push(edge.source_node_id);
    span.set(
      `${edge.source_node_id}>${edge.target_node_id}`,
      Math.max(
        1,
        (depthLevel.get(edge.target_node_id) ?? 1) -
          (depthLevel.get(edge.source_node_id) ?? 1),
      ),
    );
  });

  // Kahn 拓扑 + 最长路径分层
  const indegree = new Map(
    nodes.map((n) => [n.id, parents.get(n.id)!.length]),
  );
  const layer = new Map(nodes.map((n) => [n.id, 0]));
  const queue = nodes
    .filter((n) => parents.get(n.id)!.length === 0)
    .map((n) => n.id);
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (const v of children.get(u)!) {
      layer.set(
        v,
        Math.max(
          layer.get(v) ?? 0,
          (layer.get(u) ?? 0) + (span.get(`${u}>${v}`) ?? 1),
        ),
      );
      indegree.set(v, (indegree.get(v) ?? 0) - 1);
      if (indegree.get(v) === 0) queue.push(v);
    }
  }

  // 按层分组
  const levels = new Map<number, SkillNode[]>();
  nodes.forEach((node) => {
    const lvl = layer.get(node.id) ?? 0;
    const bucket = levels.get(lvl) ?? [];
    bucket.push(node);
    levels.set(lvl, bucket);
  });
  const orderedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);

  // 逐层：层内按父节点平均位置排序（barycenter），等距排列并居中
  const columnStep = NODE_WIDTH + HORIZONTAL_GAP;
  const rowStep = NODE_HEIGHT + VERTICAL_GAP;
  const orderInLayer = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();

  orderedLevels.forEach(([lvl, levelNodes]) => {
    const sorted = [...levelNodes].sort((a, b) => {
      if (lvl === 0) return a.order_in_level - b.order_in_level;
      const parentAvg = (id: string) => {
        const ps = parents.get(id) ?? [];
        return (
          ps.reduce((sum, p) => sum + (orderInLayer.get(p) ?? 0), 0) / ps.length
        );
      };
      return parentAvg(a.id) - parentAvg(b.id);
    });
    const levelWidth = sorted.length * columnStep - HORIZONTAL_GAP;
    const startX = -levelWidth / 2;
    sorted.forEach((node, index) => {
      orderInLayer.set(node.id, index);
      positions.set(node.id, {
        x: startX + index * columnStep,
        y: lvl * rowStep,
      });
    });
  });

  return positions;
}
