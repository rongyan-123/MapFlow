import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IdentityDialog from './IdentityDialog';
import type { ClaimedInvitation } from './identityClient';
import { IdentityApiError } from './identityClient';
import type { LoginInput, RegistrationInput } from './types';

interface DialogOverrides {
  onClaimInvitation?: (turnstileToken?: string) => Promise<ClaimedInvitation>;
  onRegister?: (input: RegistrationInput) => Promise<unknown>;
}

function renderDialog(overrides: DialogOverrides = {}) {
  return render(
    <IdentityDialog
      pending={false}
      requestError={null}
      onClose={vi.fn()}
      onResetError={vi.fn()}
      onLogin={vi.fn() as (input: LoginInput) => Promise<unknown>}
      onRegister={
        overrides.onRegister ??
        (vi.fn() as (input: RegistrationInput) => Promise<unknown>)
      }
      onClaimInvitation={
        overrides.onClaimInvitation ??
        (vi.fn() as (turnstileToken?: string) => Promise<ClaimedInvitation>)
      }
    />,
  );
}

async function openRegistrationTab() {
  await userEvent.click(screen.getByRole('button', { name: '注册激活' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('IdentityDialog invitation claim', () => {
  it('claims directly and fills the invitation field when turnstile is not configured', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const onClaimInvitation = vi
      .fn()
      .mockResolvedValue({ invitationCode: 'EYOSBF' });
    renderDialog({ onClaimInvitation });

    await openRegistrationTab();
    await userEvent.click(screen.getByRole('button', { name: '点击领取邀请码' }));

    expect(await screen.findByText(/已领取邀请码/)).toBeInTheDocument();
    expect(onClaimInvitation).toHaveBeenCalledWith(undefined);
    expect(screen.getByLabelText('邀请码')).toHaveValue('EYOSBF');
  });

  it('shows the server rejection message and allows retrying', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const onClaimInvitation = vi.fn().mockRejectedValue(
      new IdentityApiError(
        429,
        'invitation.claim_rate_limited',
        '您 24 小时内已领取过邀请码，请使用已领取的邀请码完成注册。',
        'trace-claim',
      ),
    );
    renderDialog({ onClaimInvitation });

    await openRegistrationTab();
    await userEvent.click(screen.getByRole('button', { name: '点击领取邀请码' }));

    expect(
      await screen.findByText('您 24 小时内已领取过邀请码，请使用已领取的邀请码完成注册。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点击领取邀请码' })).toBeEnabled();
  });

  it('shows a field hint once the username loses focus while holding an email address', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    renderDialog();
    await openRegistrationTab();

    const username = screen.getByLabelText('用户名');
    await userEvent.type(username, 'a@b.com');
    await userEvent.tab();

    expect(
      screen.getByText('用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。'),
    ).toBeInTheDocument();
    expect(username).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the hint live once the blurred field is fixed', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    renderDialog();
    await openRegistrationTab();

    const username = screen.getByLabelText('用户名');
    await userEvent.type(username, 'a@b.com');
    await userEvent.tab();
    await userEvent.clear(username);
    await userEvent.type(username, 'firstuser');

    expect(
      screen.queryByText('用户名不能使用邮箱地址，请填写昵称；邮箱请填入「邮箱」栏。'),
    ).not.toBeInTheDocument();
  });

  it('warns about a malformed invitation code once it loses focus', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    renderDialog();
    await openRegistrationTab();

    const invitation = screen.getByLabelText('邀请码');
    await userEvent.type(invitation, 'ABC');
    await userEvent.tab();

    expect(screen.getByText('邀请码必须是 6 位大写字母。')).toBeInTheDocument();
  });

  it('warns about a mismatched password confirmation once it loses focus', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    renderDialog();
    await openRegistrationTab();

    const password = screen.getByLabelText('设置密码');
    await userEvent.type(password, 'safe-password-2026');
    const confirm = screen.getByLabelText('确认密码');
    await userEvent.type(confirm, 'different-password');
    await userEvent.tab();

    expect(screen.getByText('两次输入的密码不一致。')).toBeInTheDocument();
  });

  it('lights every invalid field and blocks submission on an empty submit', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const onRegister = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onRegister });
    await openRegistrationTab();

    await userEvent.click(screen.getByRole('button', { name: '创建并激活账号' }));

    expect(screen.getByText('请输入用户名。')).toBeInTheDocument();
    expect(screen.getByText('请输入密码。')).toBeInTheDocument();
    expect(screen.getByText('请再次输入密码。')).toBeInTheDocument();
    expect(screen.getByText('请输入邀请码。')).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('reports the cross-field contact rule when every field is otherwise valid', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const onRegister = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onRegister });
    await openRegistrationTab();

    await userEvent.type(screen.getByLabelText('用户名'), 'firstuser');
    await userEvent.type(screen.getByLabelText('设置密码'), 'safe-password-2026');
    await userEvent.type(screen.getByLabelText('确认密码'), 'safe-password-2026');
    await userEvent.type(screen.getByLabelText('邀请码'), 'QJXKRP');
    await userEvent.click(screen.getByRole('button', { name: '创建并激活账号' }));

    expect(screen.getByText('请至少填写邮箱或手机号。')).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('renders the turnstile widget and claims with the verified token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    let verifiedCallback: ((token: string) => void) | undefined;
    const renderMock = vi.fn(
      (_container: HTMLElement, options: TurnstileOptions) => {
        verifiedCallback = options.callback;
        return 'widget-1';
      },
    );
    vi.stubGlobal('turnstile', {
      render: renderMock,
      remove: vi.fn(),
      reset: vi.fn(),
    });
    const onClaimInvitation = vi
      .fn()
      .mockResolvedValue({ invitationCode: 'ITCJNJ' });
    renderDialog({ onClaimInvitation });

    await openRegistrationTab();
    await userEvent.click(screen.getByRole('button', { name: '点击领取邀请码' }));

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock.mock.calls[0]?.[1]?.sitekey).toBe(
      '1x00000000000000000000AA',
    );
    expect(verifiedCallback).toBeDefined();

    act(() => verifiedCallback?.('widget-token'));

    expect(await screen.findByText(/已领取邀请码/)).toBeInTheDocument();
    expect(onClaimInvitation).toHaveBeenCalledWith('widget-token');
    expect(screen.getByLabelText('邀请码')).toHaveValue('ITCJNJ');
  });
});
