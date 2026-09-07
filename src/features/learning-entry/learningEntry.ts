import type { SkillNode, SkillTree } from '../../types/learning';

export interface TreeGuide {
  title: string;
  eyebrow: string;
  summary: string;
  audience: string;
  question: string;
  prerequisites: string[];
  recommendedNodeTitle: string | null;
}

const OFFICIAL_TREE_GUIDES: Record<string, Omit<TreeGuide, 'title'>> = {
  '005d217e-2106-4a8f-ab84-769d48f52c08': {
    eyebrow: '后端与 AI 应用',
    summary: '沿着服务边界、数据流和 Agent 能力，把一套 NestJS 后端拆成可以逐步验证的路径。',
    audience: '正在把 Node.js / NestJS 走向生产的开发者',
    question: 'NestJS 服务怎样接住一次真实的 AI 请求？',
    prerequisites: ['能读懂基本 TypeScript', '知道 HTTP 请求与数据库的大致作用'],
    recommendedNodeTitle: 'NestJS 项目结构与模块边界',
  },
  '9369e054-3c40-4a46-9952-3abbde4195a1': {
    eyebrow: 'Python Agent 开发',
    summary: '从 Python 语法和服务层开始，逐步连接模型、工具、Agent 模式与生产化。',
    audience: '已有编程经验、想用 Python 构建 Agent 的开发者',
    question: 'Python Agent 如何从一次模型调用变成可上线的服务？',
    prerequisites: ['会写一种主流编程语言', '知道 API 和异步请求的大致概念'],
    recommendedNodeTitle: 'Python 语法快速入门（面向有经验者）',
  },
};

export function getTreeGuide(tree: SkillTree): TreeGuide {
  const officialGuide = OFFICIAL_TREE_GUIDES[tree.id];
  if (officialGuide) {
    return { title: tree.title, ...officialGuide };
  }

  return {
    title: tree.title,
    eyebrow: tree.topic,
    summary: tree.description ?? `从「${tree.topic}」中选择一个现在最想弄懂的部分，沿着关系继续往下。`,
    audience: '已经有一个具体问题，想把它拆成可走路径的人',
    question: `我想先弄懂「${tree.topic}」里的哪个关键关系？`,
    prerequisites: ['知道自己想解决的一个具体问题'],
    recommendedNodeTitle: null,
  };
}

export function findRecommendedNodeId(
  nodes: readonly SkillNode[],
  guide: TreeGuide,
): string | null {
  const namedNode = guide.recommendedNodeTitle
    ? nodes.find((node) => node.title === guide.recommendedNodeTitle)
    : undefined;
  if (namedNode) return namedNode.id;

  const firstNode = [...nodes]
    .sort((left, right) => left.depth_level - right.depth_level || left.order_in_level - right.order_in_level)[0];
  return firstNode?.id ?? null;
}
