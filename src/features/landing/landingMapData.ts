import { AGENT_TREE } from '../../lib/agentTreeData';

export type LandingMapStatus = 'understood' | 'exploring' | 'next';

export interface LandingMapNode {
  id: string;
  label: string;
  detail: string;
  status: LandingMapStatus;
  lat: number;
  lng: number;
}

export interface LandingMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface LandingRoute {
  id: string;
  source: [number, number];
  target: [number, number];
  color: string;
}

function findNodeByCategory(category: string) {
  return AGENT_TREE.nodes.find((node) => node.category === category);
}

function findNodeByTitle(fragment: string) {
  return AGENT_TREE.nodes.find((node) => node.title.includes(fragment));
}

function nodeDetail(category: string, titleFragment: string, fallback: string): string {
  return findNodeByCategory(category)?.title ?? findNodeByTitle(titleFragment)?.title ?? fallback;
}

/**
 * The labels and details are sourced from the bundled Agent learning tree.
 * Positions are presentation coordinates for the landing illustration, not user progress.
 */
export const LANDING_MAP_NODES: LandingMapNode[] = [
  {
    id: 'python',
    label: 'Python 基础',
    detail: nodeDetail('Python 基础', 'Python', 'Python 语法与工程基础'),
    status: 'understood',
    lat: 35.68,
    lng: 139.69,
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    detail: nodeDetail('FastAPI', 'FastAPI', '服务层与请求处理'),
    status: 'understood',
    lat: 50.11,
    lng: 8.68,
  },
  {
    id: 'llm',
    label: 'LLM API',
    detail: nodeDetail('LLM API', 'LLM', '模型原理与 API 设计'),
    status: 'exploring',
    lat: 37.77,
    lng: -122.42,
  },
  {
    id: 'agent',
    label: 'Agent 核心',
    detail: nodeDetail('Agent 核心', 'Agent', 'Agent 核心能力与 MCP'),
    status: 'exploring',
    lat: 1.29,
    lng: 103.85,
  },
  {
    id: 'langgraph',
    label: 'LangGraph',
    detail: nodeDetail('LangGraph', 'LangGraph', '状态、流程与编排'),
    status: 'next',
    lat: 52.52,
    lng: 13.4,
  },
  {
    id: 'rag',
    label: 'RAG',
    detail: nodeDetail('RAG', 'RAG', '检索增强与可验证回答'),
    status: 'next',
    lat: -33.87,
    lng: 151.21,
  },
  {
    id: 'production',
    label: '生产化',
    detail: nodeDetail('生产化', '生产', '观测、安全与交付'),
    status: 'next',
    lat: 40.71,
    lng: -74.01,
  },
];

export const LANDING_MAP_EDGES: LandingMapEdge[] = [
  { id: 'python-fastapi', source: 'python', target: 'fastapi' },
  { id: 'fastapi-llm', source: 'fastapi', target: 'llm' },
  { id: 'llm-agent', source: 'llm', target: 'agent' },
  { id: 'agent-langgraph', source: 'agent', target: 'langgraph' },
  { id: 'agent-rag', source: 'agent', target: 'rag' },
  { id: 'rag-production', source: 'rag', target: 'production' },
];

export const LANDING_MAP_MCP_NODE: LandingMapNode = {
  id: 'mcp',
  label: 'MCP / 数据库迁移',
  detail: '示例操作：把刚才讨论的数据库迁移，整理进我的地图',
  status: 'exploring',
  lat: 25.03,
  lng: 121.56,
};

export const LANDING_EARTH_ROUTES: LandingRoute[] = [
  { id: 'python-fastapi', source: [35.68, 139.69], target: [50.11, 8.68], color: '#58d5cc' },
  { id: 'fastapi-llm', source: [50.11, 8.68], target: [37.77, -122.42], color: '#70a7ff' },
  { id: 'llm-agent', source: [37.77, -122.42], target: [1.29, 103.85], color: '#cf8bff' },
  { id: 'agent-rag', source: [1.29, 103.85], target: [-33.87, 151.21], color: '#ffad80' },
  { id: 'rag-production', source: [-33.87, 151.21], target: [40.71, -74.01], color: '#58d5cc' },
];

export function getLandingMapNode(nodeId: string): LandingMapNode | undefined {
  return [...LANDING_MAP_NODES, LANDING_MAP_MCP_NODE].find((node) => node.id === nodeId);
}
