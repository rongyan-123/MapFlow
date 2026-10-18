import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWorldOperation } from './operations';
import { ewAccepted } from './testFixtures';

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it('restores the original operation after a lost response, requires a Key again and never resends on mount', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(Response.json(ewAccepted));
  vi.stubGlobal('fetch', fetch);
  const first = renderHook(() => useWorldOperation('account-a', 'create', 'csrf'));
  await act(async () => { await first.result.current.perform('/worlds', { topic: 'A museum mystery', difficulty: 'intermediate', targetWordCount: 8, funding: 'byok', modelAccess: { apiKey: 'private-key-one', baseUrl: 'https://models.example/v1', model: 'original-model', contextWindow: 128000, reasoningProtocol: 'none', reasoningSupported: false } }, 'accepted'); });
  expect(fetch).toHaveBeenCalledOnce();
  const original = JSON.parse(String(fetch.mock.calls[0][1].body));
  expect(original.clientActionId).toMatch(/^[a-f0-9-]{36}$/i);
  expect(JSON.stringify(sessionStorage)).not.toContain('private-key-one');
  expect(first.result.current.pending).not.toBeNull();
  first.unmount();
  const restored = renderHook(() => useWorldOperation('account-a', 'create', 'csrf'));
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { await restored.result.current.replay(); });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(restored.result.current.error?.message).toContain('API Key');
  await act(async () => { await restored.result.current.replay('private-key-two'); });
  const retried = JSON.parse(String(fetch.mock.calls[1][1].body));
  expect(retried).toEqual({ ...original, modelAccess: { ...original.modelAccess, apiKey: 'private-key-two' } });
  expect(restored.result.current.pending).toBeNull();
  expect(restored.result.current.result).toEqual(ewAccepted);
  expect(JSON.stringify(sessionStorage)).not.toMatch(/private-key/);
  const other = renderHook(() => useWorldOperation('account-b', 'create', 'csrf'));
  expect(other.result.current.pending).toBeNull();
});

it('does not deliver a late acceptance into a page that has left its branch', async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(resolve => { release = resolve; })));
  const original = renderHook(() => useWorldOperation('account-a', 'play.old-branch', 'csrf'));
  let result: unknown = 'waiting';
  let request!: Promise<unknown>;
  act(() => { request = original.result.current.perform('/worlds', { topic: 'A mystery', funding: 'points' }, 'accepted').then(value => { result = value; }); });
  original.unmount();
  const next = renderHook(() => useWorldOperation('account-a', 'play.new-branch', 'csrf'));
  await act(async () => { release(Response.json(ewAccepted)); await request; });
  expect(result).toBeNull();
  expect(next.result.current.result).toBeNull();
  expect(next.result.current.pending).toBeNull();
});
