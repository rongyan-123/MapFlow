import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityAccess from './IdentityAccess';
import { IdentityProvider } from './IdentityContext';

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

describe('IdentityAccess', () => {
  it('stays out of the anonymous browsing UI when identity is disabled', async () => {
    api.fetchCapabilities.mockResolvedValue({
      identity: { registrationEnabled: false },
    });
    api.fetchCurrentSession.mockResolvedValue(null);

    renderIdentityAccess();

    await waitFor(() => expect(api.fetchCapabilities).toHaveBeenCalledOnce());
    expect(api.fetchCurrentSession).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: '登录 / 激活账号' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the login entry visible when capabilities fail', async () => {
    api.fetchCapabilities.mockRejectedValue(new Error('network down'));
    api.fetchCurrentSession.mockResolvedValue(null);

    renderIdentityAccess();

    expect(
      await screen.findByRole(
        'button',
        { name: '登录 / 激活账号' },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
  });

  it('shows an existing session even while capabilities are unavailable', async () => {
    api.fetchCapabilities.mockRejectedValue(new Error('network down'));
    api.fetchCurrentSession.mockResolvedValue(authenticated);

    renderIdentityAccess();

    expect(await screen.findByText('MF-7K3P-9D2Q-X8CW')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
  });

  it('registers through the modal, shows the server player ID, and logs out with CSRF', async () => {
    const user = userEvent.setup();
    api.fetchCapabilities.mockResolvedValue({
      identity: { registrationEnabled: true },
    });
    api.fetchCurrentSession.mockResolvedValue(null);
    api.registerIdentity.mockResolvedValue(authenticated);
    api.logoutIdentity.mockResolvedValue(undefined);

    renderIdentityAccess();

    await user.click(
      await screen.findByRole('button', { name: '登录 / 激活账号' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '注册激活' }));
    await user.type(screen.getByLabelText('用户名'), 'firstuser');
    await user.type(screen.getByLabelText('设置密码'), 'safe-password-2026');
    await user.type(screen.getByLabelText('确认密码'), 'safe-password-2026');
    await user.type(screen.getByLabelText('邀请码'), 'q1j2x3k4r5p6');
    await user.type(screen.getByLabelText('邮箱（可选）'), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: '创建并激活账号' }));

    await waitFor(() =>
      expect(api.registerIdentity).toHaveBeenCalledWith({
        username: 'firstuser',
        password: 'safe-password-2026',
        invitationCode: 'QJXKRP',
        email: 'learner@example.com',
      }),
    );
    expect(await screen.findByText('firstuser')).toBeInTheDocument();
    expect(screen.getByText('MF-7K3P-9D2Q-X8CW')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '退出登录' }));
    await waitFor(() =>
      expect(api.logoutIdentity).toHaveBeenCalledWith('csrf-secret'),
    );
    expect(
      await screen.findByRole('button', { name: '登录 / 激活账号' }),
    ).toBeInTheDocument();
  });
});

function renderIdentityAccess() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <IdentityAccess />
      </IdentityProvider>
    </QueryClientProvider>,
  );
}
