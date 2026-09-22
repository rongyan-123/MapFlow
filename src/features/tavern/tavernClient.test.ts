import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConversation, deleteCharacter, fetchCharacters, fetchConversation, fetchConversations, fetchTurns, importCharacter, sendTurnStream } from './tavernClient';
import { character, completion, conversation, detail, sseResponse, turn } from './testFixtures';

afterEach(() => vi.unstubAllGlobals());
function reply(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Tavern HTTP contract', () => {
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
    const completed = await sendTurnStream('conversation-1', '来杯茶', 'stable-id', 'csrf', delta => deltas.push(delta));
    expect(deltas.join('')).toBe('茶 🌙');
    expect(completed.creditBalance).toBe(9.9998);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tavern/conversations/conversation-1/turns', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ Accept: 'text/event-stream', 'X-CSRF-Token': 'csrf' }), body: JSON.stringify({ clientTurnId: 'stable-id', message: '来杯茶' }),
    })]);
  });

  it('treats EOF before completed as retryable interruption and reuses the supplied clientTurnId', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse([{ event: 'delta', payload: { delta: 'partial' } }]))
      .mockResolvedValueOnce(sseResponse([{ event: 'completed', payload: completion }]));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendTurnStream('conversation-1', '来杯茶', 'client-turn-1', 'csrf', () => {})).rejects.toMatchObject({ code: 'tavern.stream_interrupted' });
    await sendTurnStream('conversation-1', '来杯茶', 'client-turn-1', 'csrf', () => {});
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).clientTurnId)).toEqual(['client-turn-1', 'client-turn-1']);
  });

  it('does not count HTTP 200 or a delta as success and surfaces SSE error metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([{ event: 'error', payload: { code: 'tavern.turn_conflict', message: '会话忙碌', httpStatus: 409, traceId: 'trace-2' } }])));
    await expect(sendTurnStream('conversation-1', '你好', 'stable', 'csrf', () => {})).rejects.toMatchObject({ status: 409, code: 'tavern.turn_conflict', traceId: 'trace-2' });
  });

  it('rejects oversized UTF-8 messages, control characters, invalid IDs and missing CSRF before fetch', async () => {
    const fetchMock = reply({});
    for (const message of ['', '中'.repeat(2731), 'x'.repeat(8001), 'bad\u0000']) {
      await expect(sendTurnStream('conversation-1', message, 'stable', 'csrf', () => {})).rejects.toMatchObject({ code: expect.stringMatching(/^tavern\./) });
    }
    await expect(sendTurnStream('conversation-1', 'ok', '', 'csrf', () => {})).rejects.toMatchObject({ code: 'tavern.card_invalid' });
    await expect(deleteCharacter('character-1', '')).rejects.toMatchObject({ code: 'identity.csrf_missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
