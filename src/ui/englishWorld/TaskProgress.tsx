import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { englishWorldErrorMessage } from '../../api/englishWorldClient';
import { formatAmountMicros } from '../../api/walletClient';
import { formatCreditAmount } from '../../api/creditClient';
import { settlementPending, useWorldTask } from '../../domains/englishWorld/useWorldTask';
import { useWorldOperation } from '../../domains/englishWorld/operations';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { TaskPublic } from '../../domains/englishWorld/types';
import { describePublicError, PublicUiError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { QueryStatus } from '../QueryStatus';
import { OperationNotice, type WorldPageContext } from './shared';

const stateLabels = { queued: '任务已接受，等待开始', running: '正在处理', validating: '正在检查结果', completed: '任务已完成', blocked: '任务等待核对', failed: '任务未完成', stopped: '任务已停止' };
const stageLabels: Record<string, string> = { selecting: '选择本次词汇', writing: '编写案件', validating: '检查世界规则', ready: '世界已准备', opening: '准备开场', adjudicating: '正在判断本次行动', host: '正在判断本次行动', npc: '人物正在回应', translating: '正在查询这个词', debriefing: '正在整理本次复盘', applying: '保存已确认结果' };

export function TaskProgress({ context, taskId, onCompleted, onTask }: { context: WorldPageContext; taskId: string; onCompleted?: (task: TaskPublic) => void; onTask?: (task: TaskPublic) => void }) {
  const task = useWorldTask(context.accountId, taskId);
  const queryClient = useQueryClient();
  const operation = useWorldOperation(context.accountId, 'task.' + taskId, context.csrfToken);
  const [controlError, setControlError] = useState('');
  const notified = useRef('');
  const fundingNotified = useRef('');
  const completed = useRef(onCompleted); completed.current = onCompleted;
  const observed = useRef(onTask); observed.current = onTask;
  useEffect(() => {
    if (!task.data) return;
    observed.current?.(task.data);
    const identity = `${taskId}.${task.data.sequence}.${task.data.state}`;
    const settlementIdentity = `${identity}.${JSON.stringify(task.data.settlement)}`;
    if ((task.data.state === 'completed' || task.data.settlement) && fundingNotified.current !== settlementIdentity) {
      fundingNotified.current = settlementIdentity;
      void queryClient.invalidateQueries({ queryKey: ['me', context.accountId, 'wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['me', context.accountId, 'credit'] });
    }
    if (task.data.state === 'completed' && notified.current !== identity) {
      notified.current = identity;
      completed.current?.(task.data);
    }
  }, [task.data, taskId, context.accountId, queryClient]);
  async function apply(result: TaskPublic) {
    await queryClient.cancelQueries({ queryKey: worldKeys.task(context.accountId, taskId) });
    queryClient.setQueryData(worldKeys.task(context.accountId, taskId), result);
  }
  async function control(action: 'stop' | 'resume') {
    setControlError('');
    try {
      let modelAccess;
      if (action === 'resume' && task.data?.allowedActions.needsCredential) {
        modelAccess = context.funding().modelAccess;
        if (!modelAccess) throw new PublicUiError('请填写与原调用匹配的 API Key 和模型配置。');
      }
      const result = await operation.perform(`/tasks/${taskId}/${action}`, modelAccess ? { modelAccess } : {}, 'task');
      if (result) await apply(result);
    } catch (failure) { setControlError(describePublicError(failure)); }
  }
  const current = task.data;
  return <section className="ew-task" aria-label="任务状态"><QueryStatus pending={task.isPending} error={task.error} retry={() => void task.refetch()} />{current && <>
    <div className="ew-card-meta"><strong role="status">{stateLabels[current.state]}</strong><span>{Math.round(current.progress * 100)}%</span></div>
    <progress aria-label="任务进度" value={current.progress} max={1} /><p>{stageLabels[current.stage] ?? '正在处理本次任务'}</p>
    {current.publicError && <p role="alert" className="mf-status mf-status--error">{englishWorldErrorMessage(current.publicError.code)}</p>}
    {current.state === 'failed' && <p className="mf-muted">这次服务未完成。本局状态以已保存的路线为准。</p>}
    <div className="mf-row mf-wrap">{current.allowedActions.canCheck && <Button disabled={task.isFetching} onClick={() => void task.refetch()}>核对进度</Button>}{current.allowedActions.canStop && <Button disabled={operation.busy || !!operation.pending} onClick={() => void control('stop')}>停止任务</Button>}{current.allowedActions.needsCredential && <Button onClick={context.openModels}>填写原 API Key</Button>}{current.allowedActions.canResume && <Button disabled={operation.busy || !!operation.pending} onClick={() => void control('resume')}>恢复原任务</Button>}</div>
    {current.settlement && <div className="ew-settlement">{settlementPending(current.settlement) ? <p>结果已保存，费用待核账。</p> : current.settlement.cashMicros !== null ? <p>本次费用 ¥{formatAmountMicros(current.settlement.cashMicros)}</p> : current.settlement.pointUnits !== null ? <p>本次消耗 {formatCreditAmount(current.settlement.pointUnits / 1_000_000)} 积分</p> : <p>未扣本站额度。</p>}{current.settlement.balanceMicros !== null && <p>现金余额 ¥{formatAmountMicros(current.settlement.balanceMicros)}</p>}</div>}
  </>}{controlError && <p role="alert" className="mf-status mf-status--error">{controlError}</p>}<OperationNotice operation={operation} apiKey={context.apiKey} onResult={result => { if ('allowedActions' in result) void apply(result); }} /></section>;
}
