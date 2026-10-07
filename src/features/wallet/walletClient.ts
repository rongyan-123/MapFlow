import { IdentityApiError } from '../identity/identityClient';
import type { UserModelSetting } from '../tree-generation/types';

export type PaymentChannel = 'wechat' | 'alipay';
export interface PaymentDisplay { windowId: string | null; status: 'waiting' | 'active' | 'expired' | 'cancelled' | 'finished'; serverNow: string; expiresAt: string | null; position: number; imageUrl: string | null }
export async function updatePaymentDisplay(id: string, input: { action: 'join' | 'poll' | 'leave'; windowId?: string }, csrfToken: string): Promise<PaymentDisplay> {
  const reply = asRecord(await request(`/api/wallet/topups/${encodeURIComponent(id)}/display`, { ...post(csrfToken, input), signal: AbortSignal.timeout(5000), keepalive: input.action === 'leave' }));
  if (!reply || !['waiting', 'active', 'expired', 'cancelled', 'finished'].includes(String(reply.status))
    || !(reply.windowId === null || typeof reply.windowId === 'string')
    || typeof reply.serverNow !== 'string' || !Number.isFinite(Date.parse(reply.serverNow))
    || !Number.isSafeInteger(reply.position) || Number(reply.position) < 0
    || !(reply.expiresAt === null || typeof reply.expiresAt === 'string' && Number.isFinite(Date.parse(reply.expiresAt)))
    || !(reply.imageUrl === null || typeof reply.imageUrl === 'string')) return invalid();
  if (reply.status === 'active' && (typeof reply.windowId !== 'string' || typeof reply.expiresAt !== 'string'
    || reply.imageUrl !== `/api/wallet/topups/${encodeURIComponent(id)}/display/${encodeURIComponent(reply.windowId)}/qr`
    || Date.parse(reply.expiresAt) <= Date.parse(reply.serverNow)
    || Date.parse(reply.expiresAt) - Date.parse(reply.serverNow) > 20000)) return invalid();
  if (reply.status !== 'active' && reply.imageUrl !== null) return invalid();
  return reply as unknown as PaymentDisplay;
}
export type TopupStatus = 'awaiting_payment' | 'awaiting_review' | 'closed_unpaid' | 'credited' | 'rejected' | 'reversed';
export interface Channel { channel: PaymentChannel; label: string; qrCodeId: string; imageUrl: string }
export interface Topup { topupId: string; accountId: string; amountFen: number; paymentAmountFen?: number | null; paymentExpiresAt?: string | null; channel: PaymentChannel; status: TopupStatus; qrCodeId: string; qrImageUrl: string; createdAt: string; updatedAt: string; reviewNote: string | null; username?: string; playerId?: string }
export interface LedgerEntry {
  entryId: string;
  accountId: string;
  username: string;
  playerId: string;
  actorUsername: string | null;
  kind: 'welcome' | 'topup' | 'adjustment' | 'reversal' | 'usage';
  note: string;
  amountMicros: number;
  balanceAfterMicros: number;
  topupId: string | null;
  reversalOf: string | null;
  reversed: boolean;
  createdAt: string;
}
export interface WalletAccount { accountId: string; username: string; playerId: string; status: string; balanceMicros: number }
export interface WalletAdjustment { requestId: string; amountFen: number; note: string; password: string }
export interface Wallet { balanceMicros: number; currency: 'CNY'; supportContact: string; qqGroup?: string; channels: Channel[]; topups: Topup[]; ledger: LedgerEntry[] }
export interface UpstreamBalance { status: 'available' | 'exhausted' | 'unavailable' | 'disabled'; availableBalanceUsd: string | null; checkedAt: string }
export async function readUpstreamBalance(): Promise<UpstreamBalance> {
  const balance = asRecord(await request('/api/admin/model-balance', { ...get, signal: AbortSignal.timeout(10_000) }));
  if (!balance || !['available', 'exhausted', 'unavailable', 'disabled'].includes(String(balance.status))
    || !(balance.availableBalanceUsd === null || typeof balance.availableBalanceUsd === 'string' && /^-?\d+(?:\.\d+)?$/u.test(balance.availableBalanceUsd))
    || typeof balance.checkedAt !== 'string' || !Number.isFinite(Date.parse(balance.checkedAt))) return invalid();
  return balance as unknown as UpstreamBalance;
}
export async function readCommunitySettings(): Promise<{ qqGroup: string }> {
  const settings = asRecord(await request('/api/admin/wallet/settings'));
  if (!settings || typeof settings.qqGroup !== 'string') return invalid();
  return { qqGroup: settings.qqGroup };
}
export async function saveCommunitySettings(qqGroup: string, csrfToken: string): Promise<{ qqGroup: string }> {
  const settings = asRecord(await request('/api/admin/wallet/settings', post(csrfToken, { qqGroup })));
  if (!settings || typeof settings.qqGroup !== 'string') return invalid();
  return { qqGroup: settings.qqGroup };
}
export interface PricingChannel { vendor:string; lane:number; enabled:boolean; inputMicrosPerMillion:number; cacheHitInputMicrosPerMillion?:number|null; outputMicrosPerMillion:number; statsSource:'live'|'estimated'|'unknown'; successRate24h:number|null; avgResponseSeconds:number|null }
export interface ModelPriceSnapshot {channels:PricingChannel[];maxInputMicrosPerMillion:number;maxOutputMicrosPerMillion:number;updatedAt:string;basis:'upstream_actual_x2'}
export interface PricingModel { id: string; provider: string; contextWindow: number; settings: UserModelSetting[]; vendorCodes: string[]; availability: 'byok'|'wallet'; pricing: ModelPriceSnapshot|null }
export interface ModelPricing { multiplierLabel: string; currency: 'CNY'; updatedAt: string; models: PricingModel[] }

