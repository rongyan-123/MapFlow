import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreditPill from './CreditPill';

const signInForCredit = vi.hoisted(() => vi.fn());

vi.mock('./creditClient', () => ({ signInForCredit }));
vi.mock('../identity/IdentityContext', () => ({
  useIdentity: () => ({ session: { csrfToken: 'csrf-token' } }),
}));

describe('CreditPill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signInForCredit.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('automatically hides the successful sign-in notice', async () => {
    signInForCredit.mockResolvedValueOnce({ balance: 10, awarded: 5 });
    renderCreditPill();

    fireEvent.click(screen.getByRole('button', { name: '签到领取积分' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('签到成功，获得 5 积分。')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.queryByText('签到成功，获得 5 积分。')).not.toBeInTheDocument();
  });
});

function renderCreditPill() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditPill
        credit={{ balance: 5, signedInToday: false, freeRemaining: 1, pricePerTree: 3 }}
        onSignedIn={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
