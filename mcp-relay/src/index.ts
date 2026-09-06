#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fromJSONSchema } from 'zod';
import { readTokenFile } from './token-file.js';
import { runDeviceFlow, openBrowser } from './device-flow.js';
import { rpcCall, isRevokedResponse, MapflowRpcError } from './http.js';
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

async function main(): Promise<void> {
  const baseUrl = serverUrl();
  const tokenFile = (await import('./token-file.js')).tokenFilePath();
  let token = await obtainToken();
  const server = new McpServer({ name: 'mapflow', version: '0.1.0' });

  // 与服务器同源的工具清单:先拉一次,再逐工具注册
  const listed = (await rpcCall({ baseUrl, token, method: 'tools/list', params: {}, fetchImpl: fetch })) as { tools: Array<{ name: string; description?: string; inputSchema: unknown }> };
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
