import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openBrowser, runDeviceFlow } from '../src/device-flow.js';
import { readTokenFile } from '../src/token-file.js';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 模拟 child_process.spawn:返回一个行为近似真实 EventEmitter 的句柄——
// 'error' 无监听时触发即抛(与 Node 的 unhandled 'error' 语义一致,原实现的
// try/catch 拦不住异步 emit,缺命令时会直接崩进程)。
const { spawnMock, emitSpawnError } = vi.hoisted(() => {
  const listeners: Record<string, Array<(err: Error) => void>> = {};
  const child: Record<string, unknown> = {
    on: (event: string, fn: (err: Error) => void) => {
      (listeners[event] ??= []).push(fn);
      return child;
    },
    unref: () => {},
  };
  return {
    spawnMock: vi.fn(() => child),
    emitSpawnError: (err: Error) => {
      const fns = listeners['error'] ?? [];
      if (fns.length === 0) throw err;
      for (const fn of fns) fn(err);
    },
  };
});
vi.mock('node:child_process', () => ({ spawn: spawnMock }));

describe('device flow', () => {
  let tokenFile: string;
  const baseUrl = 'https://test.example';

  beforeEach(() => {
    tokenFile = join(mkdtempSync(join(tmpdir(), 'mapflow-test-')), 'token');
  });
  afterEach(() => vi.restoreAllMocks());

  it('runs the full pending → approved sequence and saves the token', async () => {
    const requestCode = randomUUID();
    const secret = 'e'.repeat(64);
    const token = 'a'.repeat(64);
    let polled = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/mcp/auth/requests') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          requestCode, secret,
          verificationPath: `/api/mcp/auth/approve?code=${requestCode}`,
          expiresInSeconds: 600,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      polled += 1;
      const body = polled === 1
        ? { status: 'pending' }
        : { status: 'approved', token, label: 'test' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const opened = vi.fn();

    await runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: opened, pollIntervalMs: 1 });

    expect(opened).toHaveBeenCalledWith(
      expect.stringContaining(`/api/mcp/auth/approve?code=${requestCode}`),
    );
    expect(await readTokenFile(tokenFile)).toBe(token);
    const pollUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(pollUrls.some((url) => url.endsWith(`/api/mcp/auth/requests/${requestCode}`))).toBe(true);
  });

  it('fails fast when the user denies (200 status expired)', async () => {
    const requestCode = randomUUID();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ requestCode, secret: 'e'.repeat(64), verificationPath: 'x', expiresInSeconds: 600 }), { status: 200 });
      return new Response(JSON.stringify({ status: 'expired' }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    await expect(runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: vi.fn(), pollIntervalMs: 1 }))
      .rejects.toThrow(/过期|expired|超时/i);
    expect(await readTokenFile(tokenFile)).toBeNull();
  });

  it('fails fast when the user denies (server removed the pending entry → poll returns 404)', async () => {
    const requestCode = randomUUID();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ requestCode, secret: 'e'.repeat(64), verificationPath: 'x', expiresInSeconds: 600 }), { status: 200 });
      // 服务器拒绝按钮 → resolve_approval 立即移除 pending 条目 → 后续轮询 404(终态)
      return new Response('not found', { status: 404 });
    });
    // timeoutMs 收紧:若回归成「404 也 continue 空转」,本用例应在 ~1s 内以超时文案失败,而非挂 10 分钟
    await expect(runDeviceFlow({
      baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: vi.fn(),
      pollIntervalMs: 1, timeoutMs: 1000,
    })).rejects.toThrow(/授权已过期或已被拒绝/);
    expect(await readTokenFile(tokenFile)).toBeNull();
  });

  it('maps a network failure (fetch rejects) to a clear cannot-connect message', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: vi.fn() }))
      .rejects.toThrow(`无法连接 MapFlow 服务器(${baseUrl}),请检查网络后重试。`);
  });
});

describe('openBrowser fallback', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints the manual-open hint when the opener command is missing (ENOENT emitted asynchronously)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await openBrowser('https://x.test/approve?code=abc');
    // spawn 对缺失命令异步 emit 'error',try/catch 拦不住;实现必须挂 on('error') 兜底
    emitSpawnError(Object.assign(new Error('spawn xdg-open ENOENT'), { code: 'ENOENT' }));
    expect(logSpy).toHaveBeenCalledWith('请在浏览器打开授权页:https://x.test/approve?code=abc');
  });
});
