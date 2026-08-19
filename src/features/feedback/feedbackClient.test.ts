import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitFeedback } from './feedbackClient';
import { IdentityApiError } from '../identity/identityClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('feedbackClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submits feedback with CSRF and returns nothing on 201', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(201, {})),
    );

    await expect(submitFeedback('很好用', 'csrf-1')).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ content: '很好用' });
  });

  it('surfaces a rejected feedback response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          error: { code: 'request.invalid', message: '请求格式无效。', traceId: 't' },
        }),
      ),
    );

    await expect(submitFeedback('x', 'csrf-2')).rejects.toThrow(IdentityApiError);
  });
});
