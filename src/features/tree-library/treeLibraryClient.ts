import type {
  AddedTree,
  NodeProgress,
  NodeNote,
  PersonalLibrary,
  PersonalLibraryEntry,
  PersonalTreeDetail,
  PublicTreeCatalog,
  PublicTreeDetail,
  TreeGraph,
  PublicTreeAttribution,
  PublicationPrepare,
  PublicationResult,
  PublicationStatus,
} from './types';
import type {
  RecommendedDepth,
  SkillBlock,
  SkillEdge,
  SkillNode,
  SkillNodeBlockAssignment,
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

export async function fetchPublicTrees(options: { cursor?: string | null; limit?: number } = {}): Promise<PublicTreeCatalog> {
  const search = new URLSearchParams();
  if (options.limit !== undefined) search.set('limit', String(options.limit));
  if (options.cursor) search.set('cursor', options.cursor);
  const query = search.toString();
  const body = await getJson(`/api/trees/public${query ? `?${query}` : ''}`);
  if (!isRecord(body) || !Array.isArray(body.trees)) throw invalidResponseError();
  const attributions:Record<string,PublicTreeAttribution>={};
  if(isRecord(body.attributions)) for(const [id,value] of Object.entries(body.attributions)) attributions[id]=parseAttribution(value);
  return { trees: body.trees.map(parseSkillTree), attributions, next_cursor:typeof body.next_cursor==='string'?body.next_cursor:null };
}

export async function fetchPublicTree(treeId: string): Promise<PublicTreeDetail> {
  const body = await getJson(`/api/trees/public/${encodeURIComponent(treeId)}`);
  if (!isRecord(body) || body.view_mode !== 'showcase') throw invalidResponseError();
  return { view_mode: 'showcase', graph: parseGraph(body.graph), attribution:body.attribution===null||body.attribution===undefined?null:parseAttribution(body.attribution) };
}

export async function fetchPublicationStatus(entry:string):Promise<PublicationStatus>{const body=await getJson(`/api/me/tree-library/${encodeURIComponent(entry)}/publication`);if(!isRecord(body)||!isNonNegativeInteger(body.source_revision)||!(body.public_tree_id===null||typeof body.public_tree_id==='string')||typeof body.is_public!=='boolean')throw invalidResponseError();return body as unknown as PublicationStatus;}
export async function prepareTreePublication(entry:string,csrf:string,unpublish=false):Promise<PublicationPrepare>{const suffix=unpublish?'/publication/unpublish/prepare':'/publication/prepare';const response=await request(`/api/me/tree-library/${encodeURIComponent(entry)}${suffix}`,{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','X-CSRF-Token':csrf}});return parsePublicationPrepare(await readJson(response));}
export async function executeTreePublication(entry:string,token:string,csrf:string,idempotencyKey:string,unpublish=false):Promise<PublicationResult>{const response=await request(`/api/me/tree-library/${encodeURIComponent(entry)}/publication`,{method:unpublish?'DELETE':'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':idempotencyKey},body:JSON.stringify({confirmationToken:token})});const body=await readJson(response);if(!isRecord(body)||typeof body.state!=='string'||!isNonNegativeInteger(body.source_revision))throw invalidResponseError();return body as unknown as PublicationResult;}

function parsePublicationPrepare(body:unknown):PublicationPrepare{if(!isRecord(body)||!['publish','update','unpublish'].includes(String(body.action))||typeof body.title!=='string'||typeof body.publisher_display_name!=='string'||!isNonNegativeInteger(body.source_revision)||!isNonNegativeInteger(body.node_count)||!isNonNegativeInteger(body.edge_count)||!isNonNegativeInteger(body.block_count)||!isStringArray(body.excludes)||!(body.expected_public_tree_id===null||typeof body.expected_public_tree_id==='string')||typeof body.confirmation_token!=='string'||!isNonNegativeInteger(body.expires_in_seconds))throw invalidResponseError();return body as unknown as PublicationPrepare;}
function parseAttribution(value:unknown):PublicTreeAttribution{if(!isRecord(value)||typeof value.publisher_display_name!=='string')throw invalidResponseError();return {publisher_display_name:value.publisher_display_name,derived_from_public_tree_id:nullable(value.derived_from_public_tree_id),root_public_tree_id:nullable(value.root_public_tree_id),derived_from_title:nullable(value.derived_from_title),derived_from_publisher_display_name:nullable(value.derived_from_publisher_display_name)};}
function nullable(value:unknown):string|null{if(value===null||value===undefined)return null;if(typeof value==='string')return value;throw invalidResponseError();}

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
  const graph = parseGraph(body.graph);
  const nodeProgress = parseNodeProgress(body.node_progress, body.completed_node_ids);
  return {
    view_mode: 'personal',
    library_entry_id: body.library_entry_id,
    graph,
    completed_node_ids: [...body.completed_node_ids],
    node_progress: nodeProgress,
    progress_percent: isProgressPercent(body.progress_percent)
      ? body.progress_percent
      : deriveProgressPercent(graph.nodes.length, nodeProgress),
    noted_node_ids: isStringArray(body.noted_node_ids) ? [...body.noted_node_ids] : [],
  };
}

export async function fetchNodeNote(libraryEntryId:string,nodeId:string):Promise<NodeNote>{
  const body=await getJson(nodeNotePath(libraryEntryId,nodeId));
  return parseNodeNote(body);
}

export async function saveNodeNote(libraryEntryId:string,nodeId:string,markdown:string,expectedVersion:number,csrfToken:string):Promise<NodeNote>{
  const response=await request(nodeNotePath(libraryEntryId,nodeId),{method:'PUT',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({markdown,expectedVersion})});
  return parseNodeNote(await readJson(response));
}

export async function deleteNodeNote(libraryEntryId:string,nodeId:string,expectedVersion:number,csrfToken:string):Promise<NodeNote>{
  const response=await request(nodeNotePath(libraryEntryId,nodeId),{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({expectedVersion})});
  return parseNodeNote(await readJson(response));
}

function nodeNotePath(entry:string,node:string):string{return `/api/me/tree-library/${encodeURIComponent(entry)}/nodes/${encodeURIComponent(node)}/note`;}

function parseNodeNote(value:unknown):NodeNote{
  if(!isRecord(value)||typeof value.node_id!=='string'||typeof value.markdown!=='string'||typeof value.has_note!=='boolean'||!isNonNegativeInteger(value.version)||!(value.updated_at===null||typeof value.updated_at==='string')) throw invalidResponseError();
  return {node_id:value.node_id,markdown:value.markdown,has_note:value.has_note,version:value.version,updated_at:value.updated_at};
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

export async function renamePersonalTree(
  libraryEntryId: string,
  title: string,
  csrfToken: string,
): Promise<void> {
  const entry = encodeURIComponent(libraryEntryId);
  await request(`/api/me/tree-library/${entry}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ title }),
  });
}

export async function deletePersonalTree(
  libraryEntryId: string,
  csrfToken: string,
): Promise<void> {
  const entry = encodeURIComponent(libraryEntryId);
  await request(`/api/me/tree-library/${entry}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
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

export async function setNodeProgress(
  libraryEntryId: string,
  nodeId: string,
  progressPercent: number,
  csrfToken: string,
): Promise<void> {
  if (!isProgressPercent(progressPercent)) {
    throw new TreeLibraryApiError(
      400,
      'tree_library.invalid_progress',
      '节点完成度必须是 0 到 100 的整数。',
    );
  }
  const entry = encodeURIComponent(libraryEntryId);
  const node = encodeURIComponent(nodeId);
  await request(`/api/me/tree-library/${entry}/nodes/${node}/progress`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ progressPercent }),
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
  const tree = parseSkillTree(value.tree);
  return {
    library_entry_id: value.library_entry_id,
    tree,
    completed_nodes: value.completed_nodes,
    progress_percent: isProgressPercent(value.progress_percent)
      ? value.progress_percent
      : tree.total_nodes > 0
        ? Math.round(
            (Math.min(value.completed_nodes, tree.total_nodes) / tree.total_nodes) *
              100,
          )
        : 0,
  };
}

function parseNodeProgress(
  value: unknown,
  completedNodeIds: string[],
): NodeProgress[] {
  if (value === undefined) {
    return completedNodeIds.map((node_id) => ({
      node_id,
      progress_percent: 100,
    }));
  }
  if (!Array.isArray(value)) throw invalidResponseError();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.node_id !== 'string' ||
      !isProgressPercent(item.progress_percent)
    ) {
      throw invalidResponseError();
    }
    return {
      node_id: item.node_id,
      progress_percent: item.progress_percent,
    };
  });
}

function deriveProgressPercent(
  totalNodes: number,
  nodeProgress: NodeProgress[],
): number {
  if (totalNodes <= 0) return 0;
  const sum = nodeProgress.reduce(
    (total, item) => total + item.progress_percent,
    0,
  );
  return Math.max(0, Math.min(100, Math.round(sum / totalNodes)));
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
    blocks: parseOptionalArray(value.blocks, parseSkillBlock),
    node_block_assignments: parseOptionalArray(
      value.node_block_assignments,
      parseSkillNodeBlockAssignment,
    ),
  };
}

function parseOptionalArray<T>(
  value: unknown,
  parser: (item: unknown) => T,
): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidResponseError();
  return value.map(parser);
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
    ...(isNonNegativeInteger(value.revision)
      ? { revision: value.revision }
      : {}),
    ...(value.layout_mode === 'auto' || value.layout_mode === 'manual'
      ? { layout_mode: value.layout_mode }
      : {}),
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

function parseSkillBlock(value: unknown): SkillBlock {
  if (
    !isRecord(value) ||
    typeof value.block_id !== 'string' ||
    typeof value.name !== 'string' ||
    !isNullableString(value.color) ||
    !isNonNegativeInteger(value.sort_order)
  ) {
    throw invalidResponseError();
  }
  return {
    id: value.block_id,
    name: value.name,
    color: value.color,
    sort_order: value.sort_order,
  };
}

function parseSkillNodeBlockAssignment(
  value: unknown,
): SkillNodeBlockAssignment {
  if (
    !isRecord(value) ||
    typeof value.node_id !== 'string' ||
    typeof value.block_id !== 'string'
  ) {
    throw invalidResponseError();
  }
  return {
    node_id: value.node_id,
    block_id: value.block_id,
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

function isProgressPercent(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
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
