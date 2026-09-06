import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MapflowRpcError } from '../src/http.js';
import {
  formatFatalError, formatToolError, isDirectRun, listToolsAtStartup, runToolCall,
} from '../src/index.js';
import type { ToolCallContext } from '../src/index.js';

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

describe('runToolCall 工具回调吊销恢复(M3 single-flight)', () => {
  afterEach(() => vi.restoreAllMocks());

  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const bearer = (init: RequestInit) => String((init.headers as Record<string, string>).authorization);
  const ctx = (fetchMock: unknown, reauth: () => Promise<string>): ToolCallContext => ({
    baseUrl: 'https://x.test', fetchImpl: fetchMock as never,
    token: 'a'.repeat(64), reauthorize: reauth,
  });

  it('并发工具调用同时 401 token_revoked:重授权只触发一次,两请求各自用新 token 重发成功', async () => {
    // Response 流只能消费一次 → 每次放行都新建对象,不能跨请求复用
    const resp401 = () => json({ code: 'auth.token_revoked', message: '令牌已吊销,请重新授权。' }, 401);
    const respOk = () => json({ jsonrpc: '2.0', id: 1, result: { applied: true, revision: 11 } }, 200);
    // fetch 逐发受控放行:先放两个 401(模拟同时吊销),重授权完成后再放两个 200
    const pending: Array<(r: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
    let releaseReauth: ((token: string) => void) | undefined;
    const reauth = vi.fn(() => new Promise<string>((resolve) => { releaseReauth = resolve; }));
    const shared: ToolCallContext = ctx(fetchMock, reauth);

    const callA = runToolCall(shared, 'tools/call', { name: 'mapflow.get_tree', arguments: { id: 1 } });
    const callB = runToolCall(shared, 'tools/call', { name: 'mapflow.apply_tree_mutation', arguments: { id: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pending).toHaveLength(2);
    // 同一 tick 放行两个 401 → 两个吊销错误先后落地到重授权路径
    pending.shift()!(resp401());
    pending.shift()!(resp401());
    await vi.waitFor(() => expect(reauth).toHaveBeenCalledTimes(1)); // 首个 401 触发
    await new Promise((resolve) => setTimeout(resolve, 20)); // 给并发方时间汇入同一在飞 Promise
    expect(reauth).toHaveBeenCalledTimes(1); // 仍恰一次(而非各自触发一次 → clearTokenFile 竞态)
    releaseReauth!('f'.repeat(64)); // 重授权完成
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4)); // 两请求各自重发
    expect(pending).toHaveLength(2);
    pending.shift()!(respOk());
    pending.shift()!(respOk());
    const [resultA, resultB] = await Promise.all([callA, callB]);
    expect(resultA).toEqual({ applied: true, revision: 11 });
    expect(resultB).toEqual({ applied: true, revision: 11 });

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    // 前两发(401)带旧 token;后两发(重试)全部换新 token
    expect(calls.slice(0, 2).every(([, init]) => bearer(init) === `Bearer ${'a'.repeat(64)}`)).toBe(true);
    expect(calls.slice(2).every(([, init]) => bearer(init) === `Bearer ${'f'.repeat(64)}`)).toBe(true);
    // 两个不同工具请求各自重发成功(请求体两两对应)
    const names = calls.map(([, init]) => JSON.parse(String(init.body)).params.name);
    expect(names.sort()).toEqual(['mapflow.apply_tree_mutation', 'mapflow.apply_tree_mutation', 'mapflow.get_tree', 'mapflow.get_tree']);
    expect(reauth).toHaveBeenCalledTimes(1);
  });

  it('非吊销错误(503 扁平信封)原样上抛,不触发重授权', async () => {
    const fetchMock = vi.fn(async () => json({ code: 'service.temporarily_unavailable', message: '服务暂不可用,请稍后重试。' }, 503));
    const reauth = vi.fn(async () => 'f'.repeat(64));
    await expect(runToolCall(ctx(fetchMock, reauth), 'tools/call', { name: 'x', arguments: {} }))
      .rejects.toMatchObject({ operationCode: 'service.temporarily_unavailable' });
    expect(reauth).not.toHaveBeenCalled();
  });
});

describe('错误面文案', () => {
  it('M2:工具错误文本 = operationCode + message(机器可分支 + 中文可读)', () => {
    const err = new MapflowRpcError('树已被修改,请重读最新版后重试。', 'mutation.revision_conflict');
    expect(formatToolError(err)).toBe('mutation.revision_conflict: 树已被修改,请重读最新版后重试。');
    expect(formatToolError(new Error('普通失败'))).toBe('普通失败');
  });

  it('M5:invalid_token 致命错误附加删除 token 缓存文件的自救步骤(路径动态拼),其他错误原样', async () => {
    const customTokenFile = join(tmpdir(), `mapflow-fatal-${process.pid}-${Date.now()}.token`);
    process.env.MAPFLOW_TOKEN_FILE = customTokenFile;
    try {
      const err = new MapflowRpcError('令牌无效,请重新执行 npx @mapflow-publish/mcp 授权。', 'auth.invalid_token');
      expect(formatFatalError(err)).toBe(`令牌无效,请重新执行 npx @mapflow-publish/mcp 授权。\n若反复失败,请删除 ${customTokenFile} 后重试。`);
      expect(formatFatalError(new MapflowRpcError('服务暂不可用。', 'service.temporarily_unavailable'))).toBe('服务暂不可用。');
      expect(formatFatalError(new Error('网络断开'))).toBe('网络断开');
    } finally {
      delete process.env.MAPFLOW_TOKEN_FILE;
    }
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