export function formatAmountMicros(micros: number): string { return (micros / 1_000_000).toFixed(6).replace(/0+$/u, '').replace(/\.$/u, ''); }
export function formatFen(fen: number): string { return (fen / 100).toFixed(2); }
export function parseAmountFen(input: string): number | null {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/u.test(input)) return null;
  const [yuan, decimals = ''] = input.split('.');
  const fen = Number(yuan) * 100 + Number(decimals.padEnd(2, '0'));
  return fen >= 1 && fen <= 1_000_000 ? fen : null;
}
const get = { credentials: 'same-origin' as const, cache: 'no-store' as const, headers: { Accept: 'application/json' } };
function post(csrfToken: string, body: object): RequestInit { return { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) }; }
async function request(path: string, init: RequestInit = get): Promise<unknown> {
  let response: Response;
  try { response = await fetch(path, init); } catch { throw new IdentityApiError(0, 'wallet.network_unavailable', '额度服务暂时无法连接，请重试。'); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new IdentityApiError(response.status, 'wallet.invalid_response', '额度服务返回了无法识别的结果。'); }
  if (!response.ok) {
    const error = asRecord(asRecord(payload)?.error);
    throw new IdentityApiError(response.status, typeof error?.code === 'string' ? error.code : 'wallet.request_failed', typeof error?.message === 'string' ? error.message : '额度请求失败，请重试。');
  }
  return payload;
}
function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function invalid(): never { throw new IdentityApiError(502, 'wallet.invalid_response', '额度服务返回了无法识别的结果。'); }
function isChannel(value: unknown): value is Channel { const item = asRecord(value); return !!item && (item.channel === 'wechat' || item.channel === 'alipay') && typeof item.label === 'string' && typeof item.qrCodeId === 'string' && typeof item.imageUrl === 'string'; }
function isTopup(value: unknown): value is Topup {
  const item = asRecord(value);
  if (!item) return false;
  const hasReservation = item.paymentAmountFen !== undefined && item.paymentAmountFen !== null;
  if (hasReservation && (!Number.isSafeInteger(item.paymentAmountFen) || Number(item.paymentAmountFen) < 1 || Number(item.paymentAmountFen) > 1_000_000
    || typeof item.paymentExpiresAt !== 'string' || !Number.isFinite(Date.parse(item.paymentExpiresAt)))) return false;
  if (!hasReservation && item.paymentExpiresAt !== undefined && item.paymentExpiresAt !== null) return false;
  return typeof item.topupId === 'string' && typeof item.accountId === 'string' && Number.isSafeInteger(item.amountFen)
    && (item.channel === 'wechat' || item.channel === 'alipay')
    && ['awaiting_payment', 'awaiting_review', 'closed_unpaid', 'credited', 'rejected', 'reversed'].includes(String(item.status))
    && typeof item.qrCodeId === 'string' && typeof item.qrImageUrl === 'string' && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string' && (item.reviewNote === null || typeof item.reviewNote === 'string');
}
function isLedger(value: unknown): value is LedgerEntry {
  const item = asRecord(value);
  return !!item && typeof item.entryId === 'string' && typeof item.accountId === 'string'
    && typeof item.username === 'string' && typeof item.playerId === 'string'
    && (item.actorUsername === null || typeof item.actorUsername === 'string')
    && ['welcome', 'topup', 'adjustment', 'reversal','usage'].includes(String(item.kind))
    && typeof item.note === 'string' && Number.isSafeInteger(item.amountMicros)
    && Number.isSafeInteger(item.balanceAfterMicros)
    && (item.topupId === null || typeof item.topupId === 'string')
    && (item.reversalOf === null || typeof item.reversalOf === 'string')
    && typeof item.reversed === 'boolean' && typeof item.createdAt === 'string';
}
function isWalletAccount(value: unknown): value is WalletAccount {
  const item = asRecord(value);
  return !!item && typeof item.accountId === 'string' && typeof item.username === 'string'
    && typeof item.playerId === 'string' && typeof item.status === 'string' && Number.isSafeInteger(item.balanceMicros);
}
function topup(value: unknown): Topup { return isTopup(value) ? value : invalid(); }
export async function readWallet(): Promise<Wallet> { const value = asRecord(await request('/api/wallet')); if (!value || !Number.isSafeInteger(value.balanceMicros) || value.currency !== 'CNY' || typeof value.supportContact !== 'string' || !Array.isArray(value.channels) || !value.channels.every(isChannel) || !Array.isArray(value.topups) || !value.topups.every(isTopup) || !Array.isArray(value.ledger) || !value.ledger.every(isLedger)) return invalid(); return value as unknown as Wallet; }
export async function createTopup(input: { requestId: string; amountFen: number; channel: PaymentChannel }, csrfToken: string): Promise<Topup> { return topup(await request('/api/wallet/topups', post(csrfToken, input))); }
export async function declarePaid(id: string, csrfToken: string): Promise<Topup> { return topup(await request(`/api/wallet/topups/${encodeURIComponent(id)}/declare-paid`, post(csrfToken, {}))); }
export async function declareUnpaid(id: string, csrfToken: string): Promise<Topup> { return topup(await request(`/api/wallet/topups/${encodeURIComponent(id)}/declare-unpaid`, post(csrfToken, {}))); }
export async function readAdminTopups(status?: TopupStatus): Promise<{ topups: Topup[]; pendingCount: number }> { const value = asRecord(await request(`/api/admin/wallet/topups${status ? `?status=${status}` : ''}`)); if (!value || !Array.isArray(value.topups) || !value.topups.every(isTopup) || !Number.isSafeInteger(value.pendingCount)) return invalid(); return value as unknown as { topups: Topup[]; pendingCount: number }; }
export async function approveTopup(id: string, input: { password: string; note?: string; receiptReference?: string }, csrfToken: string): Promise<Topup> { return topup(await request(`/api/admin/wallet/topups/${encodeURIComponent(id)}/approve`, post(csrfToken, input))); }
export async function rejectTopup(id: string, note: string, csrfToken: string): Promise<Topup> { return topup(await request(`/api/admin/wallet/topups/${encodeURIComponent(id)}/reject`, post(csrfToken, { note }))); }
export async function readAdminWalletAccounts(search: string): Promise<{ accounts: WalletAccount[] }> {
  const payload = asRecord(await request(`/api/admin/wallet/accounts?search=${encodeURIComponent(search)}`));
  if (!payload || !Array.isArray(payload.accounts) || !payload.accounts.every(isWalletAccount)) return invalid();
  return { accounts: payload.accounts };
}
export async function readAdminWalletLedger(search: string, offset = 0): Promise<{ entries: LedgerEntry[]; hasMore: boolean }> {
  const payload = asRecord(await request(`/api/admin/wallet/ledger?search=${encodeURIComponent(search)}&offset=${offset}`));
  if (!payload || !Array.isArray(payload.entries) || !payload.entries.every(isLedger) || typeof payload.hasMore !== 'boolean') return invalid();
  return { entries: payload.entries, hasMore: payload.hasMore };
}
export async function adjustWallet(accountId: string, input: WalletAdjustment, csrfToken: string): Promise<LedgerEntry> {
  const entry = await request(`/api/admin/wallet/accounts/${encodeURIComponent(accountId)}/adjust`, post(csrfToken, input));
  return isLedger(entry) ? entry : invalid();
}
export async function reverseWalletEntry(entryId: string, input: { note: string; password: string }, csrfToken: string): Promise<LedgerEntry> {
  const entry = await request(`/api/admin/wallet/ledger/${encodeURIComponent(entryId)}/reverse`, post(csrfToken, input));
  return isLedger(entry) ? entry : invalid();
}
export async function readAdminChannels(): Promise<Channel[]> { const value = asRecord(await request('/api/admin/wallet/payment-channels')); if (!value || !Array.isArray(value.channels) || !value.channels.every(isChannel)) return invalid(); return value.channels; }
export async function uploadChannel(channel: PaymentChannel, file: File, csrfToken: string): Promise<Channel> { const form = new FormData(); form.set('file', file); const value = await request(`/api/admin/wallet/payment-channels/${channel}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken }, body: form }); return isChannel(value) ? value : invalid(); }
function validMicros(value:unknown):boolean {return typeof value==='number' && Number.isSafeInteger(value) && value>=0;}
function isModelPrice(value:unknown):boolean {
  if (value===null) return true;
  const price=asRecord(value);
  return !!price && price.basis==='upstream_actual_x2' && typeof price.updatedAt==='string' && Number.isFinite(Date.parse(price.updatedAt))
    && validMicros(price.maxInputMicrosPerMillion) && validMicros(price.maxOutputMicrosPerMillion)
    && Array.isArray(price.channels) && price.channels.every(channel=> {
      const item=asRecord(channel);
      return !!item && typeof item.vendor==='string' && Number.isSafeInteger(item.lane) && typeof item.enabled==='boolean'
        && validMicros(item.inputMicrosPerMillion) && validMicros(item.outputMicrosPerMillion) && ['live','estimated','unknown'].includes(String(item.statsSource))
        && (item.cacheHitInputMicrosPerMillion === undefined || item.cacheHitInputMicrosPerMillion === null || validMicros(item.cacheHitInputMicrosPerMillion))
        && (item.successRate24h===null || typeof item.successRate24h==='number' && Number.isFinite(item.successRate24h) && item.successRate24h>=0 && item.successRate24h<=100)
        && (item.avgResponseSeconds===null || typeof item.avgResponseSeconds==='number' && Number.isFinite(item.avgResponseSeconds) && item.avgResponseSeconds>=0);
    });
}
export async function readModelPricing(): Promise<ModelPricing> {
  const value=asRecord(await request('/api/model-catalog/pricing'));
  if (!value || typeof value.multiplierLabel!=='string' || value.currency!=='CNY' || typeof value.updatedAt!=='string'
    || !Array.isArray(value.models) || !value.models.every(model=>{
      const item=asRecord(model);
      return item && typeof item.id==='string' && typeof item.provider==='string' && Number.isSafeInteger(item.contextWindow)
        && Array.isArray(item.vendorCodes) && item.vendorCodes.every((code:unknown)=>typeof code==='string')
        && ['byok','wallet'].includes(String(item.availability)) && isModelPrice(item.pricing)
        && Array.isArray(item.settings) && item.settings.every((setting:unknown)=> {
          const option=asRecord(setting);return option && typeof option.name==='string' && ['switch','select'].includes(String(option.kind))
            && Array.isArray(option.options) && option.options.every((name:unknown)=>typeof name==='string');
        });
    })) return invalid();
  return value as unknown as ModelPricing;
}
