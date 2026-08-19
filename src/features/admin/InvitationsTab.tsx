import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAdminInvitations, revokeAdminInvitation } from './adminClient';
import type { AdminInvitation } from './types';

interface InvitationsTabProps {
  csrfToken: string;
}

const STATUS_LABELS: Record<string, string> = {
  available: '可用',
  redeemed: '已兑换',
  revoked: '已作废',
};

export default function InvitationsTab({ csrfToken }: InvitationsTabProps) {
  const queryClient = useQueryClient();
  const [confirmingInviteId, setConfirmingInviteId] = useState<string | null>(
    null,
  );

  const invitationsQuery = useQuery({
    queryKey: ['admin', 'invitations'],
    queryFn: () => fetchAdminInvitations(csrfToken),
    retry: false,
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeAdminInvitation(inviteId, csrfToken),
    onSettled: () => setConfirmingInviteId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] });
    },
  });

  if (invitationsQuery.isPending) {
    return <TabPending message="正在读取邀请码…" />;
  }
  if (invitationsQuery.isError || !invitationsQuery.data) {
    return (
      <TabError
        error={invitationsQuery.error}
        onRetry={() => void invitationsQuery.refetch()}
      />
    );
  }

  const { summary, items } = invitationsQuery.data;

  return (
    <div className="space-y-4">
      {revokeMutation.error && (
        <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-sm leading-6 text-rose-300">
          {readableError(revokeMutation.error)}
        </p>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <h2 className="text-sm font-semibold text-slate-100">邀请码分布</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="可用" value={summary.available} />
          <SummaryCard label="已兑换" value={summary.redeemed} />
          <SummaryCard label="已作废" value={summary.revoked} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/65">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">邀请码明细</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            出于安全考虑，不显示邀请码明文；仅展示状态与兑换关联信息。
          </p>
        </div>
        <ul>
          {items.map((invitation) => (
            <li
              key={invitation.inviteId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800/60 px-4 py-3 last:border-b-0"
            >
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  invitation.status === 'available'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : invitation.status === 'redeemed'
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {STATUS_LABELS[invitation.status] ?? invitation.status}
              </span>
              <span className="text-xs text-slate-500">
                创建于 {formatIsoDateTime(invitation.createdAt)}
              </span>
              {invitation.redeemedBy && (
                <span className="text-xs text-slate-400">
                  兑换人 {invitation.redeemedBy}
                </span>
              )}
              {invitation.redeemedAt && (
                <span className="text-xs text-slate-500">
                  兑换于 {formatIsoDateTime(invitation.redeemedAt)}
                </span>
              )}
              <span className="ml-auto">
                <RevokeControl
                  invitation={invitation}
                  confirming={confirmingInviteId === invitation.inviteId}
                  pending={revokeMutation.isPending}
                  onRequestRevoke={() => setConfirmingInviteId(invitation.inviteId)}
                  onCancel={() => setConfirmingInviteId(null)}
                  onConfirm={() => revokeMutation.mutate(invitation.inviteId)}
                />
              </span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              暂无邀请码。
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

function RevokeControl({
  invitation,
  confirming,
  pending,
  onRequestRevoke,
  onCancel,
  onConfirm,
}: {
  invitation: AdminInvitation;
  confirming: boolean;
  pending: boolean;
  onRequestRevoke: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (invitation.status !== 'available') {
    return <span className="text-xs text-slate-600">—</span>;
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={onRequestRevoke}
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/10"
      >
        作废
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-rose-300">确认作废？</span>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? '作废中…' : '确认作废'}
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
