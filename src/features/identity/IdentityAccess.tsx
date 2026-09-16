import { useIdentity } from './IdentityContext';

interface IdentityAccessProps {
  onRequestLogout?: () => void;
  tone?: 'dark' | 'light';
}

export default function IdentityAccess({ onRequestLogout, tone = 'dark' }: IdentityAccessProps) {
  const {
    identityEnabled,
    session,
    sessionPending,
    openIdentityDialog,
    logout,
    logoutPending,
    logoutError,
  } = useIdentity();

  // session 已知时优先显示账号区：能力接口失败/挂起不应把已登录用户踢回匿名态
  if (!identityEnabled && !session) return null;
  if (sessionPending && !session) {
    return <span className={`text-xs ${tone === 'light' ? 'text-slate-500' : 'text-slate-600'}`}>账号状态同步中…</span>;
  }

  if (session) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${tone === 'light' ? 'border-slate-300 bg-white/75' : 'border-slate-800 bg-slate-900/80'}`}>
        <div className="min-w-0 text-right leading-tight">
          <div className={`max-w-28 truncate text-xs font-semibold ${tone === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
            {session.account.username}
          </div>
          <div className={`font-mono text-[10px] ${tone === 'light' ? 'text-teal-700' : 'text-cyan-300'}`}>
            {session.account.playerId}
          </div>
        </div>
        <button
          type="button"
          aria-label="退出登录"
          disabled={logoutPending}
          onClick={() => {
            if (onRequestLogout) {
              onRequestLogout();
              return;
            }
            void logout().catch(() => undefined);
          }}
          className={`rounded-lg border px-2 py-1 text-[11px] transition disabled:opacity-50 ${tone === 'light' ? 'border-slate-300 text-slate-500 hover:border-rose-400/60 hover:text-rose-600' : 'border-slate-700 text-slate-400 hover:border-rose-400/60 hover:text-rose-300'}`}
        >
          退出
        </button>
        {logoutError && (
          <span className="sr-only" role="alert">
            {logoutError instanceof Error ? logoutError.message : '退出失败'}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="登录 / 激活账号"
      onClick={openIdentityDialog}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${tone === 'light' ? 'border-teal-700/40 bg-teal-50 text-teal-800 hover:border-teal-700 hover:bg-teal-100' : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-400/20'}`}
    >
      <span className="sm:hidden">登录</span>
      <span className="hidden sm:inline">登录 / 激活账号</span>
    </button>
  );
}
