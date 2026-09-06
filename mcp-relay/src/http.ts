export class MapflowRpcError extends Error {
  readonly operationCode: string;
  constructor(message: string, operationCode: string) {
    super(message);
    this.operationCode = operationCode;
  }
}
/** 401 且 data.code 是 auth.* → 抛出需要重授权的专用信号 */
export function isRevokedResponse(status: number, dataCode: unknown): boolean {
  return status === 401 && dataCode === 'auth.token_revoked';
}
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RpcDeps { baseUrl: string; token: string; method: string; params: unknown; fetchImpl: FetchLike; }
export async function rpcCall(deps: RpcDeps): Promise<unknown> {
  const response = await deps.fetchImpl(`${deps.baseUrl}/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deps.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: deps.method, params: deps.params }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; data?: { code?: string } }; result?: unknown;
    code?: unknown; message?: unknown;
  };
  if (response.status === 401) {
    // 服务器认证失败在 JSON-RPC 分发前直接返回扁平信封(code/message 在顶层),
    // 与 JSON-RPC 嵌套信封(error.data.code)两种形态都兼容。
    const code = body.error?.data?.code ?? (typeof body.code === 'string' ? body.code : undefined) ?? 'auth.invalid_token';
    const message = body.error?.message ?? (typeof body.message === 'string' ? body.message : '令牌无效,请重新执行 npx @mapflow/mcp 授权。');
    const error = new MapflowRpcError(message, code);
    (error as unknown as { status: number }).status = response.status;
    throw error;
  }
  if (body.error) {
    throw new MapflowRpcError(body.error.message ?? '服务返回错误。', body.error.data?.code ?? 'unknown');
  }
  // 200 + 畸形体(无 result)时给 null 而非 undefined,避免 JSON.stringify 产出非法 content
  return body.result ?? null;
}
