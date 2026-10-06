import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminWalletTab from './AdminWalletTab';
import type { LedgerEntry, Topup, WalletAccount } from '../wallet/walletClient';

const order: Topup = { topupId: 'order-1', accountId: 'account-a', username: 'alice', playerId: 'player-a', amountFen: 300, channel: 'wechat', status: 'awaiting_review', qrCodeId: 'qr-1', qrImageUrl: '/api/wallet/qrcodes/qr-1', createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', reviewNote: null };
const account: WalletAccount = { accountId: 'account-a', username: 'alice', playerId: 'player-a', status: 'active', balanceMicros: 3_100_000 };
const entry: LedgerEntry = { entryId: 'entry-1', accountId: 'account-a', username: 'alice', playerId: 'player-a', actorUsername: 'admin', note: '核实充值', kind: 'topup', amountMicros: 3_000_000, balanceAfterMicros: 3_100_000, topupId: 'order-1', reversalOf: null, reversed: false, createdAt: '2026-10-01T00:00:00Z' };
const qr = { channel: 'wechat', label: '微信', qrCodeId: 'qr-1', imageUrl: '/api/wallet/qrcodes/qr-1' };
const http = vi.fn<typeof fetch>();
const respond = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
let client: QueryClient;
let approval: () => Promise<Response>;
let upload: () => Promise<Response>;
let adjustment: () => Promise<Response>;
let reversal: () => Promise<Response>;
let pendingOrders: Topup[];
let ledgerEntries: LedgerEntry[];
let hasMore: boolean;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  pendingOrders = [order]; ledgerEntries = [entry]; hasMore = false;
  approval = async () => { pendingOrders = []; return respond({ ...order, status: 'credited' }); };
  upload = async () => respond(qr);
  adjustment = async () => respond({ ...entry, kind: 'adjustment', topupId: null, note: '更正余额', amountMicros: -2_000_000, balanceAfterMicros: 1_100_000 });
  reversal = async () => { ledgerEntries = [{ ...entry, reversed: true }]; return respond({ ...entry, entryId: 'reverse-1', kind: 'reversal', reversalOf: entry.entryId, amountMicros: -3_000_000, balanceAfterMicros: 100_000 }); };
  http.mockReset().mockImplementation(async (path, options) => {
    const url = new URL(String(path), 'http://localhost');
    if (options?.method === 'POST') {
      if (url.pathname.endsWith('/approve')) return approval();
      if (url.pathname.endsWith('/reject')) { pendingOrders = []; return respond({ ...order, status: 'rejected' }); }
      if (url.pathname.endsWith('/adjust')) return adjustment();
      if (url.pathname.endsWith('/reverse')) return reversal();
      if (url.pathname.includes('/payment-channels/')) return upload();
    }
    if (url.pathname.endsWith('/topups')) return respond({ topups: pendingOrders, pendingCount: pendingOrders.length });
    if (url.pathname.endsWith('/payment-channels')) return respond({ channels: [qr] });
    if (url.pathname.endsWith('/accounts')) return respond({ accounts: [account, { ...account, accountId: 'account-b', username: 'bob', playerId: 'player-b', balanceMicros: 2_000_000 }] });
    if (url.pathname.endsWith('/ledger')) return respond({ entries: ledgerEntries, hasMore });
    return respond({ error: { message: `Unexpected URL: ${url.pathname}` } }, 404);
  });
  vi.stubGlobal('fetch', http);
});
afterEach(() => { client.clear(); vi.unstubAllGlobals(); });
function mount(accountId = 'admin-a') {
  return render(<QueryClientProvider client={client}><AdminWalletTab csrfToken="csrf" accountId={accountId} /></QueryClientProvider>);
}
function writes(suffix: string) { return http.mock.calls.filter(([path, options]) => String(path).endsWith(suffix) && options?.method === 'POST'); }
function payload(suffix: string, index = 0) { return JSON.parse(String(writes(suffix)[index]?.[1]?.body)); }

