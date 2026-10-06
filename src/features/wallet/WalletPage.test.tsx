import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import WalletPage from './WalletPage';

const api = vi.hoisted(() => ({ readWallet: vi.fn(), createTopup: vi.fn(), declarePaid: vi.fn(), declareUnpaid: vi.fn(), updatePaymentDisplay: vi.fn() }));
vi.mock('./walletClient', async importOriginal => ({ ...await importOriginal<typeof import('./walletClient')>(), ...api }));
const topup = { topupId: 'order-1', accountId: 'a', amountFen: 100, channel: 'wechat', status: 'awaiting_payment', qrCodeId: 'qr-1', qrImageUrl: '/api/wallet/qrcodes/qr-1', createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', reviewNote: null };
const wallet = { balanceMicros: 100000, currency: 'CNY', supportContact: 'v：19375007608', channels: [{ channel: 'wechat', label: '微信', qrCodeId: 'qr-1', imageUrl: '/api/wallet/qrcodes/qr-1' }], topups: [], ledger: [{ entryId: 'welcome-1', kind: 'welcome', amountMicros: 100000, balanceAfterMicros: 100000, topupId: null, createdAt: '2026-09-30T00:00:00Z' }] };
let client: QueryClient;
beforeEach(() => api.updatePaymentDisplay.mockImplementation(async (_id, input) => ({ windowId: 'window-1', status: input.action === 'leave' ? 'cancelled' : 'active', serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 20000).toISOString(), position: 0, imageUrl: '/api/wallet/topups/order-1/display/window-1/qr' })));
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); api.readWallet.mockResolvedValue(wallet); api.createTopup.mockResolvedValue(topup); api.declarePaid.mockResolvedValue({ ...topup, status: 'awaiting_review' }); api.declareUnpaid.mockResolvedValue({ ...topup, status: 'closed_unpaid' }); });
afterEach(() => { client.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); });
function mount(accountId = 'a') { return render(<QueryClientProvider client={client}><WalletPage accountId={accountId} csrfToken="csrf" onBack={() => {}} onNavigateModels={() => {}} /></QueryClientProvider>); }

it('shows model consumption amounts without internal settlement notes', async () => {
  api.readWallet.mockResolvedValueOnce({ ...wallet, balanceMicros: 99884, ledger: [{
    entryId: 'usage-1', kind: 'usage', amountMicros: -116, balanceAfterMicros: 99884,
    note: '酒馆模型消费：上游实际费用 × 2', createdAt: '2026-10-07T00:00:00Z',
  }] });
  mount();
  expect(await screen.findByText('模型消费')).toBeInTheDocument();
  expect(screen.getByText('-0.000116 额度')).toBeInTheDocument();
  expect(screen.getByText('余额 0.099884 额度')).toBeInTheDocument();
  expect(screen.queryByText(/上游.*(2|倍)|倍率/)).not.toBeInTheDocument();
});

it('shows an honest queue without a payment QR until the server grants the window', async () => {
  api.updatePaymentDisplay.mockResolvedValue({ windowId: 'waiting-1', status: 'waiting', serverNow: new Date().toISOString(), expiresAt: null, position: 1, imageUrl: null });
  mount(); await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  expect(await screen.findByText('当前有人正在充值，请稍候')).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '微信收款码' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '查看收款码原图' })).not.toBeInTheDocument();
});

it('waits for the previous display release before reopening its QR', async () => {
  let finishLeave!: () => void;
  api.updatePaymentDisplay.mockImplementation(async (_id,input) => {
    if (input.action === 'leave') await new Promise<void>(resolve => { finishLeave=resolve; });
    return { windowId:'window-1',status:'active',serverNow:new Date().toISOString(),expiresAt:new Date(Date.now()+20000).toISOString(),position:0,imageUrl:'/api/wallet/topups/order-1/display/window-1/qr' };
  });
  mount(); await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'创建充值申请'}));
  await screen.findByRole('img',{name:'微信收款码'});
  fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  fireEvent.click(screen.getByRole('button',{name:'返回收款码'}));
  await act(async () => { await Promise.resolve(); });
  expect(api.updatePaymentDisplay.mock.calls.filter(call=>call[1].action==='join')).toHaveLength(1);
  await act(async () => { finishLeave(); });
  await screen.findByRole('img',{name:'微信收款码'});
  expect(api.updatePaymentDisplay.mock.calls.filter(call=>call[1].action==='join')).toHaveLength(2);
});

