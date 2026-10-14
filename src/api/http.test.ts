import { expect, it, vi } from 'vitest';
import { request, readFailure } from './http';

it('keeps session credentials when requesting a private endpoint', async () => {
  let outgoing: RequestInit | undefined;
  vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => { outgoing = init; return new Response('{}'); });
  const response = await request('/api/auth/session');
  expect(response.ok).toBe(true);
  expect(outgoing?.credentials).toBe('same-origin');
});

it('preserves a write identity and CSRF without adding a multipart content type', async () => {
  let outgoing: RequestInit | undefined;
  vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => { outgoing = init; return new Response('{}'); });
  const form = new FormData();
  form.append('title', '角色');
  const controller = new AbortController();
  await request('/api/me/tavern/characters', { method:'POST', signal:controller.signal, body:form, headers:{'X-CSRF-Token':'csrf','Idempotency-Key':'action-1'} });
  const headers = new Headers(outgoing?.headers);
  expect(headers.get('X-CSRF-Token')).toBe('csrf');
  expect(headers.get('Idempotency-Key')).toBe('action-1');
  expect(headers.has('Content-Type')).toBe(false);
  expect(outgoing?.signal).toBe(controller.signal);
  expect(outgoing?.body).toBe(form);
});

it('does not repeat a write when its network result is unknown', async () => {
  let submissions = 0;
  vi.stubGlobal('fetch', async () => { submissions++; throw new TypeError('network disconnected'); });
  await expect(request('/api/me/tavern/conversations', {method:'POST',body:'{}'})).rejects.toThrow('network disconnected');
  expect(submissions).toBe(1);
});

it('keeps a machine readable error while hiding raw server diagnostics', async () => {
  const response = new Response(JSON.stringify({ error:{code:'identity.csrf_rejected',message:'private diagnostic sk-secret',traceId:'request-1'} }), {status:403});
  const failure = await readFailure(response, 'request.failed');
  expect(failure).toMatchObject({status:403,code:'identity.csrf_rejected',traceId:'request-1',message:'请求验证失败，请刷新页面后重试。'});
  expect(failure.message).not.toContain('sk-secret');
});

it('turns a non JSON authentication error into a readable sign in action', async () => {
  const failure = await readFailure(new Response('<html>gateway</html>', {status:401}), 'identity.request_failed');
  expect(failure).toMatchObject({status:401,code:'identity.request_failed',message:'请重新登录后继续。'});
});
