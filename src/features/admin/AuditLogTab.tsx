import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAdminAuditEventsPage } from './adminClient';
import type { AuditFilter } from './types';

interface AuditLogTabProps {
  csrfToken: string;
}

const PAGE_SIZE = 50;

const EVENT_TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'identity.registered', label: 'identity.registered' },
  { value: 'identity.logged_in', label: 'identity.logged_in' },
  { value: 'admin.account_suspended', label: 'admin.account_suspended' },
  { value: 'admin.invite_revoked', label: 'admin.invite_revoked' },
];

export default function AuditLogTab({ csrfToken }: AuditLogTabProps) {
  const [eventType, setEventType] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-events', eventType, pageIndex],
    queryFn: () =>
      fetchAdminAuditEventsPage(csrfToken, auditFilter(eventType, pageIndex)),
    retry: false,
  });

  if (auditQuery.isPending) {
    return <TabPending message="正在读取审计日志…" />;
  }
  if (auditQuery.isError || !auditQuery.data) {
    return (
      <TabError
        error={auditQuery.error}
        onRetry={() => void auditQuery.refetch()}
      />
    );
  }

  const { events, total } = auditQuery.data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <label className="block text-xs font-medium text-slate-300">
          <span className="block">事件类型</span>
          <select
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              setPageIndex(0);
            }}
            className="mt-1.5 min-w-52 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          第 {pageIndex + 1} / {totalPages} 页 · 共 {total} 条
        </p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/65">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="px-4 py-3 font-semibold">事件类型</th>
              <th className="px-4 py-3 font-semibold">结果</th>
              <th className="px-4 py-3 font-semibold">时间</th>
              <th className="px-4 py-3 font-semibold">玩家</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.eventId}
                className="border-b border-slate-800/60 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-slate-100">
                  {event.eventType}
                </td>
                <td className="px-4 py-3 text-slate-400">{event.outcome}</td>
                <td className="px-4 py-3 text-slate-400">
                  {formatIsoDateTime(event.occurredAt)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {event.playerId ?? '—'}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  暂无审计事件。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((current) => current - 1)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-40"
        >
          上一页
        </button>
        <button
          type="button"
          disabled={pageIndex + 1 >= totalPages}
          onClick={() => setPageIndex((current) => current + 1)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function auditFilter(eventType: string, pageIndex: number): AuditFilter {
  const filter: AuditFilter = { limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE };
  if (eventType) filter.eventType = eventType;
  return filter;
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
  // 后端输出 RFC3339 UTC，操作员通常在东八区：显式标注 UTC 避免误读
  return `${iso.replace('T', ' ').slice(0, 16)} UTC`;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '管理服务暂时不可用，请稍后再试。';
}
