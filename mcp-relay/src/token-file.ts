import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function tokenFilePath(): string {
  return process.env.MAPFLOW_TOKEN_FILE ?? join(homedir(), '.mapflow', 'token');
}
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export async function readTokenFile(path = tokenFilePath()): Promise<string | null> {
  try {
    const raw = (await readFile(path, 'utf8')).trim();
    return TOKEN_PATTERN.test(raw) ? raw : null;
  } catch {
    return null; // 不存在或不可读 → 视为未授权
  }
}
export async function writeTokenFile(path: string, token: string): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) throw new Error('refusing to store a malformed token');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, token + '\n', { mode: 0o600 });
  try { await chmod(path, 0o600); } catch { /* Windows 无 posix 权限位,忽略 */ }
}
export async function clearTokenFile(path = tokenFilePath()): Promise<void> {
  try { await rm(path); } catch { /* 已不存在则忽略 */ }
}
