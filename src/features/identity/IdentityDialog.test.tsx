import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityDialog from './IdentityDialog';
import type { ClaimedInvitation } from './identityClient';
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    challengeId: '7e6948eb-29f3-496d-8e4a-9d471d2a0ab6', question: '7 + 5 = ?', expiresInSeconds: 300,
  }), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('IdentityDialog registration', () => {
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
    await userEvent.click(screen.getByRole('button', { name: '创建并激活账号' }));

    expect(screen.getByText('请至少填写邮箱或手机号。')).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();
  });

});
