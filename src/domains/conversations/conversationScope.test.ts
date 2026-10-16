import { afterEach, describe, expect, it, vi } from 'vitest';
import { character, conversation, detail } from '../../test/conversations';
import { conversationScope } from './conversationScope';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const owner = { accountId: 'player-1', csrfToken: 'csrf', userName: '小明' };
const areaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('conversation scene scope', () => {
  it('accepts only records in its scene and learning area, including legacy tavern records', () => {
    const tavern = conversationScope({ ...owner, scene: 'tavern' });
    const learning = conversationScope({ ...owner, scene: 'learning', areaId: 'area-1' });
    const management = conversationScope({ ...owner, scene: 'management' });
    const local = { ...conversation, scene: 'learning' as const, learningAreaId: 'area-1', libraryEntryId: 'area-1' };
    expect(tavern.belongs(conversation)).toBe(true);
    expect(tavern.belongs(local)).toBe(false);
    expect(learning.belongs(local)).toBe(true);
    expect(learning.belongs({ ...local, learningAreaId: 'area-2' })).toBe(false);
    expect(learning.belongs(conversation)).toBe(false);
    expect(management.belongs({ ...conversation, scene: 'management' })).toBe(true);
    expect(management.belongs(conversation)).toBe(false);
  });

  it('preserves existing preference and cache keys while separating accounts and learning areas', () => {
    const tavern = conversationScope({ ...owner, scene: 'tavern' });
    const learning = conversationScope({ ...owner, scene: 'learning', areaId: 'area-1' });
    const other = conversationScope({ ...owner, accountId: 'player-2', scene: 'learning', areaId: 'area-2' });
    const management = conversationScope({ ...owner, scene: 'management' });
    expect(tavern.selectionKey).toBe('mapflow.tavern.selection.v1.player-1');
    expect(learning.selectionKey).toBe('mapflow.tavern.selection.v1.player-1.tree.area-1');
    expect(management.selectionKey).toBe('mapflow.tavern.selection.v1.player-1.management');
    expect(learning.creationKey).toBe('mapflow.tavern.creation.v1.player-1.learning.area-1');
    expect(management.creationKey).toBe('mapflow.tavern.creation.v1.player-1.management');
    expect(learning.keys.history).toEqual(['me', 'player-1', 'learning', 'area-1', 'conversations']);
    expect(other.keys.history).toEqual(['me', 'player-2', 'learning', 'area-2', 'conversations']);
    expect(tavern.keys.history).toEqual(['me', 'player-1', 'tavern', 'conversations']);
    expect(learning.keys.characters).toEqual(tavern.keys.characters);
    expect(learning.keys.detail('story-1')).toEqual(['me', 'player-1', 'tavern', 'conversation', 'story-1']);
    expect(learning.keys.default).toEqual(['me', 'player-1', 'tavern', 'tree-conversation', 'area-1']);
    expect(management.keys.default).toEqual(['me', 'player-1', 'management', 'default-conversation']);
  });

  it('creates a learning role in its area without copying another role identity or vocabulary', async () => {
    const requests: Array<{ path: string; input: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
      requests.push({ path, input: JSON.parse(String(options.body)) });
      return Response.json({ ...detail, conversation: { ...conversation, scene: 'learning', learningAreaId: areaId, libraryEntryId: areaId } });
    });
    const scope = conversationScope({ ...owner, scene: 'learning', areaId });
    const saved = await scope.create(character, { ...conversation, characterId: 'another-role', persona: '另一个身份', vocabulary: [{ term: '不应复制' }], treeToolsEnabled: true });
    expect(saved).toMatchObject({ conversation: { conversationId: conversation.conversationId } });
    expect(requests).toHaveLength(1);
    expect(requests[0].path).toBe(`/api/me/learning-areas/${areaId}/conversations`);
    expect(requests[0].input).toMatchObject({ characterId: character.characterId, userName: '小明', greetingIndex: 0, toolsEnabled: false });
    expect(requests[0].input.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[0].input).not.toHaveProperty('persona');
    expect(requests[0].input).not.toHaveProperty('vocabulary');
    expect(localStorage.getItem(scope.creationKey)).toBeNull();
  });

  it('replays the same learning creation after remount and blocks a different role until it is resolved', async () => {
    const inputs: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_path: string, options: RequestInit) => {
      inputs.push(JSON.parse(String(options.body)));
      return inputs.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ ...detail, conversation: { ...conversation, scene: 'learning', learningAreaId: areaId, libraryEntryId: areaId } });
    });
    await expect(conversationScope({ ...owner, scene: 'learning', areaId }).create(character)).rejects.toMatchObject({ status: 503 });
    const resumed = conversationScope({ ...owner, scene: 'learning', areaId });
    await expect(resumed.create({ ...character, characterId: '22222222-2222-4222-8222-222222222222' })).rejects.toThrow('另一个角色的新建请求待确认');
    expect(inputs).toHaveLength(1);
    await resumed.create(character);
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toEqual(inputs[0]);
    expect(localStorage.getItem(resumed.creationKey)).toBeNull();
  });

  it.each(['tavern', 'management'] as const)('routes %s creation and preserves only the intended existing profile', async scene => {
    let request: { path: string; input: Record<string, unknown> } | undefined;
    vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
      request = { path, input: JSON.parse(String(options.body)) };
      return Response.json(scene === 'tavern' ? conversation : { ...detail, conversation: { ...conversation, scene: 'management', learningAreaId: null, libraryEntryId: null } });
    });
    await conversationScope({ ...owner, scene }).create(character, { ...conversation, userName: '专用称呼', persona: '当前身份', vocabulary: [{ term: '当前词' }] });
    expect(request?.path).toBe(`/api/me/tavern/${scene === 'tavern' ? 'conversations' : 'management-conversations'}`);
    expect(request?.input).toMatchObject({ userName: '专用称呼', persona: '当前身份', vocabulary: [{ term: '当前词' }], greetingIndex: 0 });
    if (scene === 'management') {
      expect(request?.input).toMatchObject({ newConversation: true });
      expect(request?.input).not.toHaveProperty('characterId');
    } else {
      expect(request?.input).toHaveProperty('characterId', character.characterId);
      expect(request?.input).not.toHaveProperty('clientRequestId');
    }
    expect(request?.input).not.toHaveProperty('toolsEnabled');
  });

  it.each(['learning', 'management'] as const)('ends a terminal %s creation replay and gives the next request a new identity', async scene => {
    const scope = conversationScope({ ...owner, scene, ...(scene === 'learning' ? { areaId } : {}) });
    const oldRequest = { clientRequestId: '11111111-1111-4111-8111-111111111111', characterId: character.characterId, userName: '原请求' };
    localStorage.setItem(scope.creationKey, JSON.stringify(oldRequest));
    const inputs: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_path: string, options: RequestInit) => {
      inputs.push(JSON.parse(String(options.body)));
      return inputs.length === 1 ? Response.json({ error: { code: scene === 'learning' ? 'tavern.creation_target_deleted' : 'tavern.character_not_found', message: 'unavailable' } }, { status: 410 })
        : Response.json({ ...detail, conversation: { ...conversation, scene, learningAreaId: scene === 'learning' ? areaId : null, libraryEntryId: scene === 'learning' ? areaId : null } });
    });
    const resumed = conversationScope({ ...owner, scene, ...(scene === 'learning' ? { areaId } : {}) });
    await expect(resumed.create(character)).rejects.toMatchObject({ status: 410 });
    expect(inputs[0]).toMatchObject(oldRequest);
    expect(localStorage.getItem(scope.creationKey)).toBeNull();
    await resumed.create(character);
    expect(inputs[1].clientRequestId).not.toBe(oldRequest.clientRequestId);
  });

  it.each(['learning', 'management'] as const)('uses the existing first-entry endpoint for %s without creating a replacement history', async scene => {
    let request: { path: string; body: unknown } | undefined;
    vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
      request = { path, body: JSON.parse(String(options.body)) };
      return Response.json({ ...detail, conversation: { ...conversation, scene, learningAreaId: scene === 'learning' ? areaId : null, libraryEntryId: scene === 'learning' ? areaId : null } });
    });
    await conversationScope({ ...owner, scene, ...(scene === 'learning' ? { areaId } : {}) }).openDefault();
    expect(request).toEqual({ path: scene === 'learning' ? `/api/me/tavern/tree-conversations/${areaId}` : '/api/me/tavern/management-conversations', body: {} });
  });
});