it('approves the named amount with the admin password and no receipt, blocks duplicate submission, and clears the password', async () => {
  let finishApproval: (response: Response) => void = () => {};
  approval = () => new Promise(resolve => { finishApproval = resolve; });
  mount(); await screen.findByText(/alice/);
  expect(http.mock.calls.some(([path]) => String(path).endsWith('/topups?status=awaiting_review'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '入账 3 额度' }));
  const dialog = screen.getByRole('dialog', { name: '确认入账' });
  expect(within(dialog).getByText(/alice/)).toBeInTheDocument();
  expect(screen.queryByLabelText('收款流水号')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '确认入账 3 额度' }));
  expect(writes('/approve')).toHaveLength(0);
  expect(within(dialog).getByText('请输入管理员登录密码。')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('管理员登录密码'), { target: { value: 'admin-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认入账 3 额度' }));
  fireEvent.click(within(dialog).getByRole('button', { name: /处理中/ }));
  expect(writes('/approve')).toHaveLength(1);
  expect(payload('/approve')).toEqual({ password: 'admin-password' });
  pendingOrders = [];
  await act(async () => finishApproval(respond({ ...order, status: 'credited' })));
  expect(await screen.findByText('已为 alice 入账 3 额度')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});

it('clears file selection so the same QR image can be retried after an error', async () => {
  let attempts = 0;
  upload = async () => ++attempts === 1 ? respond({ error: { code: 'wallet.invalid_image', message: '图片无效' } }, 400) : respond(qr);
  mount();
  fireEvent.click(screen.getByRole('tab', { name: '收款码' }));
  await screen.findByAltText('微信收款码');
  const user = userEvent.setup();
  const file = new File(['png'], 'pay.png', { type: 'image/png' });
  const picker = screen.getByLabelText('替换微信收款码');
  await user.upload(picker, file);
  expect(await screen.findByText('图片无效')).toBeInTheDocument();
  expect(picker).toHaveValue('');
  await user.upload(picker, file);
  await waitFor(() => expect(writes('/payment-channels/wechat')).toHaveLength(2));
});

