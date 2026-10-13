import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTeachingCanvas } from './useTeachingCanvas';
import { QueryClient } from '@tanstack/react-query';
const api = vi.hoisted(() => ({ fetchTeachingCanvas: vi.fn(), saveTeachingCanvas: vi.fn() }));
vi.mock('./tavernClient', () => api);
beforeEach(() => {
  api.fetchTeachingCanvas.mockResolvedValue({ revision: 0, enabled: false, elements: [{ id: 'saved' }] });
  api.saveTeachingCanvas.mockResolvedValue({ revision: 1, enabled: false, elements: [] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

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
