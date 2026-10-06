import { afterEach, expect, it, vi } from 'vitest';
import { adjustWallet, approveTopup, createTopup, parseAmountFen, readAdminWalletAccounts, readAdminWalletLedger, readWallet, reverseWalletEntry, uploadChannel, updatePaymentDisplay } from './walletClient';

const topup = { topupId: 'order-1', accountId: 'a', amountFen: 100, channel: 'wechat', status: 'awaiting_payment', qrCodeId: 'qr-1', qrImageUrl: '/api/wallet/qrcodes/qr-1', createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', reviewNote: null };
afterEach(() => vi.unstubAllGlobals());
it('authenticates queue changes and refuses an invalid or foreign QR grant', async () => {
  const grant = { windowId: 'window', status: 'active', serverNow: '2026-10-06T00:00:00Z', expiresAt: '2026-10-06T00:00:20Z', position: 0, imageUrl: '/api/wallet/topups/order/display/window/qr' };
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify(grant)));
  vi.stubGlobal('fetch',fetchMock);
  expect(await updatePaymentDisplay('order',{ action:'join' },'csrf')).toEqual(grant);
  expect(fetchMock).toHaveBeenCalledWith('/api/wallet/topups/order/display',expect.objectContaining({method:'POST',credentials:'same-origin',cache:'no-store',headers:expect.objectContaining({'X-CSRF-Token':'csrf'})}));
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  for (const patch of [{ imageUrl:'https://other.test/qr' },{ status:'waiting' },{ expiresAt:'bad' },{ expiresAt:'2026-10-06T00:00:21Z' },{ position:-1 },{ serverNow:'bad' }]) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({...grant,...patch})));
    await expect(updatePaymentDisplay('order',{action:'poll',windowId:'window'},'csrf')).rejects.toMatchObject({code:'wallet.invalid_response'});
  }
});
it('rejects malformed reserved payment amounts rather than showing a misleading QR', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...topup, paymentAmountFen: -1, paymentExpiresAt: 'bad-date' }))));
  await expect(createTopup({ requestId: 'request-1', amountFen: 100, channel: 'wechat' }, 'csrf')).rejects.toMatchObject({ code: 'wallet.invalid_response' });
});
it('uses integer fen, same-origin cookies and CSRF for creation and approval', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(topup))));
  vi.stubGlobal('fetch', fetchMock);
  expect(parseAmountFen('10.25')).toBe(1025);
  expect(parseAmountFen('10000.01')).toBeNull();
  await createTopup({ requestId: 'request-1', amountFen: 1025, channel: 'wechat' }, 'csrf');
  await approveTopup('order-1', { password: 'admin-password' }, 'csrf');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ requestId: 'request-1', amountFen: 1025, channel: 'wechat' });
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'X-CSRF-Token': 'csrf' } });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ password: 'admin-password' });
});

it('reads account search and signed ledger pages and authenticates adjustment and reversal requests', async () => {
  const account = { accountId: 'account-a', username: 'alice', playerId: 'player-a', status: 'active', balanceMicros: 3_000_000 };
  const entry = { entryId: 'entry-a', accountId: 'account-a', username: 'alice', playerId: 'player-a', actorUsername: 'admin', note: '修正额度', kind: 'adjustment', amountMicros: -2_000_000, balanceAfterMicros: 1_000_000, topupId: null, reversalOf: null, reversed: false, createdAt: '2026-10-01T00:00:00Z' };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ accounts: [account] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [entry], hasMore: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify(entry)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...entry, entryId: 'reverse-a', kind: 'reversal', amountMicros: 2_000_000, balanceAfterMicros: 3_000_000, reversalOf: 'entry-a' })));
  vi.stubGlobal('fetch', fetchMock);
  expect(await readAdminWalletAccounts('alice & bob')).toEqual({ accounts: [account] });
  expect(await readAdminWalletLedger('alice', 50)).toEqual({ entries: [entry], hasMore: true });
  expect(await adjustWallet('account-a', { requestId: 'request-a', amountFen: -200, note: '修正额度', password: 'admin-password' }, 'csrf')).toEqual(entry);
  expect(await reverseWalletEntry('entry-a', { note: '撤销误操作', password: 'admin-password' }, 'csrf')).toMatchObject({ kind: 'reversal', reversalOf: 'entry-a' });
  expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/wallet/accounts?search=alice%20%26%20bob');
  expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/wallet/ledger?search=alice&offset=50');
  expect(fetchMock.mock.calls[2][0]).toBe('/api/admin/wallet/accounts/account-a/adjust');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ requestId: 'request-a', amountFen: -200, note: '修正额度', password: 'admin-password' });
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', headers: { 'X-CSRF-Token': 'csrf' } });
});
it('sends raw multipart data for QR replacement and relays server error details', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ channel: 'wechat', label: '微信', qrCodeId: 'qr-2', imageUrl: '/api/wallet/qrcodes/qr-2' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'wallet.storage_unavailable', message: '存储不可用' } }), { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  const file = new File(['image'], 'wechat.png', { type: 'image/png' });
  await uploadChannel('wechat', file, 'csrf');
  expect(fetchMock.mock.calls[0][1].body.get('file')).toBe(file);
  expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  await expect(readWallet()).rejects.toMatchObject({ status: 503, code: 'wallet.storage_unavailable', message: '存储不可用' });
});
