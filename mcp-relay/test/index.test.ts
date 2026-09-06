import { afterEach, describe, expect, it, vi } from 'vitest';
import { listToolsAtStartup } from '../src/index.js';

describe('startup tools/list with revoke recovery', () => {
  afterEach(() => vi.restoreAllMocks());

  const toolsPayload = { tools: [{ name: 'mapflow.whoami', inputSchema: { type: 'object' } }] };
  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('lists tools once with the current token when the server accepts it', async () => {
    const fetchMock = vi.fn(async () => json({ jsonrpc: '2.0', id: 1, result: toolsPayload }, 200));
    const reauthorize = vi.fn(async () => 'f'.repeat(64));
    const current = 'a'.repeat(64);
    const { listed, token } = await listToolsAtStartup({ baseUrl: 'https://x.test', token: current, fetchImpl: fetchMock as never, reauthorize });
    expect(token).toBe(current);
    expect(listed.tools[0].name).toBe('mapflow.whoami');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reauthorize).not.toHaveBeenCalled();
  });

  it('on a flat 401 token_revoked clears via reauthorize and retries the list once with the fresh token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ code: 'auth.token_revoked', message: '令牌已吊销,请重新授权。' }, 401))
      .mockResolvedValueOnce(json({ jsonrpc: '2.0', id: 1, result: toolsPayload }, 200));
    const current = 'a'.repeat(64);
    const fresh = 'f'.repeat(64);
    const reauthorize = vi.fn(async () => fresh);
    const { listed, token } = await listToolsAtStartup({ baseUrl: 'https://x.test', token: current, fetchImpl: fetchMock as never, reauthorize });
    expect(token).toBe(fresh);
    expect(listed.tools[0].name).toBe('mapflow.whoami');
    expect(reauthorize).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect((calls[0][1].headers as Record<string, string>).authorization).toBe(`Bearer ${current}`);
    expect((calls[1][1].headers as Record<string, string>).authorization).toBe(`Bearer ${fresh}`);
  });

  it('rethrows non-revoked failures untouched without reauthorizing', async () => {
    const fetchMock = vi.fn(async () => json({
      jsonrpc: '2.0', id: 1,
      error: { code: -32000, message: '树已被修改,请重读最新版后重试。', data: { code: 'mutation.revision_conflict' } },
    }, 200));
    const reauthorize = vi.fn(async () => 'f'.repeat(64));
    await expect(listToolsAtStartup({ baseUrl: 'https://x.test', token: 'a'.repeat(64), fetchImpl: fetchMock as never, reauthorize }))
      .rejects.toMatchObject({ operationCode: 'mutation.revision_conflict' });
    expect(reauthorize).not.toHaveBeenCalled();
  });
});
