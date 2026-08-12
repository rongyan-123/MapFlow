export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';
export type ThinkingMode = 'enabled' | 'disabled';
export type ReasoningEffort = 'low' | 'high' | 'max';

export interface ModelAccess {
  apiKey: string;
  model: DeepSeekModel;
  thinking: ThinkingMode;
  reasoningEffort: ReasoningEffort;
}

export interface GenerationInput {
  topic: string;
  role: string;
  goalDescription: string;
  learnerContextSummary: string;
}

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheHitInputTokens: number;
  cacheMissInputTokens: number;
}

export interface GenerationPlanStage {
  title: string;
  goal: string;
  topics: string[];
}

export type PlanningOutcome =
  | { outcome: 'needs_input'; question: string }
  | {
      outcome: 'plan_ready';
      normalizedSpec: GenerationInput;
      stages: GenerationPlanStage[];
      assumptions: string[];
      estimatedNodes: number;
    };

export type PlanningChangeKind =
  | 'initial'
  | 'replan'
  | 'adjust'
  | 'clarification';

export interface GenerationPlan {
  version: number;
  changeKind: PlanningChangeKind;
  outcome: PlanningOutcome;
  usage: GenerationUsage;
}

export type GenerationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface GenerationRun {
  runId: string;
  status: GenerationRunStatus;
  stage: string | null;
  message: string | null;
  progress: number;
  errorCode: string | null;
  usage: GenerationUsage;
}

export type GenerationSessionState =
  | 'needs_input'
  | 'plan_ready'
  | 'queued'
  | 'running'
  | 'succeeded';

export interface GenerationSession {
  generationSessionId: string;
  input: GenerationInput;
  state: GenerationSessionState;
  latestPlan: GenerationPlan;
  latestRun: GenerationRun | null;
  producedTreeId: string | null;
  producedLibraryEntryId: string | null;
}
