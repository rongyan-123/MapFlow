import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDeviceFlow } from '../src/device-flow.js';
import { readTokenFile } from '../src/token-file.js';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it('fails fast when the user denies (status expired)', async () => {
    const requestCode = randomUUID();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ requestCode, secret: 'e'.repeat(64), verificationPath: 'x', expiresInSeconds: 600 }), { status: 200 });
      return new Response(JSON.stringify({ status: 'expired' }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    await expect(runDeviceFlow({ baseUrl, label: 'test', tokenFile, fetchImpl: fetchMock as never, openImpl: vi.fn(), pollIntervalMs: 1 }))
      .rejects.toThrow(/过期|expired|超时/i);
    expect(await readTokenFile(tokenFile)).toBeNull();
  });
});
