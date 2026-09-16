import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminProviderConfiguration,
  switchAdminProvider,
} from './adminClient';
import type { AdminProviderConfiguration, AdminProviderProfile } from './types';

export default function ProviderTab({ csrfToken }: { csrfToken: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'provider'],
    queryFn: () => fetchAdminProviderConfiguration(csrfToken),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (providerId: string) => switchAdminProvider(providerId, csrfToken),
    onSuccess: (configuration) => {
      queryClient.setQueryData(['admin', 'provider'], configuration);
    },
  });

  if (query.isPending) {
    return <p className="py-12 text-center text-sm text-slate-500">正在读取模型配置…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <section className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-5">
        <h2 className="text-sm font-semibold text-rose-200">模型配置暂不可用</h2>
        <p className="mt-2 text-sm leading-6 text-rose-300">{query.error?.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-4 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/10"
        >
          重试
        </button>
      </section>
    );
  }

  const configuration = query.data;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900/65 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Platform runtime
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-100">Provider 与模型</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              只切换服务器白名单中的模型。API Key 保存在服务器密钥文件中，不会下发到浏览器。
            </p>
          </div>
          <StatusBadge configuration={configuration} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Info label="当前 Provider" value={configuration.active.provider} />
          <Info label="当前模型" value={configuration.active.modelId} />
          <Info label="切换范围" value={configuration.switchScope === 'live' ? '即时生效' : '仅后续生成'} />
        </div>
      </section>

      {mutation.error && (
        <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-sm text-rose-300">
          {mutation.error.message}
        </p>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        {configuration.options.map((profile) => (
          <ProviderCard
            key={profile.id}
            profile={profile}
            disabled={mutation.isPending}
            onSelect={() => mutation.mutate(profile.id)}
          />
        ))}
      </section>
    </div>
  );
}

function ProviderCard({
  profile,
  disabled,
  onSelect,
}: {
  profile: AdminProviderProfile;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`rounded-xl border p-5 transition ${
        profile.active
          ? 'border-cyan-400/60 bg-cyan-400/5 shadow-[0_0_28px_rgba(34,211,238,0.08)]'
          : 'border-slate-800 bg-slate-900/45 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-cyan-300">{profile.provider}</p>
          <h3 className="mt-1 text-base font-bold text-slate-100">{profile.name}</h3>
        </div>
        {profile.active && (
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">
            当前使用
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Info label="模型 ID" value={profile.modelId} />
        <Info label="上下文" value={`${profile.contextWindow.toLocaleString()} tokens`} />
        <Info label="输出上限" value={`${profile.maxTokens.toLocaleString()} tokens`} />
        <Info label="状态" value={profile.active ? '运行中' : '可切换'} />
      </dl>
      <button
        type="button"
        disabled={disabled || profile.active}
        onClick={onSelect}
        className="mt-5 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {profile.active ? '已启用' : disabled ? '切换中…' : '切换到此模型'}
      </button>
    </article>
  );
}

function StatusBadge({ configuration }: { configuration: AdminProviderConfiguration }) {
  const running = configuration.workerStatus === 'running';
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
        running
          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
          : 'border-amber-400/40 bg-amber-400/10 text-amber-200'
      }`}
    >
      Worker {running ? '运行中' : '不可用'}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-xs font-medium text-slate-200" title={value}>
        {value}
      </dd>
    </div>
  );
}
