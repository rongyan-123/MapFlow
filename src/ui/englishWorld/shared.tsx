import { Button } from '../Button';
import { describePublicError } from '../../lib/publicErrors';
import type { useWorldOperation } from '../../domains/englishWorld/operations';
import type { Accepted, FundingSelection } from '../../domains/englishWorld/types';
import type { WorldMutationResponses, WorldResponseKind } from '../../api/englishWorldClient';

export interface WorldPageContext {
  accountId: string; csrfToken: string; navigate: (href: string) => void;
  funding: () => FundingSelection; apiKey: string; openModels: () => void;
}
export function playAddress(playthroughId: string, branchId?: string) { return `/english-world/play/${playthroughId}${branchId ? '?branch=' + encodeURIComponent(branchId) : ''}`; }
export function followAccepted(result: Accepted, navigate: WorldPageContext['navigate']) {
  if (result.playthroughId) navigate(playAddress(result.playthroughId, result.branchId));
  else if (result.taskId) navigate('/english-world/prepare/' + result.taskId);
  else if (result.worldId) navigate('/english-world/worlds/' + result.worldId);
}
export function OperationNotice({ operation, apiKey, onResult }: { operation: ReturnType<typeof useWorldOperation>; apiKey: string; onResult?: (result: WorldMutationResponses[WorldResponseKind]) => void }) {
  return <>{operation.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(operation.error)}</p>}{operation.pending && <div className="mf-status ew-recovery"><p>原请求状态尚未确认。重放会保留原操作号、模型和资金配置。</p><Button disabled={operation.busy} onClick={() => void operation.replay(apiKey).then(result => { if (result) onResult?.(result); })}>{operation.busy ? '正在核对…' : '重放原请求'}</Button>{operation.canDiscard && <Button disabled={operation.busy} onClick={operation.clear}>返回编辑</Button>}</div>}</>;
}
export const difficultyLabels = { beginner: '初阶', intermediate: '中阶', advanced: '进阶' };
export const branchLabels = { active: '游玩中', dead: '失败路线', completed: '已完成', abandoned: '历史路线' };
