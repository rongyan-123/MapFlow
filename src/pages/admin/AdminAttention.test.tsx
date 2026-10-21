import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AdminAttention from './AdminAttention';

afterEach(() => vi.unstubAllGlobals());
const executionId = '01a14370-3646-7603-a29c-69dcc8bc6e49';
const record = {
  executionId, accountId: '01a13d99-c669-7892-a45b-24b9ef2337a4', conversationId: '11111111-1111-4111-8111-111111111111',
  funding: 'byok', status: 'audit_only', cashMicros: null, pointUnits: null, checkedAt: null,
  attentionKey: 'a'.repeat(64), reason: '真实金额回执尚不完整，保持待核对', diagnostic: {},
  calls: [{ callId: '5a074b1e-b4cb-43f7-9d64-2a446d919ea9', status: 'dispatched', receipts: [], usage: { inputTokens: 45581, outputTokens: 3256 } }],
};

it('shows each account name and ID in the list and the selected review dialog', async () => {
  const secondAccountId = '01a148b5-ca0c-7ea3-93dc-1516808b1a80';
  vi.stubGlobal('fetch', async (path: string) => Response.json(path.endsWith('/model-balance')
    ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
    : { pending: [{ ...record, username: '用户甲', funding: 'cash' }, {
      ...record, executionId: '01a15c20-e185-7290-bab3-a6f839a84678', accountId: secondAccountId, username: 'Veritus', funding: 'cash',
    }], nextBefore: null, totalCount: 2 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  const firstIdentity = screen.getByText(`账号：用户甲 · ${record.accountId}`, { exact: false });
  expect(firstIdentity).toBeVisible();
  const secondIdentity = screen.getByText(`账号：Veritus · ${secondAccountId}`, { exact: false });
  expect(secondIdentity).toBeVisible();
  fireEvent.click(within(secondIdentity.closest('article')!).getByRole('button', { name: '核对这笔记录' }));
  const dialog = within(screen.getByRole('dialog', { name: '核对执行记录' }));
  expect(dialog.getByText(`账号：Veritus · ${secondAccountId}`)).toBeVisible();
  expect(dialog.queryByText('用户甲', { exact: false })).not.toBeInTheDocument();
});

it.each([undefined, null, ''])('keeps the account ID visible when a name is unavailable (%s)', async username => {
  vi.stubGlobal('fetch', async (path: string) => Response.json(path.endsWith('/model-balance')
    ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
    : { pending: [{ ...record, username }], nextBefore: null, totalCount: 1 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  expect(screen.getByText(`账号：用户名暂不可用 · ${record.accountId}`, { exact: false })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '核对这笔记录' }));
  expect(within(screen.getByRole('dialog', { name: '核对执行记录' })).getByText(`账号：用户名暂不可用 · ${record.accountId}`)).toBeVisible();
});

it('gives the administrator an action for a BYOK audit record with an unresolved call', async () => {
  vi.stubGlobal('fetch', async (path: string) => Response.json(path.endsWith('/model-balance')
    ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
    : { pending: [record], nextBefore: null, totalCount: 1 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  expect(screen.getByText(`执行：${executionId}`)).toBeVisible();
  expect(screen.getByRole('button', { name: '核对这笔记录' })).toBeEnabled();
});

it('requires a review note, blocks duplicate submission and refreshes the reminder after acknowledgement', async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const writes: Array<{ path: string; body: unknown; csrf: unknown }> = [];
  let reviewed = false;
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(String(options.body)), csrf: new Headers(options.headers).get('X-CSRF-Token') });
      await pending; reviewed = true;
      return Response.json({ executionId, outcome: 'acknowledged', checkedAt: '2026-10-16T00:00:00Z', reason: '本版本已核对，原始调用与未知上游结果继续保留。' });
    }
    return Response.json(path.endsWith('/model-balance') ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
      : { pending: reviewed ? [] : [record], nextBefore: null, totalCount: reviewed ? 0 : 1 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  fireEvent.click(screen.getByRole('button', { name: '核对这笔记录' }));
  const dialog = within(screen.getByRole('dialog', { name: '核对执行记录' }));
  const confirm = dialog.getByRole('button', { name: '确认已核对，归档本次提醒' });
  expect(confirm).toBeDisabled();
  fireEvent.change(dialog.getByRole('textbox', { name: '核对说明' }), { target: { value: '用户已停止，自带 Key，保留未知上游结果。' } });
  fireEvent.click(confirm);
  expect(confirm).toBeDisabled();
  expect(dialog.getByRole('button', { name: '关闭' })).toBeDisabled();
  fireEvent.click(confirm);
  await act(async () => finish());
  await dialog.findByText('本版本已核对，原始调用与未知上游结果继续保留。');
  expect(writes).toEqual([{ path: `/api/admin/agent-settlements/${executionId}/review`, csrf: 'csrf-fixture',
    body: { action: 'acknowledge_audit', expectedAttentionKey: record.attentionKey, note: '用户已停止，自带 Key，保留未知上游结果。' } }]);
  await waitFor(() => expect(screen.queryByText('1 笔记录待核对')).not.toBeInTheDocument());
});

it('rechecks cash evidence without offering audit acknowledgement or inventing a monetary amount', async () => {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      writes.push(JSON.parse(String(options.body)));
      return Response.json({ executionId, outcome: 'pending', checkedAt: '2026-10-16T00:00:00Z', attentionKey: 'b'.repeat(64), reason: '金额依据仍不完整，保留待核对；没有补零或估价入账。' });
    }
    return Response.json(path.endsWith('/model-balance') ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
      : { pending: [{ ...record, funding: 'cash', status: 'pending_evidence' }], nextBefore: null, totalCount: 1 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  fireEvent.click(screen.getByRole('button', { name: '核对这笔记录' }));
  const dialog = within(screen.getByRole('dialog', { name: '核对执行记录' }));
  expect(dialog.queryByRole('button', { name: '确认已核对，归档本次提醒' })).not.toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: '重新核对已有证据' }));
  await dialog.findByText('金额依据仍不完整，保留待核对；没有补零或估价入账。');
  expect(writes).toEqual([{ action: 'recheck', expectedAttentionKey: record.attentionKey }]);
  expect(screen.getByText('1 笔记录待核对')).toBeInTheDocument();
});

it('keeps the note and original record after a failed confirmation and permits retry', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') { attempts++; return new Response('{}', { status: 503 }); }
    return Response.json(path.endsWith('/model-balance') ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
      : { pending: [record], nextBefore: null, totalCount: 1 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  fireEvent.click(screen.getByRole('button', { name: '核对这笔记录' }));
  const dialog = within(screen.getByRole('dialog', { name: '核对执行记录' }));
  fireEvent.change(dialog.getByRole('textbox', { name: '核对说明' }), { target: { value: '已经核对的说明不会丢失。' } });
  fireEvent.click(dialog.getByRole('button', { name: '确认已核对，归档本次提醒' }));
  await dialog.findByRole('alert');
  expect(dialog.getByRole('textbox', { name: '核对说明' })).toHaveValue('已经核对的说明不会丢失。');
  await waitFor(() => expect(dialog.getByRole('button', { name: '确认已核对，归档本次提醒' })).toBeEnabled());
  fireEvent.click(dialog.getByRole('button', { name: '确认已核对，归档本次提醒' }));
  await waitFor(() => expect(attempts).toBe(2));
});

it('uses the refreshed evidence version when acknowledging after a recheck', async () => {
  const writes: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const input = JSON.parse(String(options.body)); writes.push(input);
      return Response.json({ executionId, outcome: input.action === 'recheck' ? 'pending' : 'acknowledged', attentionKey: 'b'.repeat(64), checkedAt: '2026-10-16T00:00:00Z', reason: '原始记录继续保留。' });
    }
    return Response.json(path.endsWith('/model-balance') ? { status: 'disabled', availableBalanceUsd: null, checkedAt: '2026-10-16T00:00:00Z' }
      : { pending: [record], nextBefore: null, totalCount: 1 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAttention accountId="admin" csrfToken="csrf-fixture" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '查看待核对记录' }));
  fireEvent.click(screen.getByRole('button', { name: '核对这笔记录' }));
  const dialog = within(screen.getByRole('dialog', { name: '核对执行记录' }));
  fireEvent.click(dialog.getByRole('button', { name: '重新核对已有证据' }));
  await dialog.findByText('原始记录继续保留。');
  await waitFor(() => expect(dialog.getByRole('textbox', { name: '核对说明' })).toBeEnabled());
  fireEvent.change(dialog.getByRole('textbox', { name: '核对说明' }), { target: { value: '核对更新后的记录。' } });
  fireEvent.click(dialog.getByRole('button', { name: '确认已核对，归档本次提醒' }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1].expectedAttentionKey).toBe('b'.repeat(64));
});
