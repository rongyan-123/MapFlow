import type { GraphMessage, RoleChange } from './types';

export function messageAuthors(messages: GraphMessage[], changes: RoleChange[], characterId: string, characterName: string): Map<string, string> {
  const authors = new Map<string, string>();
  let activeRole = changes.length === 0 ? { id: characterId, name: characterName } : undefined;
  const original = changes.find(change => change.previousCharacterId && change.previousCharacterName);
  if (original?.previousCharacterId && original.previousCharacterName) {
    activeRole = { id: original.previousCharacterId, name: original.previousCharacterName };
  }
  for (const change of changes.filter(change => change.afterMessageId === null)) {
    activeRole = { id: change.characterId, name: change.characterName };
  }
  for (const message of messages) {
    if (message.role === 'assistant') {
      authors.set(message.messageId, activeRole?.id === message.characterId ? activeRole.name : '历史角色');
    }
    for (const change of changes.filter(change => change.afterMessageId === message.messageId)) {
      activeRole = { id: change.characterId, name: change.characterName };
    }
  }
  return authors;
}
