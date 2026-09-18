import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import IdentityDialog from './IdentityDialog';
import {
  claimInvitation,
  fetchCapabilities,
  fetchCurrentSession,
  loginIdentity,
  logoutIdentity,
  registerIdentity,
  type ClaimedInvitation,
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
  authenticationPending: boolean;
  authenticationError: Error | null;
  resetAuthenticationError: () => void;
  authenticateLogin: (input: LoginInput) => Promise<IdentitySession>;
  authenticateRegistration: (
    input: RegistrationInput,
  ) => Promise<IdentitySession>;
  claimInvitation: (turnstileToken?: string) => Promise<ClaimedInvitation>;
  openIdentityDialog: () => void;
  logout: () => Promise<void>;
  logoutPending: boolean;
  logoutError: Error | null;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

async function clearApplicationQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({
    predicate: (query) => query.queryKey[0] !== 'identity',
  });
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== 'identity',
  });
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  // session 查询是整个应用的认证边界。能力接口只有确认登录后才允许发送，
  // 避免匿名首屏顺带读取生成权限等控制台数据。
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCurrentSession,
    staleTime: 60 * 1000,
    retry: false,
  });
  const session = sessionQuery.data ?? null;
  const capabilities = useQuery({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: fetchCapabilities,
    enabled: session !== null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  // session 已完成但能力接口尚未成功时也保留登录入口，避免能力接口失败
  // 反过来阻塞登录流程。登录门禁本身不依赖 capabilities。
  const identityEnabled =
    session !== null ||
    sessionQuery.isSuccess ||
    capabilities.isError ||
    capabilities.data?.identity.registrationEnabled === true;
  const generationCapabilities = capabilities.data?.generation ?? null;
  const authentication = useMutation({
    mutationFn: (action: AuthenticationAction) =>
      action.kind === 'login'
        ? loginIdentity(action.input)
        : registerIdentity(action.input),
    onSuccess: async (authenticated) => {
      await clearApplicationQueries(queryClient);
      queryClient.removeQueries({ queryKey: CAPABILITIES_QUERY_KEY });
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
    onSuccess: async () => {
      queryClient.setQueryData<IdentitySession | null>(SESSION_QUERY_KEY, null);
      await clearApplicationQueries(queryClient);
      queryClient.removeQueries({ queryKey: CAPABILITIES_QUERY_KEY });
      setDialogOpen(false);
    },
  });
  const authenticateLogin = useCallback(
    (input: LoginInput) => authentication.mutateAsync({ kind: 'login', input }),
    [authentication],
  );
  const authenticateRegistration = useCallback(
    (input: RegistrationInput) =>
      authentication.mutateAsync({ kind: 'register', input }),
    [authentication],
  );
  const claimInvitationForIdentity = useCallback(
    (turnstileToken?: string) => claimInvitation(turnstileToken),
    [],
  );
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
        sessionPending: sessionQuery.isPending,
        authenticationPending: authentication.isPending,
        authenticationError: authentication.error,
        resetAuthenticationError: authentication.reset,
        authenticateLogin,
        authenticateRegistration,
        claimInvitation: claimInvitationForIdentity,
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
