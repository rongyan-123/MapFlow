import type { Character, CompletedTurn, Conversation, ConversationDetail, Turn } from './types';

export const character: Character = {
  characterId: 'character-1', normalizedHash: 'normalized-hash', sourceHash: null, avatarUrl: null, createdAt: '2026-09-22T00:00:00Z',
  card: { schemaVersion: 1, sourceFormat: 'json', name: '旅人', description: '来自远方的旅人', personality: '友善', scenario: '茶馆',
    firstMessage: '你好，{{user}}！', exampleDialogue: '', systemPrompt: '', postHistoryInstructions: '', creatorNotes: '',
    alternateGreetings: ['夜深了，{{user}}。'], lorebook: [], warnings: [] },
};
export const conversation: Conversation = {
  conversationId: 'conversation-1', characterId: 'character-1', title: '旅人的茶馆', userName: '小明', persona: '旅行者',
  vocabulary: null, openingMessage: '你好，小明！', createdAt: '2026-09-22T00:00:00Z',
};
export const turn: Turn = {
  turnId: 'turn-1', clientTurnId: 'client-turn-1', userMessage: '来杯茶', assistantMessage: '请用茶。',
  usage: { inputTokens: 20, outputTokens: 8, cacheHitInputTokens: 5, cacheMissInputTokens: 15 },
  chargedCreditUnits: 200, createdAt: '2026-09-22T00:01:00Z',
};
export const detail: ConversationDetail = { character, conversation, turns: [turn] };
export const completion: CompletedTurn = { turn, creditBalance: 9.9998, chargedCredits: 0.0002, idempotencyHit: false };

export function sseResponse(events: { event: string; payload: unknown }[], delimiter = '\n', trailing = true) {
  const text = events.map(({ event, payload }) => `event: ${event}${delimiter}data: ${JSON.stringify(payload)}`).join(`${delimiter}${delimiter}`) + (trailing ? `${delimiter}${delimiter}` : '');
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Byte-sized chunks deliberately split UTF-8 characters and CRLF boundaries.
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
