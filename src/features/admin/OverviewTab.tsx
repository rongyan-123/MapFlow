import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboard } from './adminClient';
import type { AdminDashboard } from './types';

interface OverviewTabProps {
  csrfToken: string;
}

export default function OverviewTab({ csrfToken }: OverviewTabProps) {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => fetchAdminDashboard(csrfToken),
    retry: false,
  });

  if (dashboardQuery.isPending) {
    return <TabPending message="正在读取管理概览…" />;
  }
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <TabError
        error={dashboardQuery.error}
        onRetry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const data = dashboardQuery.data;
  const trend = data.loginTrend7d;
  const todayLogins =
    trend.length > 0 ? trend[trend.length - 1].activeAccounts : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="注册总数" value={data.registeredAccounts} />
        <MetricCard
          label="今日登录"
          value={todayLogins}
          hint={`${trend.length} 日趋势中的最新一天`}
        />
        <MetricCard label="活跃会话" value={data.activeSessions} />
        <MetricCard label="剩余邀请码" value={data.availableInvites} />
        <MetricCard label="平台消耗次数" value={data.platformConsumedUsages} />
        <MetricCard label="平台消耗 token" value={data.platformConsumedTokens} />
      </div>

      <LoginTrendChart trend={trend} />
    </div>
  );
}

function LoginTrendChart({ trend }: { trend: AdminDashboard['loginTrend7d'] }) {
  const max = Math.max(...trend.map((day) => day.activeAccounts), 1);
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
      <h2 className="text-sm font-semibold text-slate-100">最近 7 日登录趋势</h2>
      <p className="mt-1 text-[11px] text-slate-500">
        每日活跃账号数；柱高按当日人数占 7 日最高值的比例绘制。
      </p>
      <div className="mt-4 flex h-40 items-end gap-2">
        {trend.map((day) => (
          <div
            key={day.date}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] leading-none text-slate-500">
              {day.activeAccounts}
            </span>
            <div
              aria-label={`${day.date} ${day.activeAccounts} 人登录`}
              className="w-full max-w-12 rounded-t bg-gradient-to-t from-cyan-700 to-cyan-300"
              style={{
                height: `${Math.round((day.activeAccounts / max) * 100)}%`,
              }}
            />
            <span className="text-[10px] leading-none text-slate-500">
              {day.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <section
      aria-label={`${label} ${value}`}
      className="rounded-xl border border-slate-800 bg-slate-900/65 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </section>
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

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '管理服务暂时不可用，请稍后再试。';
}
