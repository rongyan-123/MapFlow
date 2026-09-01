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
  /** Formal platform balance after this turn, when the request uses platform funding. */
  creditBalance?: number;
}

export interface KnowledgeChatApprovalEvent {
  approvalRequestId: string;
  toolName: 'personal_tree_mutation';
  action: string;
  target: string;
  destructive: boolean;
}

export type KnowledgeChatMessageRole = 'user' | 'assistant';

export interface KnowledgeChatMessage {
  id: string;
  role: KnowledgeChatMessageRole;
  content: string;
}

export interface KnowledgeChatHistoryResponse {
  messages: KnowledgeChatMessage[];
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
