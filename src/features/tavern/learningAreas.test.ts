import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningArea, createLearningConversation, fetchLearningAreas, fetchLearningAreaConversations, fetchConversations, fetchConversation } from '../../api/tavernClient';
import { conversation, detail } from './testFixtures';

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
  it('creates a fresh area conversation with an optional owned role and reads only that area history', async () => {
    const learning = { ...conversation, scene: 'learning', learningAreaId: area.areaId, libraryEntryId: area.libraryEntryId, treeToolsEnabled: true };
    const fetchMock = reply({ ...detail, conversation: learning });
    expect((await createLearningConversation(area.areaId, { characterId: 'character-1' }, 'csrf')).conversation).toEqual(learning);
    expect(fetchMock).toHaveBeenCalledWith('/api/me/learning-areas/personal-map-1/conversations', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }), body: JSON.stringify({ characterId: 'character-1' }),
    }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ conversations: [learning] })));
    expect(await fetchLearningAreaConversations(area.areaId)).toEqual([learning]);
  });

  it('explicitly requests management histories while the independent list uses its default scene', async () => {
    const fetchMock = reply({ conversations: [] });
    await fetchConversations(undefined, 'management');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/me/tavern/conversations?scene=management', expect.anything());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ conversations: [] })));
    await fetchConversations();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/me/tavern/conversations', expect.anything());
  });

  it.each([
    { scene: 'other', learningAreaId: null },
    { scene: 'tavern', learningAreaId: 'map-1' },
    { scene: 'learning', learningAreaId: null },
    { scene: 'learning', learningAreaId: 'map-1', libraryEntryId: 'map-2' },
    { scene: 'management', learningAreaId: null, libraryEntryId: 'map-1' },
  ])('rejects inconsistent server conversation scope %j', async metadata => {
    reply({ ...detail, conversation: { ...conversation, ...metadata } });
    await expect(fetchConversation('conversation-1')).rejects.toThrow();
  });
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
