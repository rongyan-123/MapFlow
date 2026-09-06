#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fromJSONSchema } from 'zod';
import { readTokenFile } from './token-file.js';
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
  const tokenFile = (await import('./token-file.js')).tokenFilePath();
  const cached = await readTokenFile(tokenFile);
  if (cached) return cached;
  return runDeviceFlow({ baseUrl: serverUrl(), label: tokenLabel(), tokenFile, fetchImpl: fetch, openImpl: (url) => void openBrowser(url) });
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
  const tokenFile = (await import('./token-file.js')).tokenFilePath();
  let token = await obtainToken();
  const server = new McpServer({ name: 'mapflow', version: '0.1.0' });

  // 与服务器同源的工具清单:先拉一次(冷启动遇已吊销的缓存 token 时自动清缓存重授),再逐工具注册
  const startup = await listToolsAtStartup({
    baseUrl, token, fetchImpl: fetch,
    reauthorize: async () => {
      const { clearTokenFile } = await import('./token-file.js');
      await clearTokenFile(tokenFile);
      return obtainToken();
    },
  });
  token = startup.token;
  const listed = startup.listed;
  for (const tool of listed.tools) {
    server.registerTool(tool.name, { description: tool.description ?? '', inputSchema: toZodSchema(tool.inputSchema) }, async (args: unknown) => {
      try {
        const result = await rpcCall({ baseUrl, token, method: 'tools/call', params: { name: tool.name, arguments: args }, fetchImpl: fetch });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        if (error instanceof MapflowRpcError && isRevokedResponse((error as unknown as { status?: number }).status ?? 0, error.operationCode)) {
          const { clearTokenFile } = await import('./token-file.js');
          await clearTokenFile(tokenFile);
          token = await obtainToken();
          const retried = await rpcCall({ baseUrl, token, method: 'tools/call', params: { name: tool.name, arguments: args }, fetchImpl: fetch });
          return { content: [{ type: 'text', text: JSON.stringify(retried) }] };
        }
        return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 直接以 node 运行本文件(bin 入口)才启动主流程;被测试 import 时保持惰性,不抢 stdin。
// Windows 下盘符大小写可能不一致,统一小写比较。
const isDirectRun = process.argv[1] !== undefined
  && import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase();
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