it('requires a rejection reason and needs no password for rejection', async () => {
  mount(); await screen.findByText(/alice/);
  fireEvent.click(screen.getByRole('button', { name: '拒绝申请' }));
  const dialog = screen.getByRole('dialog', { name: '拒绝申请' });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认拒绝' }));
  expect(writes('/reject')).toHaveLength(0);
  expect(screen.queryByLabelText('管理员登录密码')).not.toBeInTheDocument();
  expect(within(dialog).getByText('请填写拒绝理由。')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('拒绝理由'), { target: { value: '未找到对应收款' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认拒绝' }));
  await waitFor(() => expect(writes('/reject')).toHaveLength(1));
  expect(payload('/reject')).toEqual({ note: '未找到对应收款' });
});

it('selects a concrete user and retries a signed adjustment with the same request ID and a fresh password', async () => {
  let failFirst: (response: Response) => void = () => {};
  let attempts = 0;
  adjustment = () => ++attempts === 1 ? new Promise(resolve => { failFirst = resolve; }) : Promise.resolve(respond({ ...entry, kind: 'adjustment', amountMicros: -2_000_000, note: '更正余额', balanceAfterMicros: 1_100_000 }));
  client.setQueryData(['me', 'player-a', 'wallet'], { balanceMicros: 3_100_000 });
  client.setQueryData(['me', 'player-a', 'credit'], { balance: 500 });
  client.setQueryData(['admin', 'admin-a', 'wallet', 'ledger', '', 0], { entries: [], hasMore: false });
  mount();
  fireEvent.click(screen.getByRole('tab', { name: '调整用户额度' }));
  expect(screen.getByRole('button', { name: '确认调整' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('搜索用户'), { target: { value: 'alice' } });
  fireEvent.click(screen.getByRole('button', { name: '查找用户' }));
  fireEvent.click(await screen.findByRole('button', { name: /选择 alice/ }));
  expect(screen.getByText('当前余额 3.1 额度')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '扣减额度' }));
  fireEvent.change(screen.getByLabelText('调整额度'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '确认调整' }));
  const dialog = screen.getByRole('dialog', { name: '确认调整额度' });
  fireEvent.click(within(dialog).getByRole('button', { name: '扣减 2 额度' }));
  expect(writes('/adjust')).toHaveLength(0);
  expect(within(dialog).getByText('请填写调整原因。')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('调整原因'), { target: { value: '更正余额' } });
  fireEvent.change(within(dialog).getByLabelText('管理员登录密码'), { target: { value: 'first-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '扣减 2 额度' }));
  expect(within(dialog).getByRole('button', { name: '处理中…' })).toBeDisabled();
  expect(writes('/adjust')).toHaveLength(1);
  expect(payload('/adjust')).toMatchObject({ requestId: expect.any(String), amountFen: -200, note: '更正余额', password: 'first-password' });
  expect(payload('/adjust').requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(writes('/adjust')[0][0]).toBe('/api/admin/wallet/accounts/account-a/adjust');
  await act(async () => failFirst(respond({ error: { code: 'wallet.network_unavailable', message: '连接中断，请重试' } }, 503)));
  expect(await within(dialog).findByText('连接中断，请重试')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('管理员登录密码')).toHaveValue('');
  fireEvent.change(within(dialog).getByLabelText('管理员登录密码'), { target: { value: 'second-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '扣减 2 额度' }));
  expect(await screen.findByText('已为 alice 扣减 2 额度')).toBeInTheDocument();
  expect(payload('/adjust', 1)).toEqual({ ...payload('/adjust'), password: 'second-password' });
  expect(client.getQueryState(['me', 'player-a', 'wallet'])?.isInvalidated).toBe(true);
  expect(client.getQueryState(['me', 'player-a', 'credit'])?.isInvalidated).toBe(false);
  expect(client.getQueryState(['admin', 'admin-a', 'wallet', 'ledger', '', 0])?.isInvalidated).toBe(true);
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});

it('browses ledger search and pages, cancels without writing, and reverses with a reason and password', async () => {
  hasMore = true;
  mount();
  fireEvent.click(screen.getByRole('tab', { name: '已处理记录' }));
  expect(await screen.findByText('核实充值')).toBeInTheDocument();
  expect(screen.getByText('+3 额度')).toBeInTheDocument();
  expect(screen.getByText('admin')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(http.mock.calls.some(([path]) => String(path).endsWith('/ledger?search=&offset=50'))).toBe(true));
  fireEvent.change(screen.getByLabelText('搜索记录'), { target: { value: 'alice' } });
  fireEvent.click(screen.getByRole('button', { name: '搜索记录' }));
  await waitFor(() => expect(http.mock.calls.some(([path]) => String(path).endsWith('/ledger?search=alice&offset=0'))).toBe(true));
  fireEvent.click(await screen.findByRole('button', { name: '撤销变动' }));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(writes('/reverse')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '撤销变动' }));
  const dialog = screen.getByRole('dialog', { name: '撤销额度变动' });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销' }));
  expect(writes('/reverse')).toHaveLength(0);
  expect(screen.getByText('请填写撤销原因。')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('撤销原因'), { target: { value: '误确认了申请' } });
  fireEvent.change(screen.getByLabelText('管理员登录密码'), { target: { value: 'admin-password' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销' }));
  expect(await screen.findByText('已撤销该笔变动')).toBeInTheDocument();
  expect(await screen.findByText('已撤销')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '撤销变动' })).not.toBeInTheDocument();
  expect(payload('/reverse')).toEqual({ note: '误确认了申请', password: 'admin-password' });
});

it('keeps the original entry after insufficient balance and permits a password-authenticated retry', async () => {
  let attempts = 0;
  const completeReversal = reversal;
  reversal = () => ++attempts === 1 ? Promise.resolve(respond({ error: { code: 'wallet.insufficient_balance', message: '可用额度不足，无法撤销。' } }, 409)) : completeReversal();
  mount();
  fireEvent.click(screen.getByRole('tab', { name: '已处理记录' }));
  fireEvent.click(await screen.findByRole('button', { name: '撤销变动' }));
  fireEvent.change(screen.getByLabelText('撤销原因'), { target: { value: '误操作' } });
  fireEvent.change(screen.getByLabelText('管理员登录密码'), { target: { value: 'admin-password' } });
  fireEvent.click(screen.getByRole('button', { name: '确认撤销' }));
  expect(await screen.findByText('可用额度不足，无法撤销。')).toBeInTheDocument();
  expect(screen.queryByText('已撤销')).not.toBeInTheDocument();
  expect(screen.getByLabelText('撤销原因')).toHaveValue('误操作');
  expect(screen.getByLabelText('管理员登录密码')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('管理员登录密码'), { target: { value: 'admin-password' } });
  fireEvent.click(screen.getByRole('button', { name: '确认撤销' }));
  expect(await screen.findByText('已撤销')).toBeInTheDocument();
  expect(writes('/reverse')).toHaveLength(2);
});
