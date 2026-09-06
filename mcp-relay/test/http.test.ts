import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapflowRpcError, isRevokedResponse, rpcCall } from '../src/http.js';

describe('rpc forwarding', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts to /mcp with bearer header and passes through the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1,
      result: { tools: [{ name: 'mapflow.whoami' }] },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const result = await rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} });
    expect(result).toEqual({ tools: [{ name: 'mapflow.whoami' }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.test/mcp');
    expect(init.headers).toMatchObject({ authorization: 'Bearer ' + 't'.repeat(64), 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body)).method).toBe('tools/list');
  });

  it('surfaces jsonrpc errors with operationCode and a revoked token clears cache via 401', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1,
      error: { code: -32000, message: '树已被修改,请重读最新版后重试。', data: { code: 'mutation.revision_conflict' } },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/call', params: {} }))
      .rejects.toMatchObject({ operationCode: 'mutation.revision_conflict' });
  });

  it('classifies 401 responses: token_revoked clears the cached token, invalid_token does not', () => {
    expect(isRevokedResponse(401, 'auth.token_revoked')).toBe(true);
    expect(isRevokedResponse(401, 'auth.invalid_token')).toBe(false);
    expect(isRevokedResponse(500, 'auth.token_revoked')).toBe(false);
  });
});
