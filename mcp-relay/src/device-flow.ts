import { writeTokenFile } from './token-file.js';

export interface DeviceFlowDeps {
  baseUrl: string; label: string; tokenFile: string; fetchImpl: FetchLike;
  openImpl: (url: string) => void; pollIntervalMs?: number; timeoutMs?: number;
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 与服务端 TTL(600s)一致

// M4:fetch 抛错(URL 不可达 / DNS 失败等网络型错误,无 HTTP 状态可辨)转清晰中文提示
const networkErrorMessage = (baseUrl: string) => `无法连接 MapFlow 服务器(${baseUrl}),请检查网络后重试。`;

export async function runDeviceFlow(deps: DeviceFlowDeps): Promise<string> {
  const fetchChecked = async (url: string, init?: RequestInit): Promise<Response> => {
    try {
      return await deps.fetchImpl(url, init ?? {});
    } catch {
      throw new Error(networkErrorMessage(deps.baseUrl));
    }
  };
  const response = await fetchChecked(`${deps.baseUrl}/api/mcp/auth/requests`, {
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
    const pollResponse = await fetchChecked(poll, {
      headers: { authorization: `Bearer ${secret}` },
    });
    // I1:服务器状态机里「拒绝」是终态——approve 页点拒绝后条目被立即移除,轮询返回 404;
    // secret 不符则 401。两者都立即快速报错,不再静默空转到超时。5xx 视为服务端抖动继续等。
    if (pollResponse.status === 404 || pollResponse.status === 401) {
      throw new Error('授权已过期或已被拒绝,请重新运行 npx @mapflow-publish/mcp 再试。');
    }
    if (!pollResponse.ok) continue;
    const body = await pollResponse.json();
    if (body.status === 'approved' && typeof body.token === 'string') {
      await writeTokenFile(deps.tokenFile, body.token);
      return body.token;
    }
    if (body.status === 'expired') {
      throw new Error('授权已过期或已被拒绝,请重新运行 npx @mapflow-publish/mcp 再试。');
    }
  }
  throw new Error('等待授权超时(10 分钟),请重新运行。');
}

export async function openBrowser(url: string): Promise<void> {
  // 用户本机;命令缺失时打印 URL 兜底(无图形环境时用户可手动打开)
  const { spawn } = await import('node:child_process');
  const platform = process.platform;
  const command = platform === 'darwin' ? ['open', url]
    : platform === 'win32' ? ['cmd', '/c', 'start', '', url]
    : ['xdg-open', url];
  // spawn 对缺失命令(ENOENT)异步 emit 'error',try/catch 拦不住 → 挂监听兜底提示
  const child = spawn(command[0], command.slice(1), { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(`请在浏览器打开授权页:${url}`));
  child.unref();
}
