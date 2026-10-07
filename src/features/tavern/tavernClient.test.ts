import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConversation, deleteCharacter, fetchCharacters, fetchConversation, fetchConversations, fetchTurns, generateStream, importCharacter, mutateGraph, updateGenerationSettings } from './tavernClient';
import { character, completion, conversation, detail, sseResponse, turn } from './testFixtures';

afterEach(() => vi.unstubAllGlobals());
function reply(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Tavern HTTP contract', () => {
  it('rejects malformed tree permissions returned with a conversation', async () => {
    reply({ ...detail, conversation: { ...conversation, libraryEntryId: 42, treeToolsEnabled: 'true' } });
    await expect(fetchConversation('conversation-1')).rejects.toThrow();
  });
  it('uploads normalized_card and the unchanged original file with session credentials and CSRF, without a multipart content-type override', async () => {
    const fetchMock = reply(character);
    const original = new File(['original text'], 'role.json');
    expect((await importCharacter(character.card, original, 'csrf')).characterId).toBe('character-1');
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/me/tavern/characters');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': 'csrf' } });
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    expect(init.body.get('source_file')).toBe(original);
    expect(JSON.parse(init.body.get('normalized_card'))).toEqual(character.card);
  });

  it('reads account-owned envelopes and safely encodes identifiers', async () => {
    const fetchMock = reply({ characters: [character] });
    expect(await fetchCharacters()).toEqual([character]);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ conversations: [conversation] })));
    expect(await fetchConversations()).toEqual([conversation]);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(detail)));
    expect((await fetchConversation('id/unsafe')).turns[0].assistantMessage).toBe('请用茶。');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/me/tavern/conversations/id%2Funsafe');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ turns: [turn] })));
    expect(await fetchTurns('conversation-1')).toEqual([turn]);
    expect(fetchMock.mock.calls.every(([, init]) => init.credentials === 'same-origin')).toBe(true);
  });

  it('omits empty vocabulary and blank persona while preserving alternate greeting selection', async () => {
    const fetchMock = reply(conversation);
    await createConversation({ characterId: 'character-1', userName: ' 小明 ', persona: ' ', vocabulary: [], greetingIndex: 1 }, 'csrf');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ characterId: 'character-1', userName: '小明', greetingIndex: 1 });
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('csrf');
  });

  it('soft-delete request uses the authenticated character endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock);
    await deleteCharacter('character-1', 'csrf');
    expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tavern/characters/character-1', expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }) })]);
  });

  it('updates the single generation settings contract with CSRF and parses its version', async () => {
    const state = { generationSettings: { temperature: 0.7, maxOutputTokens: 1024, stopSequences: ['END'] }, generationSettingsVersion: 2 };
    const fetchMock = reply(state);
    expect(await updateGenerationSettings('conversation-1', 1, state.generationSettings, 'csrf')).toEqual(state);
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/me/tavern/conversations/conversation-1/settings',
      expect.objectContaining({ method: 'PATCH', credentials: 'same-origin', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }), body: JSON.stringify({ expectedSettingsVersion: 1, settings: state.generationSettings }) }),
    ]);
  });

  it('sends every local graph operation through one revisioned action endpoint', async () => {
    const fetchMock = reply(detail.graph);
    const graph = await mutateGraph('conversation-1', 1, { type: 'select_branch', branchId: 'branch-main' }, 'csrf');
    expect(graph.activeBranchId).toBe('branch-main');
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/me/tavern/conversations/conversation-1/actions',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedRevision: 1, action: { type: 'select_branch', branchId: 'branch-main' } }) }),
    ]);
  });

  it('preserves error envelope status/code/trace without leaking malformed server responses', async () => {
    const fetchMock = reply({});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'tavern.credit_unavailable', message: '积分不足', traceId: 'trace-1' } }), { status: 402 }));
    await expect(fetchCharacters()).rejects.toMatchObject({ status: 402, code: 'tavern.credit_unavailable', traceId: 'trace-1' });
    fetchMock.mockResolvedValueOnce(new Response('private stack', { status: 500 }));
    await expect(fetchCharacters()).rejects.toMatchObject({ status: 500, code: 'tavern.request_failed' });
  });

  it('rejects malformed history/completion structures before the UI consumes them', async () => {
    reply({ ...detail, turns: [{ ...turn, usage: { inputTokens: -1 } }] });
    await expect(fetchConversation('conversation-1')).rejects.toMatchObject({ code: 'tavern.invalid_response' });
    reply({ ...detail, generations: [{ ...detail.generations[0], promptFingerprint: 'not-a-hash' }] });
    await expect(fetchConversation('conversation-1')).rejects.toMatchObject({ code: 'tavern.invalid_response' });
    reply({ characters: [{ ...character, card: { name: 'bad' } }] });
    await expect(fetchCharacters()).rejects.toMatchObject({ code: 'tavern.invalid_response' });
  });

  it.each(['\n', '\r\n', '\r'])('streams chunked Unicode with %j delimiters and accepts only committed completed events', async delimiter => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      { event: 'started', payload: { clientTurnId: 'stable-id' } },
      { event: 'delta', payload: { delta: '茶 🌙' } },
      { event: 'completed', payload: { ...completion, turn: { ...turn, clientTurnId: 'stable-id' } } },
    ], delimiter, false));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];
    const completed = await generateStream('conversation-1', 'stable-id', 7, { type: 'reply', message: '来杯茶' }, 'csrf', delta => deltas.push(delta));
    expect(deltas.join('')).toBe('茶 🌙');
    expect(completed.creditBalance).toBe(9.9998);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tavern/conversations/conversation-1/turns', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ Accept: 'text/event-stream', 'X-CSRF-Token': 'csrf' }), body: JSON.stringify({ clientActionId: 'stable-id', expectedRevision: 7, action: { type: 'reply', message: '来杯茶' } }),
    })]);
  });

  it('sends a user model key and vendor settings only with the selected turn', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      { event: 'completed', payload: { ...completion, turn: { ...turn, clientTurnId: 'byok' } } },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await generateStream('conversation-1', 'byok', 7, { type: 'reply', message: '来杯茶' },
      'csrf', () => {}, undefined, { apiKey: 'test-key', model: 'gemini-3.8-flash',
        baseUrl: 'https://anyai.token6688.com/v1', settings: { enable_thinking: true } }, 8192);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).modelAccess).toEqual({
      apiKey: 'test-key', model: 'gemini-3.8-flash', baseUrl: 'https://anyai.token6688.com/v1',
      settings: { enable_thinking: true },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).historyBytes).toBe(8192);
  });

  it('treats EOF before completed as retryable interruption and reuses the supplied clientTurnId', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse([{ event: 'delta', payload: { delta: 'partial' } }]))
      .mockResolvedValueOnce(sseResponse([{ event: 'completed', payload: completion }]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateStream('conversation-1', 'client-turn-1', 0, { type: 'reply', message: '来杯茶' }, 'csrf', () => {})).rejects.toMatchObject({ code: 'tavern.stream_interrupted' });
    await generateStream('conversation-1', 'client-turn-1', 0, { type: 'reply', message: '来杯茶' }, 'csrf', () => {});
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).clientActionId)).toEqual(['client-turn-1', 'client-turn-1']);
  });

  it('does not count HTTP 200 or a delta as success and surfaces SSE error metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([{ event: 'error', payload: { code: 'tavern.turn_conflict', message: '会话忙碌', httpStatus: 409, traceId: 'trace-2' } }])));
    await expect(generateStream('conversation-1', 'stable', 0, { type: 'reply', message: '你好' }, 'csrf', () => {})).rejects.toMatchObject({ status: 409, code: 'tavern.turn_conflict', traceId: 'trace-2' });
  });

  it('rejects oversized UTF-8 messages, control characters, invalid IDs and missing CSRF before fetch', async () => {
    const fetchMock = reply({});
    for (const message of ['', '中'.repeat(2731), 'x'.repeat(8001), 'bad\u0000']) {
      await expect(generateStream('conversation-1', 'stable', 0, { type: 'reply', message }, 'csrf', () => {})).rejects.toMatchObject({ code: expect.stringMatching(/^tavern\./) });
    }
    await expect(generateStream('conversation-1', '', 0, { type: 'reply', message: 'ok' }, 'csrf', () => {})).rejects.toMatchObject({ code: 'tavern.card_invalid' });
    await expect(deleteCharacter('character-1', '')).rejects.toMatchObject({ code: 'identity.csrf_missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