it('shows the reserved payment amount and closes the dialog once polling confirms credit', async () => {
  api.createTopup.mockResolvedValueOnce({ ...topup, paymentAmountFen: 101, paymentExpiresAt: '2099-10-06T12:00:00Z' });
  mount();
  await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  const dialog = await screen.findByRole('dialog', { name: '充值付款' });
  expect(within(dialog).getByText('请支付 ¥1.01')).toBeInTheDocument();
  expect(within(dialog).getByText(/实付金额将全部计入额度/)).toBeInTheDocument();
  await act(async () => { client.setQueryData(['me', 'a', 'wallet'], { ...wallet, balanceMicros: 1_110_000, topups: [{ ...topup, paymentAmountFen: 101, status: 'credited' }] }); });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('充值已到账')).toBeInTheDocument();
  expect(api.declarePaid).not.toHaveBeenCalled();
});

it('shows the wallet balance and welcome ledger without mixing account query caches', async () => {
  const view = mount();
  expect(await screen.findByText("0.1 额度")).toBeInTheDocument();
  expect(screen.getByText(/赠送/)).toBeInTheDocument();
  api.readWallet.mockResolvedValueOnce({ ...wallet, balanceMicros: 200000, ledger: [] });
  view.rerender(<QueryClientProvider client={client}><WalletPage accountId="b" csrfToken="csrf" onBack={() => {}} onNavigateModels={() => {}} /></QueryClientProvider>);
  expect(await screen.findByText("0.2 额度")).toBeInTheDocument();
});

it('waits five seconds for paid exit and sends only the chosen declaration', async () => {
  mount();
  await screen.findByText('0.1 额度');
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getByRole('img', { name: '微信收款码' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '我已付款，点击退出' })).not.toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(5000); });
  fireEvent.click(screen.getByRole('button', { name: '我已付款，点击退出' }));
  expect(screen.getByRole('button', { name: '我没有付款' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '我已付款' }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(api.declarePaid).toHaveBeenCalledTimes(1);
  expect(api.declareUnpaid).not.toHaveBeenCalled();
});

it('keeps request id on failed creation retry and prevents duplicate clicks', async () => {
  let rejectFirst!: (error: Error) => void;
  api.createTopup.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; })).mockResolvedValueOnce(topup);
  mount();
  await screen.findByText("0.1 额度");
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  fireEvent.click(screen.getByRole('button', { name: /创建充值申请|创建中/ }));
  expect(api.createTopup).toHaveBeenCalledTimes(1);
  rejectFirst(new Error('网络错误'));
  expect(await screen.findByText('网络错误')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  await waitFor(() => expect(api.createTopup).toHaveBeenCalledTimes(2));
  expect(api.createTopup.mock.calls[0][0].requestId).toBe(api.createTopup.mock.calls[1][0].requestId);
});

