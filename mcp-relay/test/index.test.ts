import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listToolsAtStartup, isDirectRun } from '../src/index.js';

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

describe('isDirectRun 主模块判定守卫', () => {
  // 以 src/index.ts 代表「本模块文件」(测试导入的同一文件,真实存在于仓库)。
  const mainFile = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const mainModuleUrl = pathToFileURL(mainFile).href;
  const tmp = (prefix: string) => join(tmpdir(), `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  it('直接运行:argv1 与本模块指向同一真实文件 → true', () => {
    expect(isDirectRun(mainFile, mainModuleUrl)).toBe(true);
  });

  it('被其他程序拉起(argv1 指向另一存在的文件)→ false', () => {
    const other = fileURLToPath(new URL('./device-flow.test.ts', import.meta.url));
    expect(other).not.toBe(mainFile);
    expect(isDirectRun(other, mainModuleUrl)).toBe(false);
  });

  it('argv1 未提供(undefined)→ false', () => {
    expect(isDirectRun(undefined, mainModuleUrl)).toBe(false);
  });

  it('argv1 是并不存在的路径 → false', () => {
    const ghost = tmp('mapflow-ghost');
    expect(existsSync(ghost)).toBe(false);
    expect(isDirectRun(ghost, mainModuleUrl)).toBe(false);
  });

  it('符号链接形态(npm .bin / npx 拉起):argv1 为指向本模块的链接 → true', (ctx) => {
    // N1 回归锁定:Node 对主模块做 realpath,import.meta.url 已被归一,
    // 而 argv[1] 仍是用户键入的链接路径——守卫必须 realpath 归一后比较。
    const link = `${tmp('mapflow-link')}.js`;
    try {
      symlinkSync(mainFile, link, 'file');
    } catch (error) {
      ctx.skip(`无法创建符号链接(${(error as NodeJS.ErrnoException).code ?? String(error)});Windows 需开发者模式/管理员权限,跳过本用例`);
      return;
    }
    try {
      expect(isDirectRun(link, mainModuleUrl)).toBe(true);
    } finally {
      try { unlinkSync(link); } catch { /* 清理失败不影响断言结论 */ }
    }
  });
});
