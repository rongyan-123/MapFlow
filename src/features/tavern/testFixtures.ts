import type { Character, CompletedTurn, Conversation, ConversationDetail, Turn } from './types';

export const character: Character = {
  characterId: 'character-1', normalizedHash: 'normalized-hash', sourceHash: null, avatarUrl: null, createdAt: '2026-09-22T00:00:00Z',
  card: { schemaVersion: 1, sourceFormat: 'json', name: '旅人', description: '来自远方的旅人', personality: '友善', scenario: '茶馆',
    firstMessage: '你好，{{user}}！', exampleDialogue: '', systemPrompt: '', postHistoryInstructions: '', creatorNotes: '',
    alternateGreetings: ['夜深了，{{user}}。'], lorebook: [], warnings: [] },
};
export const conversation: Conversation = {
  conversationId: 'conversation-1', characterId: 'character-1', title: '旅人的茶馆', userName: '小明', persona: '旅行者',
  vocabulary: null, openingMessage: '你好，小明！',
  generationSettings: { maxOutputTokens: 2048, stopSequences: [] }, generationSettingsVersion: 1,
  createdAt: '2026-09-22T00:00:00Z',
};
export const turn: Turn = {
  turnId: 'turn-1', clientTurnId: 'client-turn-1', userMessage: '来杯茶', assistantMessage: '请用茶。',
  usage: { inputTokens: 20, outputTokens: 8, cacheHitInputTokens: 5, cacheMissInputTokens: 15 },
  chargedCreditUnits: 200, createdAt: '2026-09-22T00:01:00Z',
};
export const detail: ConversationDetail = { character, conversation, turns: [turn], generations: [{
  generationId: 'turn-1', branchId: 'branch-main', clientActionId: 'client-turn-1', intent: 'migration',
  anchorMessageId: 'message-opening', inputMessageId: 'message-user-1', outputMessageId: 'message-assistant-1',
  promptFingerprint: 'a'.repeat(64), settingsSnapshot: conversation.generationSettings, modelId: 'deepseek-v4-flash',
  usage: turn.usage, chargedCreditUnits: turn.chargedCreditUnits, createdAt: turn.createdAt,
}], graph: {
  revision: 1, activeBranchId: 'branch-main', activePath: ['message-opening', 'message-user-1', 'message-assistant-1'],
  messages: [
    { messageId: 'message-opening', parentMessageId: null, role: 'assistant', origin: 'opening', characterId: 'character-1', content: '你好，小明！' },
    { messageId: 'message-user-1', parentMessageId: 'message-opening', role: 'user', origin: 'user', characterId: null, content: '来杯茶' },
    { messageId: 'message-assistant-1', parentMessageId: 'message-user-1', role: 'assistant', origin: 'model', characterId: 'character-1', content: '请用茶。' },
  ],
  branches: [{ branchId: 'branch-main', name: 'Main', kind: 'main', leafMessageId: 'message-assistant-1' }],
} };
export const completion: CompletedTurn = { turn, graph: detail.graph, creditBalance: 9.9998, chargedCredits: 0.0002, idempotencyHit: false };

export function sseResponse(events: { event: string; payload: unknown }[], delimiter = '\n', trailing = true) {
  const text = events.map(({ event, payload }) => `event: ${event}${delimiter}data: ${JSON.stringify(payload)}`).join(`${delimiter}${delimiter}`) + (trailing ? `${delimiter}${delimiter}` : '');
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Byte-sized chunks deliberately split UTF-8 characters and CRLF boundaries.
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
