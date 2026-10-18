export type Funding = 'cash' | 'points' | 'byok';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TaskState = 'queued' | 'running' | 'validating' | 'completed' | 'blocked' | 'failed' | 'stopped';
export type BranchStatus = 'active' | 'dead' | 'completed' | 'abandoned';
export type ReviewModality = 'reading' | 'writing';
export interface ModelAccess {
  apiKey: string; baseUrl: string; model: string; contextWindow: number; maxOutputTokens?: number | null;
  reasoningProtocol: 'none' | 'deepseek' | 'siliconflow' | 'openai_reasoning'; reasoningSupported: boolean;
}
export interface FundingSelection { funding: Funding; profileId?: string; profileVersion?: number; modelAccess?: ModelAccess }
export interface ResultRef {
  kind: 'world_version' | 'turn' | 'translation' | 'debrief'; worldId?: string; worldVersionId?: string;
  playthroughId?: string; branchId?: string; turnId?: string; translationUseId?: string;
}
export interface TaskPublic {
  schemaVersion: 1; taskId: string; stage: string; state: TaskState; progress: number; sequence: number;
  allowedActions: { canCheck: boolean; canStop: boolean; canResume: boolean; needsCredential: boolean };
  publicResultRef: ResultRef | null; publicError: { code: string; message: string } | null;
  settlement: { status: string; cashMicros: number | null; pointUnits: number | null; balanceMicros: number | null } | null;
}
export interface Accepted {
  operationId: string; taskId: string | null; worldId?: string; worldVersionId?: string;
  playthroughId?: string; branchId?: string; turnId?: string; translationUseId?: string;
}
export interface WorldSummary {
  worldId: string; title: string; summary: string; difficulty: Difficulty;
  status: 'preparing' | 'ready' | 'failed' | 'archived'; currentVersionId: string | null; activeTaskId: string | null; createdAt: string;
}
export interface PlaySummary {
  playthroughId: string; worldId: string; worldTitle: string; branchId: string;
  branchStatus: BranchStatus; location: string; updatedAt: string;
}
export interface WorldList { schemaVersion: 1; worlds: WorldSummary[]; recentPlaythroughs: PlaySummary[]; reviewCount: number }
export interface WorldDetail {
  schemaVersion: 1; world: WorldSummary; versions: { worldVersionId: string; versionNo: number; status: string }[];
  playthroughs: PlaySummary[]; allowedActions: { canStart: boolean; canGenerateVersion: boolean };
}
export interface PublicState {
  location: { id: string; name: string; description: string }; worldTime: string; goal: string;
  characters: { id: string; name: string; description: string }[]; clues: { id: string; text: string }[]; inventory: { id: string; name: string }[];
}
export interface PlaythroughPublic {
  schemaVersion: 1; playthroughId: string; worldId: string; worldTitle: string; worldVersionId: string;
  activeBranchId: string; viewedBranchId: string; revision: number; branchStatus: BranchStatus;
  publicState: PublicState; activeTaskId: string | null; debriefTaskId: string | null;
  allowedActions: { canAct: boolean; canRestore: boolean; canReadDebrief: boolean };
}
export interface WordToken { tokenId: string; text: string; start: number; end: number; canTranslate: boolean }
export interface Utterance {
  utteranceId: string; turnId: string; sequence: number; ordinal: number; speakerKind: 'narrator' | 'npc';
  actorKey: string | null; speakerName: string; textEn: string; tokens: WordToken[];
  translationUse: { selectedTokenId: string; status: 'reserved' | 'ready' | 'failed' | 'outcome_unknown'; glossZh: string | null } | null;
}
export interface HistoryPage { schemaVersion: 1; utterances: Utterance[]; nextCursor: string | null }
export interface Checkpoint { checkpointId: string; branchId: string; sequence: number; location: string; worldTime: string; summary: string; createdAt: string }
export interface Checkpoints { schemaVersion: 1; checkpoints: Checkpoint[] }
export interface Translation {
  schemaVersion: 1; translationUseId: string; selectedTokenId: string; status: 'reserved' | 'ready' | 'failed' | 'outcome_unknown'; glossZh: string | null; taskId: string | null;
}
export interface RestoreResult { schemaVersion: 1; operationId: string; branchId: string; revision: number }
export interface Debrief {
  schemaVersion: 1; status: 'pending' | 'ready'; taskId: string | null; deathReason: string | null;
  lastNpcText: string | null; lastNpcTranslation: string | null; playerText: string | null; playerMeaning: string | null;
  explanation: string | null; category: 'language' | 'world_rule' | 'dangerous_choice' | 'mixed' | null;
}
export interface Word {
  learnerWordId: string; lemma: string; senseId: string | null; glossZh: string | null;
  meaningStatus: 'unresolved' | 'resolved'; firstSeenAt: string; lastSeenAt: string; exposureCount: number; lookupCount: number; dueAt: string | null;
  source: { worldId: string; playthroughId: string; branchId: string; utteranceId: string | null; textEn: string; speakerName: string } | null;
}
export interface WordList { schemaVersion: 1; words: Word[]; total: number; nextCursor: string | null }
export interface WordDetail { schemaVersion: 1; word: Word; occurrences: { occurrenceId: string; textEn: string; senseId: string | null; assignmentRevision: number }[] }
export type ReviewTarget = { modality: 'reading'; lemma: string } | { modality: 'writing'; lemma: null };
export interface DueList {
  schemaVersion: 1; items: (ReviewTarget & { learnerWordId: string; dueAt: string; revision: number })[]; dueCount: number;
}
export type ReviewItem = ReviewTarget & { schemaVersion: 1; reviewItemId: string; learnerWordId: string; prompt: string; expiresAt: string };
export interface ReviewResult { schemaVersion: 1; reviewItemId: string; rating: 1 | 2 | 3 | 4; glossZh: string | null; dueAt: string; counted: boolean }
export interface WorldConfiguration { topic: string; difficulty: Difficulty; targetWordCount: number }
export type WordFilter = 'all' | 'lookup' | 'due';
