import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTeachingCanvas } from './useTeachingCanvas';
const api = vi.hoisted(() => ({ fetchTeachingCanvas: vi.fn(), saveTeachingCanvas: vi.fn() }));
vi.mock('./tavernClient', () => api);
afterEach(() => { cleanup(); vi.resetAllMocks(); });

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
