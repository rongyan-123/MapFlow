import type { PersonalTreeDetail } from './types';

const OBJECT_URL_CLEANUP_DELAY_MS = 1_000;

export interface TreeExportPayload {
  format_version: 1;
  tree: PersonalTreeDetail['graph']['tree'];
  nodes: PersonalTreeDetail['graph']['nodes'];
  edges: PersonalTreeDetail['graph']['edges'];
  completedNodeIds: string[];
  nodeProgress: Array<{ nodeId: string; progressPercent: number }>;
  progress: {
    completed: number;
    inProgress: number;
    percentage: number;
    total: number;
  };
}

export type TreeExportFormat = 'json' | 'markdown';

export function buildTreeExportJson(detail: PersonalTreeDetail): TreeExportPayload {
  const progress = buildProgressMap(detail);
  const completedNodeIds = detail.graph.nodes
    .filter((node) => progress.get(node.id) === 100)
    .map((node) => node.id);
  const nodeProgress = [...progress.entries()]
    .filter(([, progressPercent]) => progressPercent > 0)
    .map(([nodeId, progressPercent]) => ({
      nodeId,
      progressPercent,
    }));
  const summary = summarizeProgress(detail.graph.nodes.length, progress);
  return {
    format_version: 1,
    tree: detail.graph.tree,
    nodes: detail.graph.nodes,
    edges: detail.graph.edges,
    completedNodeIds,
    nodeProgress,
    progress: summary,
  };
}

export function buildTreeExportMarkdown(detail: PersonalTreeDetail): string {
  const progress = buildProgressMap(detail);
  const summary = summarizeProgress(detail.graph.nodes.length, progress);
  const { tree, nodes, edges } = detail.graph;
  const nodeTitles = new Map(nodes.map((node) => [node.id, node.title]));
  const lines = [
    `# ${escapeMarkdown(tree.title)}`,
    '',
    `- 主题：${escapeMarkdown(tree.topic)}`,
    `- 难度：${escapeMarkdown(tree.difficulty_level)}`,
    `- 进度：${summary.percentage}%（${summary.completed}/${nodes.length} 已完成）`,
  ];
  if (tree.description) lines.push(`- 描述：${escapeMarkdown(tree.description)}`);

  lines.push('', '## 学习节点', '');
  for (const node of nodes) {
    const nodePercent = progress.get(node.id) ?? 0;
    const progressLabel =
      nodePercent > 0 && nodePercent < 100 ? `（${nodePercent}%）` : '';
    lines.push(
      `- [${nodePercent === 100 ? 'x' : ' '}] ${escapeMarkdown(node.title)}${progressLabel}`,
    );
    lines.push(`  - 分类：${escapeMarkdown(node.category)}`);
    lines.push(`  - 难度：${node.difficulty}/5；预计 ${node.estimated_minutes} 分钟`);
    lines.push(`  - 推荐深度：${escapeMarkdown(node.recommended_depth)}`);
    if (node.description) lines.push(`  - 描述：${escapeMarkdown(node.description)}`);
    appendJsonList(lines, '核心概念', node.key_concepts);
    appendJsonList(lines, '学习目标', node.learning_objectives);
    lines.push(`  - 深度理由：${escapeMarkdown(node.depth_rationale)}`);
    lines.push(`  - 通过标准：${escapeMarkdown(node.observable_evidence)}`);
    lines.push('');
  }

  lines.push('## 节点关系', '');
  if (edges.length === 0) {
    lines.push('暂无节点关系。');
  } else {
    for (const edge of edges) {
      const source = nodeTitles.get(edge.source_node_id) ?? edge.source_node_id;
      const target = nodeTitles.get(edge.target_node_id) ?? edge.target_node_id;
      const label = edge.label?.trim() || edge.edge_type;
      lines.push(
        `- ${escapeMarkdown(source)} → ${escapeMarkdown(target)}（${escapeMarkdown(label)}）`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function buildProgressMap(detail: PersonalTreeDetail): Map<string, number> {
  const progress = new Map<string, number>();
  for (const item of detail.node_progress ?? []) {
    if (
      detail.graph.nodes.some((node) => node.id === item.node_id) &&
      Number.isInteger(item.progress_percent) &&
      item.progress_percent >= 0 &&
      item.progress_percent <= 100 &&
      item.progress_percent > 0
    ) {
      progress.set(item.node_id, item.progress_percent);
    }
  }
  for (const nodeId of detail.completed_node_ids) {
    if (!progress.has(nodeId)) progress.set(nodeId, 100);
  }
  return progress;
}

function summarizeProgress(
  total: number,
  progress: Map<string, number>,
): { completed: number; inProgress: number; percentage: number; total: number } {
  const values = [...progress.values()];
  const completed = values.filter((value) => value === 100).length;
  const inProgress = values.filter((value) => value > 0 && value < 100).length;
  const percentage = total
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / total)
    : 0;
  return { completed, inProgress, percentage, total };
}

export function downloadTreeExport(
  detail: PersonalTreeDetail,
  format: TreeExportFormat,
): void {
  const isJson = format === 'json';
  const body = isJson
    ? `${JSON.stringify(buildTreeExportJson(detail), null, 2)}\n`
    : buildTreeExportMarkdown(detail);
  const blob = new Blob([body], {
    type: isJson ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(detail.graph.tree.title)}.${format === 'json' ? 'json' : 'md'}`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, OBJECT_URL_CLEANUP_DELAY_MS);
}

function appendJsonList(lines: string[], label: string, raw: string | null): void {
  const values = parseStringList(raw);
  if (values.length > 0) lines.push(`  - ${label}：${values.map(escapeMarkdown).join('、')}`);
}

function parseStringList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]{}<>]/gu, '\\$&').replace(/\n/gu, ' ');
}

function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
    .replace(/\s+/gu, ' ')
    .trim();
  return (cleaned || 'mapflow-skill-tree').slice(0, 80);
}
