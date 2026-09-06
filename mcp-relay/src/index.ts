#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fromJSONSchema } from 'zod';
import { clearTokenFile, readTokenFile, tokenFilePath } from './token-file.js';
import { runDeviceFlow, openBrowser } from './device-flow.js';
import { rpcCall, isRevokedResponse, MapflowRpcError } from './http.js';
import type { FetchLike } from './http.js';
import { serverUrl, tokenLabel } from './config.js';

// SDK 1.30 的 McpServer 只接受 zod schema(裸 JSON Schema 对象会在注册时抛错);
// 用 zod 官方 fromJSONSchema(draft-7)就地转换,描述/必填/枚举/additionalProperties 语义保真,
// 由 SDK 在 tools/list 时原样回显——relay 自身仍不复制任何 schema。
function toZodSchema(inputSchema: unknown): ReturnType<typeof fromJSONSchema> {
  return fromJSONSchema(inputSchema as Parameters<typeof fromJSONSchema>[0], { defaultTarget: 'draft-7' });
}

async function obtainToken(): Promise<string> {
  const tokenFile = tokenFilePath();
  const cached = await readTokenFile(tokenFile);
  if (cached) return cached;
  return runDeviceFlow({ baseUrl: serverUrl(), label: tokenLabel(), tokenFile, fetchImpl: fetch, openImpl: (url) => void openBrowser(url) });
}

// M3:工具调用共享上下文。多个工具回调并发时共用同一实例;吊销恢复后就地刷新 token,
// 恢复完成后各自用最新 token 重发自己的请求。
export interface ToolCallContext {
  baseUrl: string; fetchImpl: FetchLike; token: string;
  /** 完整重授权动作(清缓存 + 走一次授权流程);single-flight 保证并发 401 只执行一次 */
  reauthorize: () => Promise<string>;
}

// M3:模块级 single-flight——并发 401 时首个触发重授权,其余复用同一 in-flight Promise,
// 消除「后到的 clearTokenFile 删掉先者刚写入的新 token」竞态;settle 后复位。
let reauthorizeInFlight: Promise<string> | null = null;
export function reauthorizeTokenOnce(reauthorize: () => Promise<string>): Promise<string> {
  if (!reauthorizeInFlight) {
    reauthorizeInFlight = reauthorize().finally(() => { reauthorizeInFlight = null; });
  }
  return reauthorizeInFlight;
}

/** 单次工具调用(回调核心):遇吊销(401 auth.token_revoked)经 single-flight 重授权后自动重发一次 */
export async function runToolCall(ctx: ToolCallContext, method: string, params: unknown): Promise<unknown> {
  try {
    return await rpcCall({ baseUrl: ctx.baseUrl, token: ctx.token, method, params, fetchImpl: ctx.fetchImpl });
  } catch (error) {
    if (error instanceof MapflowRpcError && isRevokedResponse((error as unknown as { status?: number }).status ?? 0, error.operationCode)) {
      ctx.token = await reauthorizeTokenOnce(ctx.reauthorize);
      return rpcCall({ baseUrl: ctx.baseUrl, token: ctx.token, method, params, fetchImpl: ctx.fetchImpl });
    }
    throw error;
  }
}

/** M2:工具错误文本 = `${operationCode}: ${message}`,给 Agent 机器可分支信号,中文 message 保持可读 */
export function formatToolError(error: unknown): string {
  if (error instanceof MapflowRpcError) return `${error.operationCode}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/** M5:主入口致命错误文案——invalid_token(缓存 token 无效)时附删 token 文件的自救步骤,路径动态拼 */
export function formatFatalError(error: unknown): string {
  const base = error instanceof Error ? error.message : String(error);
  if (error instanceof MapflowRpcError && error.operationCode === 'auth.invalid_token') {
    return `${base}\n若反复失败,请删除 ${tokenFilePath()} 后重试。`;
  }
  return base;
}

export interface StartupToolList {
  tools: Array<{ name: string; description?: string; inputSchema: unknown }>;
}
/** 启动期 tools/list:遇吊销(401 + auth.token_revoked)经 reauthorize 换新 token 后重试一次,与工具回调内的吊销恢复同构 */
export async function listToolsAtStartup(deps: {
  baseUrl: string; fetchImpl: FetchLike; token: string; reauthorize: () => Promise<string>;
}): Promise<{ listed: StartupToolList; token: string }> {
  const fetchList = async (tok: string): Promise<StartupToolList> => {
    const raw = await rpcCall({ baseUrl: deps.baseUrl, token: tok, method: 'tools/list', params: {}, fetchImpl: deps.fetchImpl });
    return raw as StartupToolList;
  };
  try {
    return { listed: await fetchList(deps.token), token: deps.token };
  } catch (error) {
    if (error instanceof MapflowRpcError && isRevokedResponse((error as unknown as { status?: number }).status ?? 0, error.operationCode)) {
      const fresh = await deps.reauthorize();
      return { listed: await fetchList(fresh), token: fresh };
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const baseUrl = serverUrl();
  const tokenFile = tokenFilePath();
  const ctx: ToolCallContext = {
    baseUrl,
    fetchImpl: fetch,
    token: await obtainToken(),
    reauthorize: async () => {
      await clearTokenFile(tokenFile);
      return obtainToken();
    },
  };
  const server = new McpServer({ name: 'mapflow', version: '0.1.0' });

  // 与服务器同源的工具清单:先拉一次(冷启动遇已吊销的缓存 token 时自动清缓存重授),再逐工具注册
  const startup = await listToolsAtStartup({ baseUrl, token: ctx.token, fetchImpl: fetch, reauthorize: ctx.reauthorize });
  ctx.token = startup.token;
  const listed = startup.listed;
  for (const tool of listed.tools) {
    server.registerTool(tool.name, { description: tool.description ?? '', inputSchema: toZodSchema(tool.inputSchema) }, async (args: unknown) => {
      try {
        const result = await runToolCall(ctx, 'tools/call', { name: tool.name, arguments: args });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: formatToolError(error) }] };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 直接以 node 运行本文件(bin 入口)才启动主流程;被测试 import 时保持惰性,不抢 stdin。
// Node 对主模块做 realpath:import.meta.url 已是链接目标的真实路径,而 argv[1] 仍是用户键入
// 的路径——经 npm 全局安装 / npx 的 .bin 符号链接拉起时两者直比必不等 → 进程静默退出。
// 故 argv1 侧 realpath 归一后与 moduleUrl(fileURLToPath)比较;盘符大小写统一小写。
export function isDirectRun(argv1: string | undefined, moduleUrl: string): boolean {
  return argv1 !== undefined
    && existsSync(argv1)
    && realpathSync(argv1).toLowerCase() === fileURLToPath(moduleUrl).toLowerCase();
}
if (isDirectRun(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error(formatFatalError(error));
    process.exit(1);
  });
}
