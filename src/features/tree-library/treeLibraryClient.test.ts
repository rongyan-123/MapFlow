import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TreeLibraryApiError,
  addTreeToPersonalLibrary,
  fetchPersonalLibrary,
  fetchPersonalTree,
  fetchPublicTree,
  fetchPublicTrees,
  setNodeCompletion,
} from './treeLibraryClient';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('treeLibraryClient', () => {
  it('reads the anonymous catalog and public graph with same-origin credentials', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ trees: [tree] }))
      .mockResolvedValueOnce(
        jsonResponse({ view_mode: 'showcase', graph }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPublicTrees()).resolves.toEqual({ trees: [tree] });
    await expect(fetchPublicTree('tree/id')).resolves.toMatchObject({
      view_mode: 'showcase',
      graph: { tree },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/trees/public', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/trees/public/tree%2Fid',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('reads only the authenticated account personal library and detail', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              library_entry_id: 'entry-id',
              tree,
              completed_nodes: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          view_mode: 'personal',
          library_entry_id: 'entry-id',
          graph,
          completed_node_ids: ['node-1'],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPersonalLibrary()).resolves.toMatchObject({
      entries: [{ library_entry_id: 'entry-id', completed_nodes: 1 }],
    });
    await expect(fetchPersonalTree('entry/id')).resolves.toMatchObject({
      view_mode: 'personal',
      completed_node_ids: ['node-1'],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/me/tree-library/entry%2Fid', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  });

  it('adds a tree with only treeId and the in-memory CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ library_entry_id: 'entry-id', tree_id: tree.id }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      addTreeToPersonalLibrary(tree.id, 'csrf-secret'),
    ).resolves.toEqual({ library_entry_id: 'entry-id', tree_id: tree.id });
    expect(fetchMock).toHaveBeenCalledWith('/api/me/tree-library', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-secret',
      },
      body: JSON.stringify({ treeId: tree.id }),
    });
  });

  it('uses PUT and DELETE completion endpoints with encoded path segments', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await setNodeCompletion('entry/id', 'node/中文', true, 'csrf-secret');
    await setNodeCompletion('entry/id', 'node/中文', false, 'csrf-secret');

    const expectedPath =
      '/api/me/tree-library/entry%2Fid/nodes/node%2F%E4%B8%AD%E6%96%87/completion';
    expect(fetchMock).toHaveBeenNthCalledWith(1, expectedPath, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': 'csrf-secret',
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expectedPath, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': 'csrf-secret',
      },
    });
  });

  it.each([
    [401, 'identity.authentication_rejected'],
    [403, 'identity.csrf_rejected'],
    [404, 'route.not_found'],
  ])('preserves the safe %s error envelope', async (status, code) => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code,
            message: '安全错误信息',
            traceId: `trace-${status}`,
          },
        },
        status,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchPersonalLibrary().catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TreeLibraryApiError);
    expect(error).toMatchObject({
      status,
      code,
      message: '安全错误信息',
      traceId: `trace-${status}`,
    });
  });

  it('rejects a malformed graph instead of trusting TypeScript assertions', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        view_mode: 'showcase',
        graph: {
          ...graph,
          nodes: [{ ...node, difficulty: 'three' }],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await fetchPublicTree(tree.id).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TreeLibraryApiError);
    expect(error).toMatchObject({
      status: 502,
      code: 'tree_library.invalid_response',
    });
  });
});

const tree = {
  id: '11111111-1111-4111-8111-111111111111',
  topic: 'NestJS',
  title: 'NestJS 完整学习树',
  description: '从零开始',
  difficulty_level: 'intermediate',
  total_nodes: 1,
};

const node = {
  id: 'node-1',
  tree_id: tree.id,
  title: '模块',
  description: null,
  icon: 'box',
  category: 'foundation',
  difficulty: 1,
  estimated_minutes: 30,
  depth_level: 0,
  position_x: 0,
  position_y: 0,
  order_in_level: 0,
  learning_objectives: null,
  key_concepts: null,
  recommended_depth: 'Understand',
  depth_rationale: '理解模块边界',
  observable_evidence: '可以解释模块结构',
};

const edge = {
  id: 'edge-1',
  source_node_id: 'node-1',
  target_node_id: 'node-2',
  edge_type: 'prerequisite',
  label: null,
};

const graph = {
  tree,
  nodes: [node],
  edges: [edge],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
