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

  // 服务器认证失败在 JSON-RPC 分发前直接返回扁平信封,code/message 在顶层而非 error.data 内
  it('parses the flat auth envelope: 401 token_revoked must reach the revoke recovery path', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 'auth.token_revoked', message: '令牌已吊销,请重新授权。',
    }), { status: 401, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toMatchObject({ operationCode: 'auth.token_revoked', message: '令牌已吊销,请重新授权。' });
  });

  it('keeps a flat 401 invalid_token classified as not revoked', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 'auth.invalid_token', message: '令牌无效。',
    }), { status: 401, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toMatchObject({ operationCode: 'auth.invalid_token' });
  });

  it('still parses the nested jsonrpc auth envelope on 401 (backwards compatible)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1,
      error: { code: -32001, message: '令牌已吊销,请重新授权。', data: { code: 'auth.token_revoked' } },
    }), { status: 401, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toMatchObject({ operationCode: 'auth.token_revoked', message: '令牌已吊销,请重新授权。' });
  });

  it('returns null (not undefined) for a 200 body without result, keeping tool content valid JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .resolves.toBeNull();
  });

  // 服务器存储不可用时在 JSON-RPC 分发前返回 503 扁平信封 —— 同样应归一为 MapflowRpcError,不得落 null
  it('maps a flat non-2xx envelope (503 service temporarily unavailable) to MapflowRpcError', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 'service.temporarily_unavailable', message: '服务暂不可用,请稍后重试。',
    }), { status: 503, headers: { 'content-type': 'application/json' } }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toMatchObject({ operationCode: 'service.temporarily_unavailable', message: '服务暂不可用,请稍后重试。' });
  });

  it('does not swallow a bare non-2xx without any envelope (HTML 500 from a proxy) into null', async () => {
    const fetchMock = vi.fn(async () => new Response('<html>oops</html>', { status: 500 }));
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toThrow('服务暂不可用(HTTP 500),请稍后重试。');
  });

  it('maps a network failure (fetch rejects) to a clear cannot-connect message', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(rpcCall({ baseUrl: 'https://x.test', token: 't'.repeat(64), fetchImpl: fetchMock as never, method: 'tools/list', params: {} }))
      .rejects.toThrow('无法连接 MapFlow 服务器(https://x.test),请检查网络后重试。');
  });
});
