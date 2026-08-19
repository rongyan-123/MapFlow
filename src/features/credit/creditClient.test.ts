import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCreditSummary, signInForCredit } from './creditClient';
import { IdentityApiError } from '../identity/identityClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('creditClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses the credit summary response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          balance: 4,
          signedInToday: false,
          freeRemaining: 3,
          pricePerTree: 3,
        }),
      ),
    );

    const summary = await readCreditSummary();

    expect(summary).toEqual({
      balance: 4,
      signedInToday: false,
      freeRemaining: 3,
      pricePerTree: 3,
    });
    expect(fetch).toHaveBeenCalledWith('/api/credit/me', expect.anything());
  });

  it('rejects a malformed credit summary response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { balance: 'nope' })),
    );

    await expect(readCreditSummary()).rejects.toThrow(IdentityApiError);
  });

  it('sends the CSRF token when signing in and parses the result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { balance: 7, awarded: 3 })),
    );

    const result = await signInForCredit('csrf-123');

    expect(result).toEqual({ balance: 7, awarded: 3 });
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/credit/signin');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-123' });
  });
});
