import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminRequestObservation,
  fetchAdminRequestObservations,
} from './adminClient';
import type {
  AdminRequestObservation,
  AdminRequestObservationSummary,
  AdminRequestStage,
  AdminRequestStageSummary,
  RequestObservationFilter,
  RequestObservationOutcome,
  RequestActorKind,
  RequestStageId,
  RequestStageStatus,
} from './types';

interface RequestObservationsTabProps {
  csrfToken: string;
}

interface AdvancedFilterDraft {
  routeFamily: string;
  requestId: string;
  errorCode: string;
  httpStatus: string;
  accountId: string;
  effectiveClientIp: string;
  from: string;
  to: string;
}

const PAGE_SIZE = 50;
const EMPTY_ADVANCED_FILTER: AdvancedFilterDraft = {
  routeFamily: '',
  requestId: '',
  errorCode: '',
  httpStatus: '',
  accountId: '',
  effectiveClientIp: '',
  from: '',
  to: '',
};

const OUTCOME_META: Record<
  RequestObservationOutcome,
  { label: string; tone: string }
> = {
  succeeded: {
    label: '成功',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  rejected: {
    label: '被拒绝',
    tone: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
  },
  failed: {
    label: '异常',
    tone: 'border-orange-500/35 bg-orange-500/10 text-orange-300',
  },
  async_pending: {
    label: '异步处理中',
    tone: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
  },
};

const STATUS_META: Record<
  RequestStageStatus,
  { label: string; compact: string; symbol: string; node: string; line: string }
> = {
  passed: {
    label: '已通过',
    compact: '有',
    symbol: '✓',
    node: 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200',
    line: 'bg-emerald-400/45',
  },
  rejected: {
    label: '被拒绝',
    compact: '拒',
    symbol: '×',
    node: 'border-rose-400/70 bg-rose-400/15 text-rose-200',
    line: 'bg-rose-400/45',
  },
  failed: {
    label: '发生异常',
    compact: '错',
    symbol: '!',
    node: 'border-orange-400/70 bg-orange-400/15 text-orange-200',
    line: 'bg-orange-400/45',
  },
  pending: {
    label: '处理中',
    compact: '待',
    symbol: '↻',
    node: 'border-sky-400/65 bg-sky-400/15 text-sky-200',
    line: 'bg-sky-400/45',
  },
  not_reached: {
    label: '未经过',
    compact: '无',
    symbol: '○',
    node: 'border-slate-700 bg-slate-900 text-slate-500',
    line: 'bg-slate-800',
  },
  not_applicable: {
    label: '不适用',
    compact: 'N/A',
    symbol: '／',
    node: 'border-dashed border-slate-700 bg-slate-950 text-slate-600',
    line: 'bg-slate-800',
  },
  unobserved: {
    label: '未采集',
    compact: '未采集',
    symbol: '?',
    node: 'border-violet-400/45 bg-violet-400/10 text-violet-200',
    line: 'bg-violet-400/35',
  },
};

const LIFECYCLE_STAGE_META: {
  id: RequestStageId;
  shortTitle: string;
  title: string;
}[] = [
  { id: 'client', shortTitle: '客户端', title: '客户端 / 浏览器' },
  { id: 'edge_proxy', shortTitle: 'Caddy', title: 'Caddy 入口' },
  { id: 'router', shortTitle: '路由', title: 'MapFlow HTTP 路由' },
  { id: 'security_guard', shortTitle: '安全', title: '通用安全守卫' },
  { id: 'identity', shortTitle: '身份', title: '身份与权限校验' },
  { id: 'http_handler', shortTitle: 'HTTP', title: 'HTTP 处理器（类似 Controller）' },
  { id: 'business_service', shortTitle: '业务', title: '业务服务' },
  { id: 'database', shortTitle: 'PG', title: 'PostgreSQL' },
  { id: 'worker', shortTitle: 'Worker', title: '进程内 Worker / 队列' },
  { id: 'external_dependency', shortTitle: '外部', title: '外部依赖' },
  { id: 'response', shortTitle: '响应', title: 'HTTP 响应' },
];

const MATRIX_GRID_CLASS =
  'grid grid-cols-2 lg:grid-cols-[minmax(11rem,1.5fr)_minmax(9rem,1.1fr)_repeat(11,minmax(2.2rem,1fr))_minmax(8.5rem,0.85fr)]';
const MATRIX_HEADER_GRID_CLASS =
  'hidden lg:grid lg:grid-cols-[minmax(11rem,1.5fr)_minmax(9rem,1.1fr)_repeat(11,minmax(2.2rem,1fr))_minmax(8.5rem,0.85fr)]';

const LANE_META = [
  { id: 'caddy', label: 'Caddy' },
  { id: 'mapflow-app', label: 'mapflow-app' },
  { id: 'postgres', label: 'PostgreSQL' },
  { id: 'worker', label: '进程内 Worker' },
  { id: 'external', label: '外部服务' },
] as const;

export default function RequestObservationsTab({
  csrfToken,
}: RequestObservationsTabProps) {
  const [outcome, setOutcome] = useState<RequestObservationOutcome | ''>('');
  const [terminalStage, setTerminalStage] = useState<RequestStageId | ''>('');
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedFilterDraft>(
    EMPTY_ADVANCED_FILTER,
  );
  const [advancedFilter, setAdvancedFilter] = useState<RequestObservationFilter>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const filter = useMemo(
    () => ({
      ...advancedFilter,
      ...(outcome ? { outcome } : {}),
      ...(terminalStage ? { terminalStage } : {}),
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
    }),
    [advancedFilter, outcome, pageIndex, terminalStage],
  );
  const observationsQuery = useQuery({
    queryKey: ['admin', 'request-observations', filter],
    queryFn: () => fetchAdminRequestObservations(csrfToken, filter),
    retry: false,
  });
  const delivery = observationsQuery.data?.delivery;
  const unpersisted = delivery
    ? delivery.queueDroppedSinceStart + delivery.writeFailedSinceStart
    : 0;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Request Observatory
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">请求生命周期地图</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              一行代表一次 API 请求。点开后可查看它经过、跳过或停止在哪个模块；灰色节点也会保留，不会把系统结构藏起来。
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-200/70">
              这是低开销的尽力记录：若 PostgreSQL 暂时不可用或写入队列拥堵，个别请求可能缺失；“查不到”不等于请求绝对没有发生。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void observationsQuery.refetch()}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
          >
            手动刷新
          </button>
        </div>
      </section>

      {delivery && (
        <section
          aria-label="观测写入健康"
          className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 xl:grid-cols-4 ${
            unpersisted > 0
              ? 'border-rose-500/30 bg-rose-500/10'
              : 'border-emerald-500/25 bg-emerald-500/5'
          }`}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              投递结论
            </p>
            <p className={`mt-1 text-sm font-bold ${unpersisted > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>
              {unpersisted > 0
                ? `本进程已有 ${unpersisted} 条观测未能落库`
                : '本进程尚未发现观测丢失'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">成功写入</p>
            <p className="mt-1 font-mono text-sm text-slate-200">
              {delivery.persistedSinceStart}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">队列占用</p>
            <p className="mt-1 font-mono text-sm text-slate-200">
              当前排队 {delivery.queued} / {delivery.capacity}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">未落库原因（自本进程启动）</p>
            <p className="mt-1 font-mono text-sm text-slate-200">
              队列丢弃 {delivery.queueDroppedSinceStart} · 写库失败{' '}
              {delivery.writeFailedSinceStart}
            </p>
          </div>
        </section>
      )}

      <details className="rounded-xl border border-slate-800 bg-slate-900/45">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-300">
          高级筛选
        </summary>
        <form
          className="grid gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setAdvancedFilter(buildAdvancedFilter(advancedDraft));
            setPageIndex(0);
          }}
        >
          <FilterSelect
            label="路由族"
            value={advancedDraft.routeFamily}
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, routeFamily: value }))
            }
            options={[
              ['', '全部路由族'],
              ['invitation', '邀请码'],
              ['identity', '身份与账号'],
              ['generation', '技能树生成'],
              ['knowledge_chat', '知识聊天'],
              ['admin', '管理端'],
              ['general', '其他 API'],
            ]}
          />
          <FilterInput
            label="请求 ID"
            value={advancedDraft.requestId}
            placeholder="可粘贴 X-Request-Id"
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, requestId: value }))
            }
          />
          <FilterInput
            label="稳定错误码"
            value={advancedDraft.errorCode}
            placeholder="如 knowledge_chat.timeout"
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, errorCode: value }))
            }
          />
          <FilterInput
            label="HTTP 状态"
            value={advancedDraft.httpStatus}
            type="number"
            placeholder="如 429"
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, httpStatus: value }))
            }
          />
          <FilterInput
            label="账号 ID"
            value={advancedDraft.accountId}
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, accountId: value }))
            }
          />
          <FilterInput
            label="有效客户端 IP"
            value={advancedDraft.effectiveClientIp}
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, effectiveClientIp: value }))
            }
          />
          <FilterInput
            label="起始时间"
            value={advancedDraft.from}
            type="datetime-local"
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, from: value }))
            }
          />
          <FilterInput
            label="结束时间"
            value={advancedDraft.to}
            type="datetime-local"
            onChange={(value) =>
              setAdvancedDraft((draft) => ({ ...draft, to: value }))
            }
          />
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
            <button
              type="submit"
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200"
            >
              应用高级筛选
            </button>
            <button
              type="button"
              onClick={() => {
                setAdvancedDraft(EMPTY_ADVANCED_FILTER);
                setAdvancedFilter({});
                setPageIndex(0);
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400"
            >
              清空高级筛选
            </button>
          </div>
        </form>
      </details>

      <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="block text-xs font-medium text-slate-300">
            <span className="block">结果</span>
            <select
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as RequestObservationOutcome | '');
                setPageIndex(0);
              }}
              className="mt-1.5 min-w-44 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">全部结果</option>
              <option value="succeeded">成功</option>
              <option value="rejected">被拒绝</option>
              <option value="failed">异常</option>
              <option value="async_pending">异步处理中</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            <span className="block">停止阶段</span>
            <select
              value={terminalStage}
              onChange={(event) => {
                setTerminalStage(event.target.value as RequestStageId | '');
                setPageIndex(0);
              }}
              className="mt-1.5 min-w-52 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">全部阶段</option>
              <option value="security_guard">安全守卫</option>
              <option value="identity">身份与权限</option>
              <option value="http_handler">HTTP 处理器</option>
              <option value="business_service">业务服务</option>
              <option value="database">PostgreSQL</option>
              <option value="worker">进程内 Worker / 队列</option>
              <option value="external_dependency">外部依赖</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          默认不自动轮询，避免管理面板本身制造额外负载。
        </p>
      </section>

      {observationsQuery.isPending && <TabPending />}
      {observationsQuery.isError && (
        <TabError
          error={observationsQuery.error}
          onRetry={() => void observationsQuery.refetch()}
        />
      )}
      {observationsQuery.data && (
        <ObservationTable
          items={observationsQuery.data.items}
          total={observationsQuery.data.total}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          onSelect={setSelectedRequestId}
        />
      )}

      {selectedRequestId && (
        <ObservationDrawer
          csrfToken={csrfToken}
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
        />
      )}
    </div>
  );
}

