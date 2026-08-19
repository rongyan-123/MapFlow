import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAdminAccounts, suspendAdminAccount } from './adminClient';
import type { AdminAccount } from './types';

interface AccountsTabProps {
  csrfToken: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: '正常',
  suspended: '已封禁',
};

export default function AccountsTab({ csrfToken }: AccountsTabProps) {
  const queryClient = useQueryClient();
  const [confirmingAccountId, setConfirmingAccountId] = useState<string | null>(
    null,
  );

  const accountsQuery = useQuery({
    queryKey: ['admin', 'accounts'],
    queryFn: () => fetchAdminAccounts(csrfToken),
    retry: false,
  });

  const suspendMutation = useMutation({
    mutationFn: (accountId: string) => suspendAdminAccount(accountId, csrfToken),
    onSettled: () => setConfirmingAccountId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
    },
  });

  if (accountsQuery.isPending) {
    return <TabPending message="正在读取用户列表…" />;
  }
  if (accountsQuery.isError || !accountsQuery.data) {
    return (
      <TabError
        error={accountsQuery.error}
        onRetry={() => void accountsQuery.refetch()}
      />
    );
  }

  const accounts = accountsQuery.data;

  return (
    <div className="space-y-3">
      {suspendMutation.error && (
        <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-sm leading-6 text-rose-300">
          {readableError(suspendMutation.error)}
        </p>
      )}
      <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/65">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="px-4 py-3 font-semibold">用户名</th>
              <th className="px-4 py-3 font-semibold">状态</th>
              <th className="px-4 py-3 font-semibold">注册时间</th>
              <th className="px-4 py-3 font-semibold">最后活跃</th>
              <th className="px-4 py-3 font-semibold">BYOK 次数</th>
              <th className="px-4 py-3 font-semibold">平台次数</th>
              <th className="px-4 py-3 font-semibold">总 Token</th>
              <th className="px-4 py-3 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.accountId}
                className="border-b border-slate-800/60 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-slate-100">
                  {account.username}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      account.status === 'active'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    {STATUS_LABELS[account.status] ?? account.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {formatIsoDateTime(account.registeredAt)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {formatIsoDateTime(account.lastSeenAt)}
                </td>
                <td className="px-4 py-3 text-slate-400">{account.byokSessions}</td>
                <td className="px-4 py-3 text-slate-400">
                  {account.platformSessions}
                </td>
                <td className="px-4 py-3 text-slate-400">{account.totalTokens}</td>
                <td className="px-4 py-3">
                  <SuspendControl
                    account={account}
                    confirming={confirmingAccountId === account.accountId}
                    pending={suspendMutation.isPending}
                    onRequestSuspend={() => setConfirmingAccountId(account.accountId)}
                    onCancel={() => setConfirmingAccountId(null)}
                    onConfirm={() => suspendMutation.mutate(account.accountId)}
                  />
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  暂无用户。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SuspendControl({
  account,
  confirming,
  pending,
  onRequestSuspend,
  onCancel,
  onConfirm,
}: {
  account: AdminAccount;
  confirming: boolean;
  pending: boolean;
  onRequestSuspend: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (account.status !== 'active') {
    return <span className="text-xs text-slate-600">—</span>;
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={onRequestSuspend}
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/10"
      >
        封禁
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-rose-300">确认封禁？</span>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? '封禁中…' : '确认封禁'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onCancel}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-50"
      >
        取消
      </button>
    </div>
  );
}

function TabPending({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

function TabError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
      <p role="alert" className="text-sm leading-6 text-rose-300">
        {readableError(error)}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
      >
        重新读取
      </button>
    </div>
  );
}

function formatIsoDateTime(iso: string | null): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '管理服务暂时不可用，请稍后再试。';
}
