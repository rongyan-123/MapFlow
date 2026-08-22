export interface KnowledgeChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheHitInputTokens: number;
  cacheMissInputTokens: number;
}

export interface KnowledgeChatResponse {
  answer: string;
  usage: KnowledgeChatUsage;
  chargedCredits: number;
  sandboxRemainingUnits: number;
}

export type KnowledgeChatMessageRole = 'user' | 'assistant';

export interface KnowledgeChatMessage {
  id: string;
  role: KnowledgeChatMessageRole;
  content: string;
}

export class KnowledgeChatApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;

  constructor(status: number, code: string, message: string, traceId?: string) {
    super(message);
    this.name = 'KnowledgeChatApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}