it('reports wallet request errors with retry', async () => {
  api.readWallet.mockRejectedValueOnce(new Error('服务不可用'));
  mount();
  expect(await screen.findByText('服务不可用')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取额度' }));
  expect(await screen.findByText("0.1 额度")).toBeInTheDocument();
});

it('refreshes a pending order after external approval without navigation and hides stale balance on refresh error', async () => {
  const pending = { ...topup, status: 'awaiting_review' };
  api.readWallet.mockResolvedValueOnce({ ...wallet, topups: [pending] })
    .mockRejectedValueOnce(new Error('刷新失败'))
    .mockResolvedValueOnce({ ...wallet, balanceMicros: 1_100_000, topups: [{ ...pending, status: 'credited' }], ledger: [...wallet.ledger, { entryId: 'credit-1', kind: 'topup', amountMicros: 1_000_000, balanceAfterMicros: 1_100_000, topupId: 'order-1', createdAt: '2026-09-30T00:01:00Z' }] });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  mount();
  await screen.findByText(/待核实/);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(await screen.findByText('刷新失败')).toBeInTheDocument();
  expect(screen.queryByText('0.1 额度')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取额度' }));
  expect(await screen.findByText('1.1 额度')).toBeInTheDocument();
  expect(screen.getByText(/已入账/)).toBeInTheDocument();
});

it('shows externally credited balance and status on the next pending poll', async () => {
  const pending = { ...topup, status: 'awaiting_review' };
  api.readWallet.mockResolvedValueOnce({ ...wallet, topups: [pending] })
    .mockResolvedValueOnce({ ...wallet, balanceMicros: 1_100_000, topups: [{ ...pending, status: 'credited' }], ledger: [...wallet.ledger, { entryId: 'credit-1', kind: 'topup', amountMicros: 1_000_000, balanceAfterMicros: 1_100_000, topupId: 'order-1', createdAt: '2026-09-30T00:01:00Z' }] });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  mount(); await screen.findByText(/待核实/);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(await screen.findByText('1.1 额度')).toBeInTheDocument();
  expect(screen.getByText(/已入账/)).toBeInTheDocument();
});

it('refreshes the balance when an older pending order is absent from the newest 50 orders', async () => {
  const closedOrders = Array.from({ length: 50 }, (_, index) => ({
    ...topup, topupId: `closed-${index}`, status: 'closed_unpaid',
  }));
  api.readWallet.mockResolvedValueOnce({ ...wallet, topups: closedOrders })
    .mockResolvedValueOnce({ ...wallet, balanceMicros: 1_100_000, topups: closedOrders,
      ledger: [...wallet.ledger, { entryId: 'credit-old', kind: 'topup', amountMicros: 1_000_000,
        balanceAfterMicros: 1_100_000, topupId: 'older-pending-order', createdAt: '2026-09-30T00:01:00Z' }] });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  mount(); await screen.findByText('0.1 额度');
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(await screen.findByText('1.1 额度')).toBeInTheDocument();
  expect(api.readWallet).toHaveBeenCalledTimes(2);
});

it('ordinary close sends only unpaid declaration after the secondary choice', async () => {
  mount(); await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  await screen.findByRole('dialog', { name: '充值付款' });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '我没有付款' }));
  await waitFor(() => expect(api.declareUnpaid).toHaveBeenCalledWith('order-1', 'csrf'));
  expect(api.declarePaid).not.toHaveBeenCalled();
});

it('retries failed declaration and blocks repeated clicks during the pending request', async () => {
  let rejectFirst!: (error: Error) => void;
  api.declarePaid.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
  mount(); await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  await screen.findByRole('dialog', { name: '充值付款' });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '我已付款' }));
  fireEvent.click(screen.getByRole('button', { name: '我已付款' }));
  expect(api.declarePaid).toHaveBeenCalledTimes(1);
  rejectFirst(new Error('声明失败'));
  expect(await screen.findByText('声明失败')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '我已付款' }));
  await waitFor(() => expect(api.declarePaid).toHaveBeenCalledTimes(2));
  expect(api.declareUnpaid).not.toHaveBeenCalled();
});

