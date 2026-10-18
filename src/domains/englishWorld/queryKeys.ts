export const worldKeys = {
  root: (accountId: string) => ['me', accountId, 'english-world'] as const,
  worlds: (accountId: string) => [...worldKeys.root(accountId), 'worlds'] as const,
  world: (accountId: string, worldId: string) => [...worldKeys.root(accountId), 'world', worldId] as const,
  task: (accountId: string, taskId: string) => [...worldKeys.root(accountId), 'task', taskId] as const,
  play: (accountId: string, playthroughId: string, branchId?: string) => [...worldKeys.root(accountId), 'play', playthroughId, branchId ?? 'active'] as const,
  history: (accountId: string, playthroughId: string, branchId: string) => [...worldKeys.root(accountId), 'history', playthroughId, branchId] as const,
  checkpoints: (accountId: string, playthroughId: string) => [...worldKeys.root(accountId), 'checkpoints', playthroughId] as const,
  debrief: (accountId: string, playthroughId: string, branchId: string) => [...worldKeys.root(accountId), 'debrief', playthroughId, branchId] as const,
  words: (accountId: string, search: string, filter: string) => [...worldKeys.root(accountId), 'words', search, filter] as const,
  word: (accountId: string, wordId: string) => [...worldKeys.root(accountId), 'word', wordId] as const,
  due: (accountId: string) => [...worldKeys.root(accountId), 'due'] as const,
};
