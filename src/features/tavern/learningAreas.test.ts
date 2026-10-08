import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningArea, fetchLearningAreas } from './tavernClient';

const area = {
  areaId: 'personal-map-1', libraryEntryId: 'personal-map-1', title: 'Python 学习',
  available: true, createdAt: '2026-10-08T12:00:00Z',
};
afterEach(() => vi.unstubAllGlobals());
function reply(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('learning-area HTTP contract', () => {
  it('lists persisted areas with session credentials and abort support without opening a chat', async () => {
    const fetchMock = reply({ areas: [area, { ...area, areaId: 'archived', libraryEntryId: 'archived', available: false }] });
    const controller = new AbortController();
    expect(await fetchLearningAreas(controller.signal)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/me/learning-areas',
      expect.objectContaining({ credentials: 'same-origin', signal: controller.signal }));
  });

  it('explicitly creates membership with CSRF and encodes the map locator', async () => {
    const fetchMock = reply(area);
    expect(await createLearningArea('map/locator', 'csrf')).toEqual(area);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/me/learning-areas/map%2Flocator',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }) }));
  });

  it.each([null, { areas: null }, { areas: [null] },
    { areas: [{ ...area, available: 'true' }] },
    { areas: [{ ...area, libraryEntryId: 'another-map' }] },
    { areas: [{ ...area, title: '' }] },
    { areas: [{ ...area, createdAt: 'not-a-date' }] },
  ])('rejects malformed membership data %j', async body => {
    reply(body);
    await expect(fetchLearningAreas()).rejects.toThrow();
  });

  it('retains the authenticated failure trace without inventing an area', async () => {
    reply({ error: { code: 'unauthorized', message: '请先登录。', traceId: 'area-auth-trace' } }, 401);
    await expect(fetchLearningAreas()).rejects.toMatchObject({ status: 401, traceId: 'area-auth-trace' });
  });
});