it('restarts the paid exit delay after returning from the secondary choice and cleans up on unmount', async () => {
  const mounted = mount(); await screen.findByText('0.1 额度');
  vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await act(async () => { vi.advanceTimersByTime(4000); });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(screen.queryByRole('button', { name: '我已付款，点击退出' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回收款码' }));
  await act(async () => { vi.advanceTimersByTime(4999); });
  expect(screen.queryByRole('button', { name: '我已付款，点击退出' })).not.toBeInTheDocument();
  mounted.unmount();
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('shows signed adjustments and reversals with reasons, remaining balance, and reversed topup status', async () => {
  api.readWallet.mockResolvedValueOnce({ ...wallet, balanceMicros: 1_100_000,
    topups: [{ ...topup, status: 'reversed' }],
    ledger: [
      { entryId: 'adjustment-1', kind: 'adjustment', note: '修正重复赠送', amountMicros: -2_000_000, balanceAfterMicros: 1_100_000, createdAt: '2026-10-01T00:00:00Z', reversed: false },
      { entryId: 'reversal-1', kind: 'reversal', note: '撤销重复入账', amountMicros: -1_000_000, balanceAfterMicros: 3_100_000, createdAt: '2026-10-01T00:00:00Z', reversed: false },
      { entryId: 'topup-1', kind: 'topup', note: '人工核实收款', amountMicros: 1_000_000, balanceAfterMicros: 4_100_000, createdAt: '2026-09-30T00:00:00Z', reversed: true },
    ],
  });
  mount();
  expect(await screen.findByText('修正重复赠送')).toBeInTheDocument();
  expect(screen.getByText('-2 额度')).toBeInTheDocument();
  expect(screen.getByText('撤销重复入账')).toBeInTheDocument();
  expect(screen.getByText('-1 额度')).toBeInTheDocument();
  expect(screen.queryByText('+-2 额度')).not.toBeInTheDocument();
  expect(screen.getByText(/余额 1.1 额度/)).toBeInTheDocument();
  expect(screen.getAllByText(/已撤销/).length).toBeGreaterThanOrEqual(2);
});

it('uses the available payment channel when only Alipay is configured', async () => {
  api.readWallet.mockResolvedValue({ ...wallet, channels: [{ channel: 'alipay', label: '支付宝', qrCodeId: 'alipay-qr', imageUrl: '/api/wallet/qrcodes/alipay-qr' }] });
  api.createTopup.mockResolvedValue({ ...topup, channel: 'alipay', qrCodeId: 'alipay-qr', qrImageUrl: '/api/wallet/qrcodes/alipay-qr' });
  mount();
  await screen.findByText('0.1 额度');
  fireEvent.change(screen.getByLabelText('充值金额（元）'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: '创建充值申请' }));
  expect(await screen.findByRole('dialog', { name: '充值付款' })).toBeInTheDocument();
  expect(api.createTopup).toHaveBeenCalledWith(expect.objectContaining({ channel: 'alipay', amountFen: 300 }), 'csrf');
});


it('does not create another application when Enter is pressed again after the payment dialog opens', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText('0.1 额度');
  await user.type(screen.getByLabelText('充值金额（元）'), '1');
  const createButton = screen.getByRole('button', { name: '创建充值申请' });
  createButton.focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('dialog', { name: '充值付款' });
  await screen.findByRole('button', { name: '创建充值申请' });
  await user.keyboard('{Enter}');
  expect(api.createTopup).toHaveBeenCalledTimes(1);
  expect(createButton).toBeDisabled();
  expect(screen.getByRole('dialog', { name: '充值付款' })).toHaveAttribute('aria-modal', 'true');
});

it('contains keyboard focus through both payment views and returns it to the trigger after declaring unpaid', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByText('0.1 额度');
  await user.type(screen.getByLabelText('充值金额（元）'), '1');
  const createButton = screen.getByRole('button', { name: '创建充值申请' });
  await user.click(createButton);
  const dialog = await screen.findByRole('dialog', { name: '充值付款' });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.tab({ shift: true });
  expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveFocus();
  await user.tab();
  expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(within(dialog).getByRole('button', { name: '关闭' })).toHaveFocus();
  screen.getByLabelText('充值金额（元）').focus();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.keyboard('{Escape}');
  expect(within(dialog).getByRole('button', { name: '我没有付款' })).toBeInTheDocument();
  expect(api.declarePaid).not.toHaveBeenCalled();
  expect(api.declareUnpaid).not.toHaveBeenCalled();
  await user.tab({ shift: true });
  expect(within(dialog).getByRole('button', { name: '返回收款码' })).toHaveFocus();
  await user.tab();
  expect(within(dialog).getByRole('button', { name: '我已付款' })).toHaveFocus();
  await user.click(within(dialog).getByRole('button', { name: '我没有付款' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(createButton).toHaveFocus());
  expect(createButton).toBeEnabled();
  expect(api.createTopup).toHaveBeenCalledTimes(1);
  expect(api.declareUnpaid).toHaveBeenCalledWith('order-1', 'csrf');
});
