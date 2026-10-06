import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaymentDisplayWindow from './PaymentDisplayWindow';
import type { PaymentDisplay } from './walletClient';

const api = vi.hoisted(() => ({ updatePaymentDisplay: vi.fn() }));
vi.mock('./walletClient', () => api);
const start = '2026-10-06T00:00:00Z';
const active: PaymentDisplay = { windowId: 'first', status: 'active', serverNow: start, expiresAt: '2026-10-06T00:00:20Z', position: 0, imageUrl: '/api/wallet/topups/order/display/first/qr' };
const waiting: PaymentDisplay = { ...active, status: 'waiting', expiresAt: null, imageUrl: null, position: 1 };
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }); api.updatePaymentDisplay.mockResolvedValue(active); });
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
const mount = () => render(<PaymentDisplayWindow topupId="order" channel="wechat" csrfToken="csrf" />);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

it('removes a QR after twenty seconds even when a poll hangs, then joins again only on click', async () => {
  api.updatePaymentDisplay.mockResolvedValueOnce(active).mockImplementation(() => new Promise(() => {}));
  mount(); await flush();
  expect(screen.getByRole('img', { name: '微信收款码' })).toHaveAttribute('src', active.imageUrl);
  await act(async () => { await vi.advanceTimersByTimeAsync(20001); });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('展示时间已结束')).toBeInTheDocument();
  expect(api.updatePaymentDisplay.mock.calls.filter(call => call[1].action === 'join')).toHaveLength(1);
  api.updatePaymentDisplay.mockResolvedValue(waiting);
  fireEvent.click(screen.getByRole('button', { name: '重新排队' })); await flush();
  expect(screen.getByText('当前有人正在充值，请稍候')).toBeInTheDocument();
  expect(api.updatePaymentDisplay.mock.calls.filter(call => call[1].action === 'join')).toHaveLength(2);
});

it('promotes a waiting window by polling its token without renewing the reservation', async () => {
  api.updatePaymentDisplay.mockResolvedValueOnce(waiting).mockResolvedValue(active);
  mount(); await flush();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(api.updatePaymentDisplay).toHaveBeenLastCalledWith('order', { action: 'poll', windowId: 'first' }, 'csrf');
});

it('hides an unconfirmed QR on network failure and releases only its own token on exit', async () => {
  api.updatePaymentDisplay.mockResolvedValueOnce(active).mockRejectedValueOnce(new Error('连接中断')).mockResolvedValue({ ...active, status: 'cancelled', imageUrl: null });
  const view=mount(); await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('连接中断');
  view.unmount(); await flush();
  expect(api.updatePaymentDisplay).toHaveBeenLastCalledWith('order', { action: 'leave', windowId: 'first' }, 'csrf');
});

it('survives StrictMode without cancelling the newly granted window', async () => {
  const view=render(<StrictMode><PaymentDisplayWindow topupId="order" channel="wechat" csrfToken="csrf" /></StrictMode>);
  await flush();
  expect(screen.getByRole('img')).toBeInTheDocument();
  expect(api.updatePaymentDisplay.mock.calls.filter(call => call[1].action === 'leave')).toHaveLength(0);
  view.unmount(); await flush();
  expect(api.updatePaymentDisplay.mock.calls.filter(call => call[1].action === 'leave')).toHaveLength(1);
});

it('ignores a slow response after closing the window', async () => {
  let resolveJoin!: (reply: PaymentDisplay) => void;
  api.updatePaymentDisplay.mockImplementationOnce(() => new Promise(resolve => { resolveJoin=resolve; }));
  const view=mount(); await flush(); view.unmount();
  await act(async () => { resolveJoin(active); });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(api.updatePaymentDisplay).toHaveBeenCalledTimes(1);
});
