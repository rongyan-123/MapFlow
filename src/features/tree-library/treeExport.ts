import type { PersonalTreeDetail } from './types';

const OBJECT_URL_CLEANUP_DELAY_MS = 1_000;

export interface TreeExportPayload {
  format_version: 1;
  tree: PersonalTreeDetail['graph']['tree'];
  nodes: PersonalTreeDetail['graph']['nodes'];
  edges: PersonalTreeDetail['graph']['edges'];
  completedNodeIds: string[];
  progress: {
    completed: number;
    total: number;
  };
}

export type TreeExportFormat = 'json' | 'markdown';

export function buildTreeExportJson(detail: PersonalTreeDetail): TreeExportPayload {
  const completedNodeIds = [...detail.completed_node_ids];
  return {
    format_version: 1,
    tree: detail.graph.tree,
    nodes: detail.graph.nodes,
    edges: detail.graph.edges,
    completedNodeIds,
    progress: {
      completed: completedNodeIds.length,
      total: detail.graph.nodes.length,
    },
  };
}

export function buildTreeExportMarkdown(detail: PersonalTreeDetail): string {
  const completed = new Set(detail.completed_node_ids);
  const { tree, nodes, edges } = detail.graph;
  const nodeTitles = new Map(nodes.map((node) => [node.id, node.title]));
  const lines = [
    `# ${escapeMarkdown(tree.title)}`,
    '',
    `- 主题：${escapeMarkdown(tree.topic)}`,
    `- 难度：${escapeMarkdown(tree.difficulty_level)}`,
    `- 进度：${completed.size}/${nodes.length}`,
  ];
  if (tree.description) lines.push(`- 描述：${escapeMarkdown(tree.description)}`);

  lines.push('', '## 学习节点', '');
  for (const node of nodes) {
    lines.push(`- [${completed.has(node.id) ? 'x' : ' '}] ${escapeMarkdown(node.title)}`);
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
