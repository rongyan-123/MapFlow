export interface CompatibilityWarning { code: string; field: string; message: string }
export interface LoreEntry {
  id: string; keys: string[]; secondaryKeys: string[]; constant: boolean; enabled: boolean;
  selective: boolean; content: string; priority: number; order: number;
}
export interface NormalizedCharacterCard {
  schemaVersion: 1; sourceFormat: 'json' | 'png'; name: string; description: string;
  personality: string; scenario: string; firstMessage: string; exampleDialogue: string;
  systemPrompt: string; postHistoryInstructions: string; creatorNotes: string;
  alternateGreetings: string[]; lorebook: LoreEntry[]; warnings: CompatibilityWarning[];
}
export interface SourceInfo { sourceFormat: 'json' | 'png'; fileName: string; fileSize: number }
export interface CardImport { card: NormalizedCharacterCard; sourceFile: File; sourceInfo: SourceInfo }
export interface VocabularyEntry { term: string; meaning?: string }
export interface Character {
  characterId: string; card: NormalizedCharacterCard; normalizedHash: string;
  sourceHash: string | null; avatarUrl: string | null; createdAt: string;
}
export interface CreateConversationInput {
  characterId: string; userName: string; persona?: string;
  vocabulary?: VocabularyEntry[]; greetingIndex?: number;
}
export interface Conversation {
  conversationId: string; characterId: string; title: string; userName: string;
  persona: string | null; vocabulary: VocabularyEntry[] | null; openingMessage: string; createdAt: string;
}
export interface Turn {
  turnId: string; clientTurnId: string; userMessage: string; assistantMessage: string;
  usage: { inputTokens: number; outputTokens: number; cacheHitInputTokens: number; cacheMissInputTokens: number };
  chargedCreditUnits: number; createdAt: string;
}
export interface ConversationDetail { conversation: Conversation; character: Character; turns: Turn[] }
export interface CompletedTurn { turn: Turn; creditBalance: number; chargedCredits: number; idempotencyHit: boolean }
export class TavernApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly traceId?: string) {
    super(message); this.name = 'TavernApiError';
  }
}
