import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { IdentityProvider, useIdentity } from './IdentityContext';

const api = vi.hoisted(() => ({
  fetchCapabilities: vi.fn(),
  fetchCurrentSession: vi.fn(),
  loginIdentity: vi.fn(),
  logoutIdentity: vi.fn(),
  registerIdentity: vi.fn(),
}));

vi.mock('./identityClient', () => api);

const authenticated = {
  account: {
    playerId: 'MF-7K3P-9D2Q-X8CW',
    username: 'firstuser',
    status: 'active' as const,
    isAdmin: false,
  },
  csrfToken: 'csrf-secret',
};

beforeEach(() => {
  api.fetchCapabilities.mockReset();
  api.fetchCurrentSession.mockReset();
  api.loginIdentity.mockReset();
  api.logoutIdentity.mockReset();
  api.registerIdentity.mockReset();
});

function mockIdentityEndpoints() {
  api.fetchCapabilities.mockResolvedValue({
    identity: { registrationEnabled: true },
    generation: {
      enabled: true,
      models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      thinkingModes: ['enabled', 'disabled'],
      reasoningEfforts: ['high', 'max'],
    },
  });
  api.fetchCurrentSession.mockResolvedValue(null);
  api.registerIdentity.mockResolvedValue(authenticated);
}

it('lets any child open the real dialog, observe registration, and log out', async () => {
  const user = userEvent.setup();
  api.fetchCapabilities.mockResolvedValue({
    identity: { registrationEnabled: true },
    generation: {
      enabled: true,
      models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      thinkingModes: ['enabled', 'disabled'],
      reasoningEfforts: ['high', 'max'],
    },
  });
  api.fetchCurrentSession.mockResolvedValue(null);
  api.registerIdentity.mockResolvedValue(authenticated);
  api.logoutIdentity.mockResolvedValue(undefined);

  renderIdentityProbe();

  expect(await screen.findByText('identity-enabled')).toBeInTheDocument();
  expect(screen.getByText('generation-enabled')).toBeInTheDocument();
  expect(screen.getByText('anonymous')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'open identity dialog' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '注册激活' }));
  await user.type(screen.getByLabelText('用户名'), 'firstuser');
  await user.type(screen.getByLabelText('设置密码'), 'safe-password-2026');
  await user.type(screen.getByLabelText('确认密码'), 'safe-password-2026');
  await user.type(screen.getByLabelText('邀请码'), 'q1j2x3k4r5p6');
  await user.type(
    screen.getByLabelText('邮箱（可选）'),
    'learner@example.com',
  );
  await user.click(
    screen.getByRole('button', { name: '创建并激活账号' }),
  );

  expect(await screen.findByText('firstuser')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'context logout' }));

  await waitFor(() => expect(api.logoutIdentity).toHaveBeenCalledWith('csrf-secret'));
  expect(await screen.findByText('anonymous')).toBeInTheDocument();
});

it.each([
  [
    400,
    'identity.username_invalid',
    '用户名格式不正确：需 2-24 个字符，仅限汉字、英文字母、数字、下划线或短横线，且不能是邮箱地址。',
  ],
  [409, 'identity.username_conflict', '该用户名已被注册，请换一个。'],
  [
    400,
    'identity.password_rejected',
    '密码不符合要求：8-128 位，不能是常见密码，也不能包含用户名。',
  ],
  [400, 'identity.invitation_rejected', '邀请码无效或已被使用，请检查后重试。'],
  [400, 'identity.contact_rejected', '请至少填写一种有效的邮箱或手机号。'],
])(
  'surfaces the rejection message %s in the open dialog without logging in',
  async (_status, code, message) => {
    const user = userEvent.setup();
    mockIdentityEndpoints();
    api.registerIdentity.mockRejectedValueOnce(new Error(message));

    renderIdentityProbe();
    await screen.findByText('anonymous');
    await user.click(screen.getByRole('button', { name: 'open identity dialog' }));
    await user.click(screen.getByRole('button', { name: '注册激活' }));
    await fillValidRegistration(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(api.registerIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'firstuser' }),
    );
    // 注册失败时 dialog 保持打开，会话仍是匿名。
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('anonymous')).toBeInTheDocument();
  },
);

async function fillValidRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('用户名'), 'firstuser');
  await user.type(screen.getByLabelText('设置密码'), 'safe-password-2026');
  await user.type(screen.getByLabelText('确认密码'), 'safe-password-2026');
  await user.type(screen.getByLabelText('邀请码'), 'QJXKRP');
  await user.type(screen.getByLabelText('邮箱（可选）'), 'learner@example.com');
  await user.click(screen.getByRole('button', { name: '创建并激活账号' }));
}

function IdentityProbe() {
  const {
    generationCapabilities,
    identityEnabled,
    session,
    openIdentityDialog,
    logout,
  } = useIdentity();
  return (
    <div>
      <span>{identityEnabled ? 'identity-enabled' : 'identity-disabled'}</span>
      <span>
        {generationCapabilities?.enabled
          ? 'generation-enabled'
          : 'generation-disabled'}
      </span>
      <span>{session?.account.username ?? 'anonymous'}</span>
      <button type="button" onClick={openIdentityDialog}>
        open identity dialog
      </button>
      <button type="button" onClick={() => void logout()}>
        context logout
      </button>
    </div>
  );
}

function renderIdentityProbe() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <IdentityProbe />
      </IdentityProvider>
    </QueryClientProvider>,
  );
}
