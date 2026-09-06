import { clearTokenFile, readTokenFile, writeTokenFile } from './token-file.js';
import { isRevokedResponse } from './http.js';
import { randomUUID } from 'node:crypto';

export interface DeviceFlowDeps {
  baseUrl: string; label: string; tokenFile: string; fetchImpl: FetchLike;
  openImpl: (url: string) => void; pollIntervalMs?: number; timeoutMs?: number;
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 与服务端 TTL(600s)一致

export async function runDeviceFlow(deps: DeviceFlowDeps): Promise<string> {
  const response = await deps.fetchImpl(`${deps.baseUrl}/api/mcp/auth/requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: deps.label }),
  });
  if (!response.ok) throw new Error(`授权请求创建失败(HTTP ${response.status}),请稍后重试。`);
  const { requestCode, secret, verificationPath } = await response.json();
  const verificationUrl = `${deps.baseUrl}${verificationPath}`;
  deps.openImpl(verificationUrl);
  const poll = `${deps.baseUrl}/api/mcp/auth/requests/${requestCode}`;
  const deadline = Date.now() + (deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const interval = deps.pollIntervalMs ?? 2000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const pollResponse = await deps.fetchImpl(poll, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!pollResponse.ok) continue; // 服务端抖动:继续等
    const body = await pollResponse.json();
    if (body.status === 'approved' && typeof body.token === 'string') {
      await writeTokenFile(deps.tokenFile, body.token);
      return body.token;
    }
    if (body.status === 'expired') {
      throw new Error('授权已过期或已被拒绝,请重新运行 npx @mapflow/mcp 再试。');
    }
  }
  throw new Error('等待授权超时(10 分钟),请重新运行。');
}

export async function openBrowser(url: string): Promise<void> {
  // 用户本机;打印 URL 兜底(无图形环境/命令缺失时用户可手动打开)
  const { spawn } = await import('node:child_process');
  const platform = process.platform;
  const command = platform === 'darwin' ? ['open', url]
    : platform === 'win32' ? ['cmd', '/c', 'start', '', url]
    : ['xdg-open', url];
  try {
    spawn(command[0], command.slice(1), { stdio: 'ignore', detached: true }).unref();
  } catch {
    console.log(`请在浏览器打开授权页:${url}`);
  }
}
