import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import IdentityDialog from './IdentityDialog';
import {
  fetchCapabilities,
  fetchCurrentSession,
  loginIdentity,
  logoutIdentity,
  registerIdentity,
} from './identityClient';
import type { IdentitySession, LoginInput, RegistrationInput } from './types';

const CAPABILITIES_QUERY_KEY = ['identity', 'capabilities'] as const;
const SESSION_QUERY_KEY = ['identity', 'session'] as const;

type AuthenticationAction =
  | { kind: 'login'; input: LoginInput }
  | { kind: 'register'; input: RegistrationInput };

export default function IdentityAccess() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const capabilities = useQuery({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const identityEnabled = capabilities.data?.identity.registrationEnabled === true;
  const session = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentSession,
    enabled: identityEnabled,
    staleTime: 60 * 1000,
    retry: false,
  });
  const authentication = useMutation({
    mutationFn: (action: AuthenticationAction) =>
      action.kind === 'login' ? loginIdentity(action.input) : registerIdentity(action.input),
    onSuccess: (authenticated) => {
      queryClient.setQueryData<IdentitySession | null>(SESSION_QUERY_KEY, authenticated);
      setDialogOpen(false);
    },
  });
  const logout = useMutation({
    mutationFn: (csrfToken: string) => logoutIdentity(csrfToken),
    onSuccess: () => {
      queryClient.setQueryData<IdentitySession | null>(SESSION_QUERY_KEY, null);
    },
  });

  if (!identityEnabled || capabilities.isError) return null;
  if (session.isPending) {
    return <span className="text-xs text-slate-600">账号状态同步中…</span>;
  }

  const authenticated = session.data;
  if (authenticated) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5">
        <div className="min-w-0 text-right leading-tight">
          <div className="max-w-28 truncate text-xs font-semibold text-slate-100">
            {authenticated.account.username}
          </div>
          <div className="font-mono text-[10px] text-cyan-300">
            {authenticated.account.playerId}
          </div>
        </div>
        <button
          type="button"
          aria-label="退出登录"
          disabled={logout.isPending}
          onClick={() => logout.mutate(authenticated.csrfToken)}
          className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition hover:border-rose-400/60 hover:text-rose-300 disabled:opacity-50"
        >
          退出
        </button>
        {logout.isError && (
          <span className="sr-only" role="alert">
            {logout.error instanceof Error ? logout.error.message : '退出失败'}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="登录 / 激活账号"
        onClick={() => {
          authentication.reset();
          setDialogOpen(true);
        }}
        className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/20"
      >
        <span className="sm:hidden">登录</span>
        <span className="hidden sm:inline">登录 / 激活账号</span>
      </button>
      {dialogOpen && (
        <IdentityDialog
          pending={authentication.isPending}
          requestError={authentication.error}
          onClose={() => setDialogOpen(false)}
          onResetError={() => authentication.reset()}
          onLogin={(input) => authentication.mutateAsync({ kind: 'login', input })}
          onRegister={(input) => authentication.mutateAsync({ kind: 'register', input })}
        />
      )}
    </>
  );
}
