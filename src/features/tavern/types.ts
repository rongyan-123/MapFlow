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
export interface GenerationSettings {
  temperature?: number; maxOutputTokens: number; stopSequences: string[];
}
export interface TavernUserModelAccess {
  apiKey: string; model: string; baseUrl: string;
  settings: Record<string, string | boolean>;
}
export interface TavernModelSelection {
  provider: 'platform' | 'custom';
  apiKey: string; model: string; baseUrl: string;
  settings: Record<string, string | boolean>;
  historyBytes: 8192 | 16384 | 32768;
  billingPolicy?: string;
}
export interface GenerationSettingsState {
  generationSettings: GenerationSettings; generationSettingsVersion: number;
}
export interface Conversation {
  conversationId: string; characterId: string; title: string; userName: string;
  persona: string | null; vocabulary: VocabularyEntry[] | null; openingMessage: string;
  libraryEntryId?: string | null; treeToolsEnabled?: boolean;
  generationSettings: GenerationSettings; generationSettingsVersion: number; createdAt: string;
}
export interface Turn {
  turnId: string; clientTurnId: string; userMessage: string; assistantMessage: string;
  usage: { inputTokens: number; outputTokens: number; cacheHitInputTokens: number; cacheMissInputTokens: number };
  chargedCreditUnits: number; createdAt: string;
}
export interface GenerationRecord {
  process?: GenerationProcessEvent[];
  generationId: string; branchId: string; clientActionId: string;
  intent: 'reply' | 'regenerate' | 'continue' | 'migration';
  anchorMessageId: string | null; inputMessageId: string | null; outputMessageId: string;
  promptFingerprint: string; settingsSnapshot: GenerationSettings; modelId: string;
  usage: Turn['usage']; chargedCreditUnits: number; createdAt: string;
}
export interface GraphMessage {
  messageId: string; parentMessageId: string | null; role: 'user' | 'assistant' | 'system';
  origin: 'opening' | 'user' | 'model' | 'continue' | 'edit' | 'migration';
  characterId: string | null; content: string;
}
export interface GraphBranch {
  branchId: string; name: string; kind: 'main' | 'branch' | 'checkpoint'; leafMessageId: string | null;
}
export interface ConversationGraph {
  revision: number; activeBranchId: string; activePath: string[];
  messages: GraphMessage[]; branches: GraphBranch[];
}
export type GraphMutation =
  | { type: 'select_alternative'; assistantMessageId: string }
  | { type: 'edit'; messageId: string; replacementContent: string }
  | { type: 'create_branch'; anchorMessageId: string; name: string; activate: boolean }
  | { type: 'create_checkpoint'; anchorMessageId: string; name: string }
  | { type: 'select_branch'; branchId: string };
export type GenerationAction =
  | { type: 'reply'; message: string }
  | { type: 'regenerate'; assistantMessageId: string }
  | { type: 'continue'; assistantMessageId: string };
export interface ConversationDetail {
  canvas?: TeachingCanvasState;
  conversation: Conversation; character: Character; turns: Turn[];
  generations: GenerationRecord[]; graph: ConversationGraph;
  cashCharges?: CashCharge[];
}
export interface CashCharge { generationId:string; outputMessageId:string; amountMicros:number; balanceAfterMicros:number; capped:boolean; createdAt:string }
export interface CashQuote { quoteId:string; maximumChargeMicros:number; policyVersion:string; expiresInSeconds:number }
export interface CompletedTurn { turn: Turn; graph: ConversationGraph; creditBalance: number; chargedCredits: number; idempotencyHit: boolean; cashCharge?:CashCharge; walletBalanceMicros?:number; process?: GenerationProcessEvent[]; canvas?:TeachingCanvasState; generation?: GenerationRecord }
export type GenerationProcessEvent = { type: 'reasoning'; text: string } | { type: 'tool'; name: string; state: 'started' | 'completed' | 'failed' };
export type TavernLiveProcessEvent = GenerationProcessEvent | { type: 'canvas'; canvas: TeachingCanvasState } | { type: 'status'; state: 'generating' };
export class TavernApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly traceId?: string,
    public readonly generationFailed = false) {
    super(message); this.name = 'TavernApiError';
  }
}
export interface TeachingCanvasState { revision: number; enabled: boolean; elements: Record<string, unknown>[] }
