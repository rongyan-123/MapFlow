import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import IdentityDialog from './IdentityDialog';
import {
  claimInvitation,
  fetchCapabilities,
  fetchCurrentSession,
  loginIdentity,
  logoutIdentity,
  registerIdentity,
} from './identityClient';
import type {
  IdentityCapabilities,
  IdentitySession,
  LoginInput,
  RegistrationInput,
} from './types';

export const CAPABILITIES_QUERY_KEY = ['identity', 'capabilities'] as const;
export const SESSION_QUERY_KEY = ['identity', 'session'] as const;

type AuthenticationAction =
  | { kind: 'login'; input: LoginInput }
  | { kind: 'register'; input: RegistrationInput };

interface IdentityContextValue {
  identityEnabled: boolean;
  generationCapabilities: IdentityCapabilities['generation'] | null;
  capabilitiesPending: boolean;
  capabilitiesError: boolean;
  session: IdentitySession | null;
  sessionPending: boolean;
  openIdentityDialog: () => void;
  logout: () => Promise<void>;
  logoutPending: boolean;
  logoutError: Error | null;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const capabilities = useQuery({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: fetchCapabilities,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const identityEnabled = capabilities.data?.identity.registrationEnabled === true;
  const generationCapabilities = capabilities.data?.generation ?? null;
  // session 查询不依赖 capabilities：弱网下能力接口挂起时，
  // 已登录用户仍应立即看到自己的学习视图（生成按钮以禁用态占位）。
  // 服务端 /api/auth/session 路由恒存在，匿名请求返回 401 → null。
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentSession,
    staleTime: 60 * 1000,
    retry: false,
  });
  const session = sessionQuery.data ?? null;
  const authentication = useMutation({
    mutationFn: (action: AuthenticationAction) =>
      action.kind === 'login'
        ? loginIdentity(action.input)
        : registerIdentity(action.input),
    onSuccess: (authenticated) => {
      queryClient.removeQueries({ queryKey: ['me'] });
      queryClient.setQueryData<IdentitySession | null>(
        SESSION_QUERY_KEY,
        authenticated,
      );
      setDialogOpen(false);
    },
  });
  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!session) return;
      await logoutIdentity(session.csrfToken);
    },
    onSuccess: () => {
      queryClient.setQueryData<IdentitySession | null>(SESSION_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: ['me'] });
    },
  });
  const openIdentityDialog = useCallback(() => {
    if (!identityEnabled) return;
    authentication.reset();
    setDialogOpen(true);
  }, [authentication, identityEnabled]);

  return (
    <IdentityContext.Provider
      value={{
        identityEnabled,
        generationCapabilities,
        capabilitiesPending: capabilities.isPending,
        capabilitiesError: capabilities.isError,
        session,
        sessionPending: capabilities.isPending || sessionQuery.isPending,
        openIdentityDialog,
        logout: () => logoutMutation.mutateAsync(),
        logoutPending: logoutMutation.isPending,
        logoutError: logoutMutation.error,
      }}
    >
      {children}
      {identityEnabled && dialogOpen && (
        <IdentityDialog
          pending={authentication.isPending}
          requestError={authentication.error}
          onClose={() => setDialogOpen(false)}
          onResetError={() => authentication.reset()}
          onLogin={(input) => authentication.mutateAsync({ kind: 'login', input })}
          onRegister={(input) =>
            authentication.mutateAsync({ kind: 'register', input })
          }
          onClaimInvitation={(turnstileToken) =>
            claimInvitation(turnstileToken)
          }
        />
      )}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error('useIdentity must be used within IdentityProvider');
  return identity;
}
