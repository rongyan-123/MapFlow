import type { Accepted, Checkpoints, Debrief, DueList, HistoryPage, PlaythroughPublic, ReviewItem, ReviewResult, TaskPublic, Translation, WordDetail, WordList, WorldDetail, WorldList } from './types';

export const ewIds = {
  operation: '10000000-0000-4000-8000-000000000001', world: '10000000-0000-4000-8000-000000000002',
  version: '10000000-0000-4000-8000-000000000003', task: '10000000-0000-4000-8000-000000000004',
  play: '10000000-0000-4000-8000-000000000005', branch: '10000000-0000-4000-8000-000000000006',
  utterance: '10000000-0000-4000-8000-000000000007', turn: '10000000-0000-4000-8000-000000000008',
  token: '10000000-0000-4000-8000-000000000009', checkpoint: '10000000-0000-4000-8000-00000000000a',
  word: '10000000-0000-4000-8000-00000000000b', review: '10000000-0000-4000-8000-00000000000c',
  restoredBranch: '10000000-0000-4000-8000-00000000000d', translation: '10000000-0000-4000-8000-00000000000e',
};
export const ewAccepted: Accepted = { operationId: ewIds.operation, taskId: ewIds.task, worldId: ewIds.world };
export const ewWorldList: WorldList = { schemaVersion: 1, worlds: [{ worldId: ewIds.world, title: '博物馆之夜', summary: '一扇门，一封失踪的信。', difficulty: 'intermediate', status: 'ready', currentVersionId: ewIds.version, activeTaskId: null, createdAt: '2026-10-18T12:00:00Z' }], recentPlaythroughs: [], reviewCount: 1 };
export const ewWorldDetail: WorldDetail = { schemaVersion: 1, world: ewWorldList.worlds[0], versions: [{ worldVersionId: ewIds.version, versionNo: 1, status: 'ready' }], playthroughs: [], allowedActions: { canStart: true, canGenerateVersion: true } };
export const ewTask: TaskPublic = { schemaVersion: 1, taskId: ewIds.task, stage: 'writing', state: 'running', progress: 0.4, sequence: 2, allowedActions: { canCheck: true, canStop: true, canResume: false, needsCredential: false }, publicResultRef: null, publicError: null, settlement: null };
export const ewPlay: PlaythroughPublic = { schemaVersion: 1, playthroughId: ewIds.play, worldId: ewIds.world, worldTitle: '博物馆之夜', worldVersionId: ewIds.version, activeBranchId: ewIds.branch, viewedBranchId: ewIds.branch, revision: 1, branchStatus: 'active', publicState: { location: { id: 'hall', name: '展览大厅', description: 'A quiet museum hall.' }, worldTime: '21:00', goal: 'Find the missing letter.', characters: [{ id: 'guard', name: 'Mara', description: 'The night guard.' }], clues: [{ id: 'letter', text: 'A torn envelope.' }], inventory: [] }, activeTaskId: null, debriefTaskId: null, allowedActions: { canAct: true, canRestore: true, canReadDebrief: false } };
export const ewHistory: HistoryPage = { schemaVersion: 1, utterances: [{ utteranceId: ewIds.utterance, turnId: ewIds.turn, sequence: 1, ordinal: 0, speakerKind: 'npc', actorKey: 'guard', speakerName: 'Mara', textEn: 'A sealed door.', tokens: [{ tokenId: ewIds.token, text: 'sealed', start: 2, end: 8, canTranslate: true }], translationUse: null }], nextCursor: null };
export const ewCheckpoints: Checkpoints = { schemaVersion: 1, checkpoints: [{ checkpointId: ewIds.checkpoint, branchId: ewIds.branch, sequence: 1, location: '展览大厅', worldTime: '21:00', summary: '刚进入大厅。', createdAt: '2026-10-18T12:01:00Z' }] };
export const ewTranslation: Translation = { schemaVersion: 1, translationUseId: ewIds.translation, selectedTokenId: ewIds.token, status: 'ready', glossZh: '封住的', taskId: null };
export const ewDebrief: Debrief = { schemaVersion: 1, status: 'ready', taskId: null, deathReason: '你违反了封门规则。', lastNpcText: 'Do not open the sealed door.', lastNpcTranslation: '不要打开封住的门。', playerText: 'I open the door.', playerMeaning: '我打开门。', explanation: '封门规则此前已被守卫提醒。', category: 'dangerous_choice' };
export const ewWords: WordList = { schemaVersion: 1, words: [{ learnerWordId: ewIds.word, lemma: 'sealed', senseId: ewIds.token, glossZh: '封住的', meaningStatus: 'resolved', firstSeenAt: '2026-10-18T12:01:00Z', lastSeenAt: '2026-10-18T12:01:00Z', exposureCount: 1, lookupCount: 1, dueAt: '2026-10-18T12:01:00Z', source: { worldId: ewIds.world, playthroughId: ewIds.play, branchId: ewIds.branch, utteranceId: ewIds.utterance, textEn: 'A sealed door.', speakerName: 'Mara' } }], total: 1, nextCursor: null };
export const ewWordDetail: WordDetail = { schemaVersion: 1, word: ewWords.words[0], occurrences: [{ occurrenceId: ewIds.utterance, textEn: 'A sealed door.', senseId: ewIds.token, assignmentRevision: 1 }] };
export const ewDue: DueList = { schemaVersion: 1, items: [{ learnerWordId: ewIds.word, lemma: 'sealed', modality: 'reading', dueAt: '2026-10-18T12:01:00Z', revision: 0 }], dueCount: 1 };
export const ewReviewItem: ReviewItem = { schemaVersion: 1, reviewItemId: ewIds.review, learnerWordId: ewIds.word, lemma: 'sealed', modality: 'reading', prompt: 'What does “sealed” mean in “A sealed door”?', expiresAt: '2099-10-18T12:01:00Z' };
export const ewReviewResult: ReviewResult = { schemaVersion: 1, reviewItemId: ewIds.review, rating: 3, glossZh: '封住的', dueAt: '2026-10-19T12:01:00Z', counted: true };
