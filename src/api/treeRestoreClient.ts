import { request as apiFetch } from './http';
import { PublicUiError, publicHttpErrorMessage } from '../lib/publicErrors';
export interface RestorePoint { snapshotId: string | null; canRestore: boolean; revision?: number }
const path = (entry: string) => `/api/me/tree-library/${encodeURIComponent(entry)}/restore`;
async function request(entry: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await apiFetch(path(entry), {credentials:'same-origin', ...init}); }
  catch { throw new PublicUiError('暂时无法连接，请检查网络后重试。'); }
  let body: unknown;
  try { body = await response.json(); } catch { throw new PublicUiError('恢复信息暂时无法读取，请稍后重试。'); }
  if (!response.ok) {
    const code = isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string' ? body.error.code : '';
    throw new PublicUiError(publicHttpErrorMessage(code, response.status));
  }
  return body;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export async function fetchRestorePoint(entry: string): Promise<RestorePoint> {
  const body = await request(entry,{method:'GET',headers:{Accept:'application/json'}});
  if (!isRecord(body) || !(body.snapshotId === null || typeof body.snapshotId === 'string') || typeof body.canRestore !== 'boolean' || (body.canRestore && !body.snapshotId)) throw new PublicUiError('恢复信息暂时无法读取，请稍后重试。');
  return body as unknown as RestorePoint;
}
export async function restoreTree(entry: string, snapshotId: string, csrfToken: string): Promise<void> {
  const body = await request(entry,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({snapshotId})});
  if (!isRecord(body) || body.snapshotId !== snapshotId || typeof body.revision !== 'number' || !Number.isSafeInteger(body.revision) || body.revision < 1) throw new PublicUiError('恢复结果暂时无法确认，请重新读取地图后重试。');
}
