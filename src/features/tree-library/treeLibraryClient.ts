import type {
  AddedTree,
  PersonalLibrary,
  PersonalLibraryEntry,
  PersonalTreeDetail,
  PublicTreeCatalog,
  PublicTreeDetail,
  TreeGraph,
} from './types';
import type {
  RecommendedDepth,
  SkillEdge,
  SkillNode,
  SkillTree,
} from '../../types/learning';

const JSON_GET: RequestInit = {
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
};

export class TreeLibraryApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;

  constructor(status: number, code: string, message: string, traceId?: string) {
    super(message);
    this.name = 'TreeLibraryApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

export async function fetchPublicTrees(): Promise<PublicTreeCatalog> {
  const body = await getJson('/api/trees/public');
  if (!isRecord(body) || !Array.isArray(body.trees)) throw invalidResponseError();
  return { trees: body.trees.map(parseSkillTree) };
}

export async function fetchPublicTree(treeId: string): Promise<PublicTreeDetail> {
  const body = await getJson(`/api/trees/public/${encodeURIComponent(treeId)}`);
  if (!isRecord(body) || body.view_mode !== 'showcase') throw invalidResponseError();
  return { view_mode: 'showcase', graph: parseGraph(body.graph) };
}

export async function fetchPersonalLibrary(): Promise<PersonalLibrary> {
  const body = await getJson('/api/me/tree-library');
  if (!isRecord(body) || !Array.isArray(body.entries)) throw invalidResponseError();
  return { entries: body.entries.map(parsePersonalLibraryEntry) };
}

export async function fetchPersonalTree(
  libraryEntryId: string,
): Promise<PersonalTreeDetail> {
  const body = await getJson(
    `/api/me/tree-library/${encodeURIComponent(libraryEntryId)}`,
  );
  if (
    !isRecord(body) ||
    body.view_mode !== 'personal' ||
    typeof body.library_entry_id !== 'string' ||
    !isStringArray(body.completed_node_ids)
  ) {
    throw invalidResponseError();
  }
  return {
    view_mode: 'personal',
    library_entry_id: body.library_entry_id,
    graph: parseGraph(body.graph),
    completed_node_ids: [...body.completed_node_ids],
  };
}

export async function addTreeToPersonalLibrary(
  treeId: string,
  csrfToken: string,
): Promise<AddedTree> {
  const response = await request('/api/me/tree-library', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ treeId }),
  });
  const body = await readJson(response);
  if (
    !isRecord(body) ||
    typeof body.library_entry_id !== 'string' ||
    typeof body.tree_id !== 'string'
  ) {
    throw invalidResponseError();
  }
  return {
    library_entry_id: body.library_entry_id,
    tree_id: body.tree_id,
  };
}

export async function setNodeCompletion(
  libraryEntryId: string,
  nodeId: string,
  completed: boolean,
  csrfToken: string,
): Promise<void> {
  const entry = encodeURIComponent(libraryEntryId);
  const node = encodeURIComponent(nodeId);
  await request(`/api/me/tree-library/${entry}/nodes/${node}/completion`, {
    method: completed ? 'PUT' : 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}

async function getJson(path: string): Promise<unknown> {
  return readJson(await request(path, JSON_GET));
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new TreeLibraryApiError(
      0,
      'network.unavailable',
      '技能树服务暂时无法连接。',
    );
  }
  if (!response.ok) throw await parseError(response);
  return response;
}

async function parseError(response: Response): Promise<TreeLibraryApiError> {
  try {
    const body: unknown = await response.json();
    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return new TreeLibraryApiError(
        response.status,
        body.error.code,
        body.error.message,
        typeof body.error.traceId === 'string' ? body.error.traceId : undefined,
      );
    }
  } catch {
    // A malformed body is replaced with a stable local error below.
  }
  return new TreeLibraryApiError(
    response.status,
    'tree_library.request_failed',
    '技能树请求失败，请稍后重试。',
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw invalidResponseError();
  }
}

function parsePersonalLibraryEntry(value: unknown): PersonalLibraryEntry {
  if (
    !isRecord(value) ||
    typeof value.library_entry_id !== 'string' ||
    !isNonNegativeInteger(value.completed_nodes)
  ) {
    throw invalidResponseError();
  }
  return {
    library_entry_id: value.library_entry_id,
    tree: parseSkillTree(value.tree),
    completed_nodes: value.completed_nodes,
  };
}

function parseGraph(value: unknown): TreeGraph {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw invalidResponseError();
  }
  return {
    tree: parseSkillTree(value.tree),
    nodes: value.nodes.map(parseSkillNode),
    edges: value.edges.map(parseSkillEdge),
  };
}

function parseSkillTree(value: unknown): SkillTree {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.topic !== 'string' ||
    typeof value.title !== 'string' ||
    !isNullableString(value.description) ||
    typeof value.difficulty_level !== 'string' ||
    !isNonNegativeInteger(value.total_nodes)
  ) {
    throw invalidResponseError();
  }
  return {
    id: value.id,
    topic: value.topic,
    title: value.title,
    description: value.description,
    difficulty_level: value.difficulty_level,
    total_nodes: value.total_nodes,
  };
}

function parseSkillNode(value: unknown): SkillNode {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.tree_id !== 'string' ||
    typeof value.title !== 'string' ||
    !isNullableString(value.description) ||
    typeof value.icon !== 'string' ||
    typeof value.category !== 'string' ||
    !isNonNegativeInteger(value.difficulty) ||
    !isNonNegativeInteger(value.estimated_minutes) ||
    !isNonNegativeInteger(value.depth_level) ||
    !isFiniteNumber(value.position_x) ||
    !isFiniteNumber(value.position_y) ||
    !isNonNegativeInteger(value.order_in_level) ||
    !isNullableString(value.learning_objectives) ||
    !isNullableString(value.key_concepts) ||
    !isRecommendedDepth(value.recommended_depth) ||
    typeof value.depth_rationale !== 'string' ||
    typeof value.observable_evidence !== 'string'
  ) {
    throw invalidResponseError();
  }
  return {
    id: value.id,
    tree_id: value.tree_id,
    title: value.title,
    description: value.description,
    icon: value.icon,
    category: value.category,
    difficulty: value.difficulty,
    estimated_minutes: value.estimated_minutes,
    depth_level: value.depth_level,
    position_x: value.position_x,
    position_y: value.position_y,
    order_in_level: value.order_in_level,
    learning_objectives: value.learning_objectives,
    key_concepts: value.key_concepts,
    recommended_depth: value.recommended_depth,
    depth_rationale: value.depth_rationale,
    observable_evidence: value.observable_evidence,
  };
}

function parseSkillEdge(value: unknown): SkillEdge {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.source_node_id !== 'string' ||
    typeof value.target_node_id !== 'string' ||
    typeof value.edge_type !== 'string' ||
    !isNullableString(value.label)
  ) {
    throw invalidResponseError();
  }
  return {
    id: value.id,
    source_node_id: value.source_node_id,
    target_node_id: value.target_node_id,
    edge_type: value.edge_type,
    label: value.label,
  };
}

function invalidResponseError(): TreeLibraryApiError {
  return new TreeLibraryApiError(
    502,
    'tree_library.invalid_response',
    '技能树服务返回了无法识别的结果。',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecommendedDepth(value: unknown): value is RecommendedDepth {
  return (
    value === 'Recognize' ||
    value === 'Understand' ||
    value === 'Use' ||
    value === 'Transfer' ||
    value === 'DeepMastery'
  );
}
