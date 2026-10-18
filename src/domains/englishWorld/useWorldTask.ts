import { useQuery } from '@tanstack/react-query';
import { fetchTask } from '../../api/englishWorldClient';
import { worldKeys } from './queryKeys';
import type { TaskPublic } from './types';

export function settlementPending(settlement: TaskPublic['settlement']) {
  return !!settlement && (!['settled', 'no_site_charge', 'audit_only'].includes(settlement.status)
    || settlement.status === 'settled' && settlement.cashMicros === null && settlement.pointUnits === null);
}
export function useWorldTask(accountId: string, taskId: string) {
  return useQuery<TaskPublic>({ queryKey: worldKeys.task(accountId, taskId), queryFn: ({ signal }) => fetchTask(taskId, signal), retry: false,
    refetchInterval: query => {
      const task = query.state.data;
      if (task && ['queued', 'running', 'validating'].includes(task.state)) return 1500;
      return settlementPending(task?.settlement ?? null) ? 5000 : false;
    } });
}
