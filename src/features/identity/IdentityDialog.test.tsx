import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IdentityDialog from './IdentityDialog';
import type { ClaimedInvitation } from './identityClient';
import { IdentityApiError } from './identityClient';
import type { LoginInput, RegistrationInput } from './types';

interface DialogOverrides {
  onClaimInvitation?: (turnstileToken?: string) => Promise<ClaimedInvitation>;
}

function renderDialog(overrides: DialogOverrides = {}) {
  return render(
    <IdentityDialog
      pending={false}
      requestError={null}
      onClose={vi.fn()}
      onResetError={vi.fn()}
      onLogin={vi.fn() as (input: LoginInput) => Promise<unknown>}
      onRegister={vi.fn() as (input: RegistrationInput) => Promise<unknown>}
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
