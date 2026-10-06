import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import WalletBalance from './WalletBalance';

const wallet = { balanceMicros: 3_100_000, currency: 'CNY', supportContact: '', channels: [], topups: [], ledger: [] };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('opens recharge with live cash balance and separates account caches from learning credits', async () => {
  const http = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(wallet)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...wallet, balanceMicros: 800_000 })));
  vi.stubGlobal('fetch', http);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['me', 'player-a', 'credit'], { balance: 120 });
  const navigate = vi.fn();
  const mounted = render(<QueryClientProvider client={client}><WalletBalance accountId="player-a" onClick={navigate} /></QueryClientProvider>);
  const balance = await screen.findByRole('button', { name: '现金额度 3.1，前往充值' });
  fireEvent.click(balance);
  expect(navigate).toHaveBeenCalledTimes(1);
  mounted.rerender(<QueryClientProvider client={client}><WalletBalance accountId="player-b" onClick={navigate} /></QueryClientProvider>);
  expect(screen.queryByText('3.1')).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: '现金额度 0.8，前往充值' })).toBeInTheDocument();
  expect(client.getQueryData(['me', 'player-a', 'wallet'])).toEqual(wallet);
  expect(client.getQueryData(['me', 'player-a', 'credit'])).toEqual({ balance: 120 });
  client.clear();
});

it('polls external approvals and hides a stale amount after a refresh error while leaving recharge accessible', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const http = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(wallet)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...wallet, balanceMicros: 6_100_000 })))
    .mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', http);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WalletBalance accountId="player-a" onClick={() => {}} /></QueryClientProvider>);
  await screen.findByRole('button', { name: '现金额度 3.1，前往充值' });
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  await screen.findByRole('button', { name: '现金额度 6.1，前往充值' });
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(await screen.findByRole('button', { name: '额度暂不可用，前往充值' })).toBeInTheDocument();
  expect(screen.queryByText('6.1')).not.toBeInTheDocument();
  client.clear();
});