function ObservationTable({
  items,
  total,
  pageIndex,
  onPageChange,
  onSelect,
}: {
  items: AdminRequestObservationSummary[];
  total: number;
  pageIndex: number;
  onPageChange: (page: number) => void;
  onSelect: (requestId: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/65">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-bold text-white">请求清单与生命周期矩阵</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            每一行都直接保留 11 个固定阶段；小格里的“有 / 无 / N/A / 未采集”只描述本次证据，不需要先筛选或打开详情。
          </p>
        </div>
        <div aria-label="请求生命周期矩阵" role="table" className="text-left text-sm">
          <div
            role="row"
            className={`${MATRIX_HEADER_GRID_CLASS} border-b border-slate-800 px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-slate-500`}
          >
            <div role="columnheader" className="px-2 font-semibold">请求身份</div>
            <div role="columnheader" className="px-2 font-semibold">时间 / 路由</div>
            {LIFECYCLE_STAGE_META.map((stage) => (
              <div
                key={stage.id}
                role="columnheader"
                className="px-1 text-center font-semibold"
                title={stage.title}
              >
                {stage.shortTitle}
              </div>
            ))}
            <div role="columnheader" className="px-2 font-semibold">最终结果</div>
          </div>
          <div className="space-y-3 p-3 lg:space-y-0 lg:p-0">
            {items.map((item) => (
              <ObservationMatrixRow key={item.requestId} item={item} onSelect={onSelect} />
            ))}
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                当前筛选条件下没有请求记录。
              </p>
            )}
          </div>
        </div>
      </section>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          第 {pageIndex + 1} / {totalPages} 页 · 共 {total} 条
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => onPageChange(pageIndex - 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={pageIndex + 1 >= totalPages}
            onClick={() => onPageChange(pageIndex + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </>
  );
}

function ObservationMatrixRow({
  item,
  onSelect,
}: {
  item: AdminRequestObservationSummary;
  onSelect: (requestId: string) => void;
}) {
  return (
    <div
      role="row"
      className={`${MATRIX_GRID_CLASS} rounded-xl border border-slate-800/80 bg-slate-950/35 transition hover:bg-slate-800/35 lg:rounded-none lg:border-x-0 lg:border-t-0`}
    >
      <div role="cell" className="col-span-1 min-w-0 border-slate-800/70 p-3 lg:col-span-1 lg:border-r">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-cyan-300/80">
              {actorLabel(item.actorKind)}
            </p>
            <p
              className="mt-1 truncate text-sm font-bold text-white"
              title={item.username ?? undefined}
            >
              {item.username ?? actorNameFallback(item.actorKind)}
            </p>
          </div>
          <button
            type="button"
            aria-label={`查看请求 ${item.requestId}`}
            onClick={() => onSelect(item.requestId)}
            className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
          >
            看路线
          </button>
        </div>
        <p className="mt-2 truncate font-mono text-[10px] text-slate-500" title={item.effectiveClientIp ?? undefined}>
          IP {item.effectiveClientIp ?? '未知'}
        </p>
        <code className="mt-1 block truncate font-mono text-[10px] text-slate-600" title={item.requestId}>
          ID {shortRequestId(item.requestId)}
        </code>
        {item.accountId && (
          <code className="mt-1 block truncate font-mono text-[10px] text-slate-700" title={item.accountId}>
            账号 {item.accountId}
          </code>
        )}
      </div>
      <div role="cell" className="col-span-1 min-w-0 border-slate-800/70 p-3 lg:col-span-1 lg:border-r">
        <p className="truncate text-[10px] text-slate-500">{formatIsoDateTime(item.completedAt)}</p>
        <p className="mt-1 min-w-0">
          <span className="mr-1 inline-flex rounded border border-slate-700 bg-slate-950 px-1 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
            {item.method}
          </span>
          <code className="break-words text-xs text-slate-300">{item.route}</code>
        </p>
        <p className="mt-1 truncate text-[10px] text-slate-600" title={item.summary}>
          {item.summary}
        </p>
      </div>
      {LIFECYCLE_STAGE_META.map((stageMeta) => (
        <StageSummaryCell
          key={stageMeta.id}
          stageMeta={stageMeta}
          stage={findStageSummary(item.stages, stageMeta.id)}
          onSelect={() => onSelect(item.requestId)}
        />
      ))}
      <div role="cell" className="col-span-2 min-w-0 border-slate-800/70 p-3 lg:col-span-1 lg:border-l">
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeBadge outcome={item.outcome} />
          <span className="font-mono text-xs text-slate-500">HTTP</span>
          <span className="font-mono text-xs text-slate-300">{item.httpStatus}</span>
        </div>
        <p className="mt-2 truncate text-xs font-semibold text-slate-200" title={terminalStageLabel(item)}>
          终点：{terminalStageLabel(item)}
        </p>
        <p className="mt-1 font-mono text-[10px] text-slate-500">总耗时 {formatDuration(item.durationMs)}</p>
      </div>
    </div>
  );
}

function StageSummaryCell({
  stageMeta,
  stage,
  onSelect,
}: {
  stageMeta: (typeof LIFECYCLE_STAGE_META)[number];
  stage: AdminRequestStageSummary;
  onSelect: () => void;
}) {
  const meta = STATUS_META[stage.status];
  return (
    <div role="cell" className="col-span-1 min-w-0">
      <button
        type="button"
        aria-label={`${stageMeta.shortTitle}：${meta.label}`}
        title={`${stageMeta.title} · ${meta.label} · 证据 ${stage.evidence}`}
        onClick={onSelect}
        className={`flex min-h-16 w-full min-w-0 flex-col justify-center rounded-lg border p-2 text-left transition hover:brightness-125 lg:min-h-20 lg:items-center lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-1 lg:text-center ${meta.node}`}
      >
        <span className="block truncate text-[10px] font-semibold leading-4 lg:max-w-full lg:text-[9px] lg:leading-3">
          {stageMeta.shortTitle}
        </span>
        <span className="mt-1 block text-xs font-black lg:text-[11px]">
          {meta.symbol} {meta.compact}
        </span>
        <span className="mt-1 block font-mono text-[9px] opacity-70">
          {stage.durationMs === null ? '—' : formatDuration(stage.durationMs)}
        </span>
      </button>
    </div>
  );
}

function ObservationDrawer({
  csrfToken,
  requestId,
  onClose,
}: {
  csrfToken: string;
  requestId: string;
  onClose: () => void;
}) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ['admin', 'request-observation', requestId],
    queryFn: () => fetchAdminRequestObservation(csrfToken, requestId),
    retry: false,
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const detail = detailQuery.data;
  const selectedStage = detail
    ? selectStage(detail, selectedStageId)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭请求详情"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="请求生命周期详情"
        className="relative z-10 h-full w-full max-w-6xl overflow-y-auto border-l border-slate-700 bg-slate-950 shadow-2xl"
      >
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Request {shortRequestId(requestId)}
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">请求生命周期详情</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
          >
            关闭
          </button>
        </header>

        {detailQuery.isPending && <TabPending />}
        {detailQuery.isError && (
          <div className="p-5">
            <TabError
              error={detailQuery.error}
              onRetry={() => void detailQuery.refetch()}
            />
          </div>
        )}
        {detail && selectedStage && (
          <div className="space-y-5 p-4 sm:p-5">
            <RequestConclusion detail={detail} />
            <LifecycleTimeline
              stages={detail.stages}
              selectedStageId={selectedStage.id}
              onSelect={setSelectedStageId}
            />
            <RuntimeLanes stages={detail.stages} />
            <StageInspector stage={selectedStage} />
            <details className="rounded-xl border border-slate-800 bg-slate-900/55">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
                完整脱敏 JSON
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-slate-800 p-4 text-xs leading-6 text-slate-400">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </aside>
    </div>
  );
}

function RequestConclusion({ detail }: { detail: AdminRequestObservation }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeBadge outcome={detail.outcome} />
          <span className="font-mono text-xs text-slate-500">HTTP {detail.httpStatus}</span>
          <span className="text-xs text-slate-500">{formatDuration(detail.durationMs)}</span>
        </div>
        <h3 className="mt-3 text-base font-bold text-white">{detail.summary}</h3>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {detail.method} {detail.route}
        </p>
        <p className="mt-2 text-[11px] text-slate-600">
          生命周期 v{detail.lifecycleSchemaVersion} · 脱敏规则 v{detail.redactionSchemaVersion}
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          请求 {formatBytes(detail.requestBytes)} · 响应 {formatBytes(detail.responseBytes)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs md:min-w-80">
        <Meta label="身份" value={actorLabel(detail.actorKind)} />
        <Meta label="有效客户端 IP" value={detail.effectiveClientIp ?? '未知'} />
        <Meta label="直接对端 IP" value={detail.peerIp ?? '未知'} />
        <Meta label="用户名" value={detail.username ?? '未识别用户'} />
        <Meta label="账号 ID" value={detail.accountId ?? '未识别'} />
        <Meta label="关联任务 ID" value={detail.correlationId ?? '无'} />
        <Meta label="完成时间" value={formatIsoDateTime(detail.completedAt)} />
      </dl>
    </section>
  );
}

function LifecycleTimeline({
  stages,
  selectedStageId,
  onSelect,
}: {
  stages: AdminRequestStage[];
  selectedStageId: string;
  onSelect: (stageId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">实际请求路线</h3>
          <p className="mt-1 text-xs text-slate-500">
            从左到右表示请求经过的固定阶段；最后一个节点就是本次响应落点。
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            点击任意节点查看它的解释、实际子操作和原始技术证据。
          </p>
        </div>
        <StatusLegend />
      </div>
      <ol
        aria-label="请求生命周期"
        className="flex min-w-0 flex-col gap-2 pb-2 lg:grid lg:grid-cols-11 lg:gap-0"
      >
        {stages.map((stage, index) => {
          const meta = STATUS_META[stage.status];
          return (
            <li key={stage.id} className="relative flex min-w-0 flex-1 items-center lg:block">
              <button
                type="button"
                aria-label={`${stage.title}：${meta.label}`}
                aria-pressed={selectedStageId === stage.id}
                onClick={() => onSelect(stage.id)}
                className={`group relative z-10 flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition lg:mx-1 lg:w-[calc(100%-0.5rem)] lg:flex-col lg:gap-1 lg:px-1 lg:py-2 lg:text-center ${meta.node} ${
                  selectedStageId === stage.id
                    ? 'ring-2 ring-cyan-300/60 ring-offset-2 ring-offset-slate-950'
                    : 'hover:brightness-125'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/40 text-base font-black lg:h-7 lg:w-7 lg:text-sm">
                  {meta.symbol}
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-xs font-semibold leading-4 lg:text-[10px] lg:leading-3">
                    {stage.title}
                  </span>
                  <span className="mt-1 block text-[10px] opacity-75">{meta.label}</span>
                  {stage.durationMs !== null && (
                    <span className="mt-0.5 block font-mono text-[9px] opacity-60">
                      {formatDuration(stage.durationMs)}
                    </span>
                  )}
                  {stage.startedOffsetMs !== null && (
                    <span className="mt-0.5 block font-mono text-[9px] text-cyan-200/60">
                      +{stage.startedOffsetMs} ms
                    </span>
                  )}
                </span>
              </button>
              {index < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`ml-3 h-5 w-0.5 shrink-0 lg:absolute lg:left-1/2 lg:right-0 lg:top-8 lg:z-0 lg:ml-0 lg:h-0.5 lg:w-auto ${meta.line}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RuntimeLanes({ stages }: { stages: AdminRequestStage[] }) {
  return (
    <section
      aria-label="运行位置泳道"
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <h3 className="text-sm font-bold text-white">运行位置泳道</h3>
      <p className="mt-1 text-xs text-slate-500">
        泳道始终显示；“本次未经过”表示系统里有这个位置，但这条请求没有进入。
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {LANE_META.map((lane) => {
          const laneStages = stages.filter((stage) => stageBelongsToLane(stage, lane.id));
          const visited = laneStages.filter((stage) =>
            ['passed', 'rejected', 'failed', 'pending'].includes(stage.status),
          );
          return (
            <div key={lane.id} className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-200">{lane.label}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    visited.length > 0 ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {visited.length > 0
                  ? `${visited.length} 个节点有实际证据`
                  : '本次未经过'}
              </p>
              {lane.id === 'worker' && (
                <p className="mt-1 text-[10px] leading-4 text-slate-600">
                  与 mapflow-app 同一进程，不是独立容器
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StageInspector({ stage }: { stage: AdminRequestStage }) {
  const meta = STATUS_META[stage.status];
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.node}`}>
            {meta.symbol} {meta.label}
          </span>
          <span className="font-mono text-[11px] text-slate-600">{stage.evidence}</span>
        </div>
        <h3 className="mt-3 text-sm font-bold text-white">为什么停在这里</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">{stage.explanation}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-xs">
          <Meta label="运行位置" value={stage.location} />
          <Meta
            label="阶段耗时"
            value={stage.durationMs === null ? '未测量' : formatDuration(stage.durationMs)}
          />
          <Meta
            label="开始位置"
            value={stage.startedOffsetMs === null ? '未测量' : `请求开始后 ${stage.startedOffsetMs} ms`}
          />
        </dl>
        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">本阶段实际操作</h3>
            <span className="font-mono text-[11px] text-slate-600">
              {stage.operations.length} 项
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            这里列出本阶段真正执行过的子操作；没有进入的阶段不会伪造操作记录。
          </p>
          {stage.operationsTruncated && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              操作记录已截断
            </p>
          )}
          {stage.operations.length > 0 ? (
            <ol className="mt-3 space-y-2" aria-label="本阶段实际操作列表">
              {stage.operations.map((operation, index) => {
                const operationMeta = STATUS_META[operation.status];
                return (
                  <li
                    key={`${operation.code}-${index}`}
                    className={`rounded-xl border p-3 ${operationMeta.node}`}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="shrink-0 font-mono text-xs font-bold">
                        {operationMeta.symbol} {operationMeta.label}
                      </span>
                      <code className="min-w-0 break-all text-[11px] text-cyan-100/90">
                        {operation.code}
                      </code>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-200">
                      {operation.explanation}
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-slate-300/70">
                      请求开始后 +{operation.startedOffsetMs} ms · 耗时{' '}
                      {formatDuration(operation.durationMs)} · 证据 {operation.evidence}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-600">
              本阶段没有记录到可拆分的子操作。
            </p>
          )}
        </div>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
        <h3 className="text-sm font-bold text-white">原始技术诊断（已脱敏）</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          保留稳定错误码与技术上下文；密码、Cookie、令牌、API Key 和邀请码明文不会进入这里。
        </p>
        {stage.technicalTruncated && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            技术诊断已截断
          </p>
        )}
        <pre
          aria-label="脱敏后的原始技术诊断"
          className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-6 text-cyan-100/80"
        >
          {JSON.stringify(stage.technical, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500" aria-label="状态图例">
      {(
        [
          'passed',
          'rejected',
          'failed',
          'pending',
          'not_reached',
          'not_applicable',
          'unobserved',
        ] as RequestStageStatus[]
      ).map((status) => (
        <span key={status} className="inline-flex items-center gap-1">
          <span>{STATUS_META[status].symbol}</span>
          {STATUS_META[status].label}
        </span>
      ))}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: RequestObservationOutcome }) {
  const meta = OUTCOME_META[outcome];
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-slate-300" title={value}>
        {value}
      </dd>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'datetime-local';
}) {
  return (
    <label className="block text-xs font-medium text-slate-400">
      <span className="block">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={type === 'number' ? 100 : undefined}
        max={type === 'number' ? 599 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-700 focus:border-cyan-400"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block text-xs font-medium text-slate-400">
      <span className="block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildAdvancedFilter(draft: AdvancedFilterDraft): RequestObservationFilter {
  const httpStatus = Number(draft.httpStatus);
  return {
    ...(draft.routeFamily ? { routeFamily: draft.routeFamily } : {}),
    ...(draft.requestId.trim() ? { requestId: draft.requestId.trim() } : {}),
    ...(draft.errorCode.trim() ? { errorCode: draft.errorCode.trim() } : {}),
    ...(draft.httpStatus && Number.isInteger(httpStatus) ? { httpStatus } : {}),
    ...(draft.accountId.trim() ? { accountId: draft.accountId.trim() } : {}),
    ...(draft.effectiveClientIp.trim()
      ? { effectiveClientIp: draft.effectiveClientIp.trim() }
      : {}),
    ...(draft.from ? { from: new Date(draft.from).toISOString() } : {}),
    ...(draft.to ? { to: new Date(draft.to).toISOString() } : {}),
  };
}

function selectStage(
  detail: AdminRequestObservation,
  selectedStageId: string | null,
): AdminRequestStage {
  const preferred =
    selectedStageId ??
    detail.terminalStage ??
    (detail.outcome === 'succeeded' ? 'response' : null);
  return (
    detail.stages.find((stage) => stage.id === preferred) ??
    detail.stages.find((stage) => ['rejected', 'failed', 'pending'].includes(stage.status)) ??
    [...detail.stages]
      .reverse()
      .find((stage) => !['not_reached', 'not_applicable', 'unobserved'].includes(stage.status)) ??
    detail.stages[0]
  );
}

function TabPending() {
  return (
    <p className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
      正在读取请求记录…
    </p>
  );
}

function TabError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
      <p role="alert" className="text-sm leading-6 text-rose-300">
        {error instanceof Error ? error.message : '请求观测服务暂时不可用。'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
      >
        重新读取
      </button>
    </div>
  );
}

function formatIsoDateTime(iso: string): string {
  return `${iso.replace('T', ' ').slice(0, 19)} UTC`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 2 : 1)} s`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '未知';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

function stageBelongsToLane(
  stage: AdminRequestStage,
  laneId: (typeof LANE_META)[number]['id'],
): boolean {
  if (laneId === 'worker') return stage.id === 'worker';
  if (laneId === 'mapflow-app') {
    return stage.location === 'mapflow-app' && stage.id !== 'worker';
  }
  return stage.location === laneId;
}

function shortRequestId(requestId: string): string {
  return `${requestId.slice(0, 8)}…${requestId.slice(-4)}`;
}

function actorLabel(actorKind: RequestActorKind): string {
  switch (actorKind) {
    case 'authenticated':
      return '已登录用户';
    case 'visitor':
      return '访客（该接口无需登录）';
    case 'identity_rejected':
      return '未登录 / 身份校验失败';
    case 'unassociated':
      return '未能关联账号';
  }
}

function actorNameFallback(actorKind: RequestActorKind): string {
  switch (actorKind) {
    case 'authenticated':
      return '用户名未记录';
    case 'visitor':
      return '无用户名';
    case 'identity_rejected':
      return '身份校验失败';
    case 'unassociated':
      return '未识别用户';
  }
}

function findStageSummary(
  stages: AdminRequestStageSummary[],
  stageId: RequestStageId,
): AdminRequestStageSummary {
  return (
    stages.find((stage) => stage.id === stageId) ?? {
      id: stageId,
      status: 'unobserved',
      evidence: 'not_observed',
      durationMs: null,
    }
  );
}

function terminalStageLabel(item: AdminRequestObservationSummary): string {
  if (item.terminalStage) {
    return (
      LIFECYCLE_STAGE_META.find((stage) => stage.id === item.terminalStage)?.title ??
      item.terminalStage
    );
  }
  if (item.outcome === 'succeeded') return 'HTTP 响应';
  return '终点未采集';
}
