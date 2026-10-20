import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTeachingCanvas } from './useTeachingCanvas';
import { QueryClient } from '@tanstack/react-query';
const api = vi.hoisted(() => ({ fetchTeachingCanvas: vi.fn(), saveTeachingCanvas: vi.fn() }));
vi.mock('../../api/tavernClient', () => api);
beforeEach(() => {
  api.fetchTeachingCanvas.mockResolvedValue({ revision: 0, enabled: false, elements: [{ id: 'saved' }] });
  api.saveTeachingCanvas.mockResolvedValue({ revision: 1, enabled: false, elements: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

it('opens immediately while loading and keeps the last close when the read arrives late', async () => {
  let finishRead!: (value: { revision: number; enabled: boolean; elements: [] }) => void;
  api.fetchTeachingCanvas.mockImplementation(() => new Promise(resolve => { finishRead = resolve; }));
  const view = renderHook(() => useTeachingCanvas('last-close', 'csrf', 1, undefined, { initiallyOpen: false }));
  let opening!: Promise<void>;
  act(() => { opening = view.result.current.show(); });
  const visibleWhileLoading = view.result.current.open;
  act(() => view.result.current.setOpen(false));
  await act(async () => { finishRead({ revision: 0, enabled: false, elements: [] }); await opening; });
  expect(visibleWhileLoading).toBe(true);
  expect(view.result.current.open).toBe(false);
});

it('keeps a failed save and its draft visible after closing and reopening, until retry succeeds', async () => {
  const saved = { revision: 3, enabled: true, elements: [{ id: 'saved' }] };
  const draft = [{ id: 'offline-draft' }];
  const failure = new Error('offline');
  api.fetchTeachingCanvas.mockResolvedValue(saved);
  api.saveTeachingCanvas.mockRejectedValueOnce(failure);
  const view = renderHook(() => useTeachingCanvas('retry-visible', 'csrf', 1, saved));
  await act(async () => {});
  await act(() => view.result.current.save(draft));
  expect(view.result.current.error).toBe(failure);
  act(() => view.result.current.setOpen(false));
  await act(() => view.result.current.show());
  expect(view.result.current.document?.elements).toEqual(draft);
  expect(view.result.current.dirty).toBe(true);
  expect(view.result.current.error).toBe(failure);
  api.saveTeachingCanvas.mockResolvedValue({ ...saved, revision: 4, elements: draft });
  await act(() => view.result.current.flush());
  expect(view.result.current.error).toBeNull();
  expect(view.result.current.dirty).toBe(false);
  expect(view.result.current.document).toEqual({ ...saved, revision: 4, elements: draft });
});

it('retries a failed drawing permission save instead of forgetting the requested setting', async () => {
  const initial = { revision: 0, enabled: true, elements: [{ id: 'saved' }] };
  api.fetchTeachingCanvas.mockResolvedValue(initial);
  api.saveTeachingCanvas.mockRejectedValueOnce(new Error('offline'));
  const view = renderHook(() => useTeachingCanvas('permission-retry', 'csrf', 1, initial));
  await act(async () => {});
  await act(() => view.result.current.save(undefined, false));
  expect(view.result.current.error).toBeInstanceOf(Error);
  expect(view.result.current.dirty).toBe(true);
  api.saveTeachingCanvas.mockResolvedValue({ ...initial, revision: 1, enabled: false });
  await act(() => view.result.current.flush());
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(2);
  expect(api.saveTeachingCanvas).toHaveBeenLastCalledWith('permission-retry', { ...initial, enabled: false }, 'csrf', undefined);
  expect(view.result.current.document?.enabled).toBe(false);
  expect(view.result.current.error).toBeNull();
  expect(view.result.current.dirty).toBe(false);
});

it('retries a failed read from the server even when an older canvas is already loaded', async () => {
  const saved = { revision: 3, enabled: true, elements: [{ id: 'saved' }] };
  api.fetchTeachingCanvas.mockRejectedValueOnce(new Error('read offline'));
  const view = renderHook(() => useTeachingCanvas('read-retry', 'csrf', 1, saved));
  await act(async () => {});
  expect(view.result.current.errorKind).toBe('read');
  api.fetchTeachingCanvas.mockResolvedValue({ ...saved, revision: 4, elements: [{ id: 'latest' }] });
  await act(() => view.result.current.reload());
  expect(view.result.current.document?.revision).toBe(4);
  expect(view.result.current.document?.elements).toEqual([{ id: 'latest' }]);
  expect(view.result.current.error).toBeNull();
});

it('keeps the last open and the edited draft when earlier reads arrive out of order', async () => {
  const reads: Array<(value: { revision: number; enabled: boolean; elements: { id: string }[] }) => void> = [];
  api.fetchTeachingCanvas.mockImplementation(() => new Promise(resolve => reads.push(resolve)));
  const view = renderHook(() => useTeachingCanvas('out-of-order', 'csrf', 1, undefined, { initiallyOpen: false }));
  let first!: Promise<void>; let second!: Promise<void>;
  act(() => { first = view.result.current.show(); });
  act(() => view.result.current.setOpen(false));
  act(() => { second = view.result.current.show(); });
  await act(async () => { reads[1]({ revision: 2, enabled: true, elements: [{ id: 'newer' }] }); await second; });
  act(() => view.result.current.queue([{ id: 'edited-newer' }]));
  await act(async () => { reads[0]({ revision: 1, enabled: true, elements: [{ id: 'older' }] }); await first; });
  expect(view.result.current.open).toBe(true);
  expect(view.result.current.document?.elements).toEqual([{ id: 'edited-newer' }]);
  expect(view.result.current.dirty).toBe(true);
});

it('does not open or change a new account canvas after an old unmounted request returns', async () => {
  let finishOld!: (value: { revision: number; enabled: boolean; elements: { id: string }[] }) => void;
  api.fetchTeachingCanvas.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const client = new QueryClient();
  const old = renderHook(() => useTeachingCanvas('same-story', 'old-csrf', 1, undefined, { queryClient: client, accountId: 'old-owner', initiallyOpen: false }));
  let opening!: Promise<void>;
  act(() => { opening = old.result.current.show(); });
  old.unmount();
  const initial = { revision: 4, enabled: true, elements: [{ id: 'new-owner-content' }] };
  api.fetchTeachingCanvas.mockResolvedValue(initial);
  const next = renderHook(() => useTeachingCanvas('same-story', 'new-csrf', 1, initial, { queryClient: client, accountId: 'new-owner', initiallyOpen: false }));
  await act(async () => { finishOld({ revision: 0, enabled: true, elements: [{ id: 'old-owner-content' }] }); await opening; });
  expect(next.result.current.open).toBe(false);
  expect(next.result.current.document?.elements).toEqual(initial.elements);
});

it('serializes repeated save retries and writes the latest drawing edited during a save', async () => {
  const saved = { revision: 0, enabled: true, elements: [{ id: 'saved' }] };
  const writes: Array<(value: typeof saved) => void> = [];
  api.fetchTeachingCanvas.mockResolvedValue(saved);
  api.saveTeachingCanvas.mockImplementation(() => new Promise(resolve => writes.push(resolve)));
  const view = renderHook(() => useTeachingCanvas('serial-retry', 'csrf', 1, saved));
  await act(async () => {});
  let first!: Promise<void>; let retry!: Promise<void>;
  act(() => { first = view.result.current.save([{ id: 'first' }]); });
  act(() => view.result.current.queue([{ id: 'latest' }]));
  act(() => { retry = view.result.current.flush(); });
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(1);
  await act(async () => { writes[0]({ ...saved, revision: 1, elements: [{ id: 'first' }] }); });
  expect(view.result.current.document?.elements).toEqual([{ id: 'latest' }]);
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(2);
  await act(async () => { writes[1]({ ...saved, revision: 2, elements: [{ id: 'latest' }] }); await first; await retry; });
  expect(view.result.current.document?.elements).toEqual([{ id: 'latest' }]);
  expect(view.result.current.dirty).toBe(false);
});

it('opening a canvas preserves disabled drawing permission until explicit consent', async () => {
  api.fetchTeachingCanvas.mockResolvedValue({ revision: 0, enabled: false, elements: [] });
  api.saveTeachingCanvas.mockResolvedValue({ revision: 1, enabled: true, elements: [] });
  const view = renderHook(() => useTeachingCanvas('conversation', 'csrf', 1, undefined, { readOnly: false, initiallyOpen: false }));
  await act(() => view.result.current.show());
  expect(view.result.current.open).toBe(true);
  expect(view.result.current.document?.enabled).toBe(false);
  expect(api.saveTeachingCanvas).not.toHaveBeenCalled();
  await act(() => view.result.current.save(undefined, true));
  expect(api.saveTeachingCanvas).toHaveBeenCalledWith('conversation', { revision: 0, enabled: true, elements: [] }, 'csrf', undefined);
  expect(view.result.current.document?.enabled).toBe(true);
});

it('freezes editing and flushes an 800 ms queued draft before deletion can proceed', async () => {
  vi.useFakeTimers();
  const initial = { revision: 0, enabled: false, elements: [{ id: 'saved' }] };
  let completeSave!: (value: typeof initial) => void;
  api.saveTeachingCanvas.mockImplementation(() => new Promise(resolve => { completeSave = resolve; }));
  const view = renderHook(() => useTeachingCanvas('queued', 'csrf', 1, initial));
  await act(async () => {});
  expect(view.result.current).toHaveProperty('prepareDeletion', expect.any(Function));
  act(() => view.result.current.queue([{ id: 'draft' }]));
  expect(view.result.current.dirty).toBe(true);
  expect(api.saveTeachingCanvas).not.toHaveBeenCalled();
  let preparing!: Promise<void>;
  act(() => { preparing = view.result.current.prepareDeletion(); });
  expect(view.result.current.deletionPreparing).toBe(true);
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(1);
  act(() => view.result.current.queue([{ id: 'late-edit' }]));
  await act(async () => {
    completeSave({ revision: 1, enabled: false, elements: [{ id: 'draft' }] });
    await preparing;
  });
  expect(view.result.current.dirty).toBe(false);
  expect(view.result.current.document?.elements).toEqual([{ id: 'draft' }]);
  act(() => view.result.current.markDeleted());
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(1);
});

it('waits for an in-flight write and does not start a second save during deletion preparation', async () => {
  const initial = { revision: 0, enabled: false, elements: [{ id: 'saved' }] };
  let completeSave!: (value: typeof initial) => void;
  api.saveTeachingCanvas.mockImplementation(() => new Promise(resolve => { completeSave = resolve; }));
  const view = renderHook(() => useTeachingCanvas('writing', 'csrf', 1, initial));
  await act(async () => {});
  expect(view.result.current).toHaveProperty('prepareDeletion', expect.any(Function));
  let saving!: Promise<void>;
  act(() => { saving = view.result.current.save([{ id: 'new' }]); });
  let preparing!: Promise<void>;
  let ready = false;
  act(() => { preparing = view.result.current.prepareDeletion().then(() => { ready = true; }); });
  await act(async () => {});
  expect(ready).toBe(false);
  expect(api.saveTeachingCanvas).toHaveBeenCalledTimes(1);
  await act(async () => { completeSave({ revision: 1, enabled: false, elements: [{ id: 'new' }] }); await saving; await preparing; });
  expect(ready).toBe(true);
  act(() => view.result.current.cancelDeletion());
  expect(view.result.current.deletionPreparing).toBe(false);
});

it('keeps a failed draft and blocks deletion until a retry really saves it', async () => {
  const initial = { revision: 0, enabled: false, elements: [{ id: 'saved' }] };
  api.saveTeachingCanvas.mockRejectedValueOnce(new Error('save failed'));
  const view = renderHook(() => useTeachingCanvas('failed', 'csrf', 1, initial));
  await act(async () => {});
  expect(view.result.current).toHaveProperty('prepareDeletion', expect.any(Function));
  act(() => view.result.current.queue([{ id: 'unsaved' }]));
  await act(async () => { await expect(view.result.current.prepareDeletion()).rejects.toThrow('save failed'); });
  expect(view.result.current.dirty).toBe(true);
  expect(view.result.current.deletionPreparing).toBe(false);
  api.saveTeachingCanvas.mockResolvedValue({ revision: 1, enabled: false, elements: [{ id: 'unsaved' }] });
  await act(() => view.result.current.prepareDeletion());
  expect(api.saveTeachingCanvas).toHaveBeenLastCalledWith('failed', initial, 'csrf', [{ id: 'unsaved' }]);
  expect(view.result.current.dirty).toBe(false);
  act(() => view.result.current.markDeleted());
});

it('ordinary unmount still persists the pending draft', async () => {
  vi.useFakeTimers();
  const initial = { revision: 0, enabled: false, elements: [{ id: 'saved' }] };
  const view = renderHook(() => useTeachingCanvas('leave', 'csrf', 1, initial));
  await act(async () => {});
  act(() => view.result.current.queue([{ id: 'ordinary-draft' }]));
  view.unmount();
  await act(async () => {});
  expect(api.saveTeachingCanvas).toHaveBeenCalledWith('leave', initial, 'csrf', [{ id: 'ordinary-draft' }]);
});

it('restores a failed draft into the editor after leaving and preserves it through the next edit', async () => {
  const initial = { revision: 3, enabled: false, elements: [{ id: 'saved' }] };
  api.fetchTeachingCanvas.mockResolvedValue(initial);
  api.saveTeachingCanvas.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  const options = { queryClient: client, accountId: 'canvas-owner' };
  const first = renderHook(() => useTeachingCanvas('retained-draft', 'csrf', 1, initial, options));
  await act(async () => {});
  act(() => first.result.current.queue([{ id: 'unsaved' }]));
  first.unmount(); await act(async () => {});
  const returned = renderHook(() => useTeachingCanvas('retained-draft', 'csrf', 1, initial, options));
  await act(async () => {});
  expect(returned.result.current.dirty).toBe(true);
  expect(returned.result.current.document?.elements).toEqual([{ id: 'unsaved' }]);
  const nextEdit = [...returned.result.current.document!.elements, { id: 'another-shape' }];
  act(() => returned.result.current.queue(nextEdit));
  api.saveTeachingCanvas.mockResolvedValue({ ...initial, revision: 4, elements: nextEdit });
  await act(() => returned.result.current.prepareDeletion());
  expect(api.saveTeachingCanvas).toHaveBeenLastCalledWith('retained-draft', initial, 'csrf', nextEdit);
  expect(returned.result.current.document?.elements).toEqual(nextEdit);
});

it('does not authorize deletion when a dirty draft becomes read only', async () => {
  const initial = { revision: 1, enabled: false, elements: [{ id: 'saved' }] };
  let readOnly = false;
  const view = renderHook(() => useTeachingCanvas('lost-access', 'csrf', 1, initial, { readOnly }));
  await act(async () => {});
  act(() => view.result.current.queue([{ id: 'unsaved' }]));
  readOnly = true; view.rerender();
  await act(async () => { await expect(view.result.current.prepareDeletion()).rejects.toThrow(); });
  expect(view.result.current.dirty).toBe(true);
  expect(view.result.current.deletionPreparing).toBe(false);
  expect(api.saveTeachingCanvas).not.toHaveBeenCalled();
});
