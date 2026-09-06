export const DEFAULT_SERVER_URL = 'https://xxian.fun';
export function serverUrl(): string {
  return (process.env.MAPFLOW_SERVER_URL ?? DEFAULT_SERVER_URL).replace(/\/+$/, '');
}
export function tokenLabel(): string {
  return process.env.MAPFLOW_TOKEN_LABEL ?? 'npx @mapflow/mcp';
}
