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
  let response: Response;
  try {
    response = await deps.fetchImpl(`${deps.baseUrl}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${deps.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: deps.method, params: deps.params }),
    });
  } catch {
    // M4:fetch 抛错 = 网络型错误(无 HTTP 状态可辨)→ 清晰中文提示,不带原始 fetch failed
    throw new Error(`无法连接 MapFlow 服务器(${deps.baseUrl}),请检查网络后重试。`);
  }
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; data?: { code?: string } }; result?: unknown;
    code?: unknown; message?: unknown;
  };
  if (!response.ok) {
    // M1:任何非 2xx 都是失败——服务器认证失败(401)与存储不可用(503 等)在 JSON-RPC
    // 分发前都返回扁平信封(code/message 在顶层),嵌套信封(error.data.code)也一并归一。
    // 兜底:401 → auth.invalid_token(历史语义);其余状态 → unknown + HTTP 状态文案,
    // 绝不让错误落成 result null(此前会表现为工具结果 "null" / TypeError)。
    const code = body.error?.data?.code ?? (typeof body.code === 'string' ? body.code : undefined)
      ?? (response.status === 401 ? 'auth.invalid_token' : 'unknown');
    const message = body.error?.message ?? (typeof body.message === 'string' ? body.message
      : response.status === 401 ? '令牌无效,请重新执行 npx @mapflow/mcp 授权。'
      : `服务暂不可用(HTTP ${response.status}),请稍后重试。`);
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
