import { createConversation, createLearningConversation, openManagementConversation, openTreeConversation } from '../../api/tavernClient';
import { TavernApiError, type Character, type Conversation, type ConversationScene } from './types';
import { creationStorageKey, persistPendingCreation, readPendingCreation } from './pendingCreation';
import { PublicUiError } from '../../lib/publicErrors';

export interface ConversationOwner {
  accountId: string;
  csrfToken: string;
  userName: string;
  scene: ConversationScene;
  areaId?: string;
  available?: boolean;
}

export function isTerminalCreationError(scene: ConversationScene, failure: unknown) {
  return failure instanceof TavernApiError && (failure.code === 'tavern.creation_target_deleted'
    || (scene === 'management' && failure.code === 'tavern.character_not_found'));
}

export function conversationScope(owner: ConversationOwner) {
  const { accountId, scene, areaId } = owner;
  const selectionKey = `mapflow.tavern.selection.v1.${accountId}${scene === 'management' ? '.management' : ''}${areaId ? `.tree.${areaId}` : ''}`;
  const creationKey = creationStorageKey(accountId, areaId, scene === 'management');
  let pending = readPendingCreation(creationKey);
  const keys = {
    characters: ['me', accountId, 'tavern', 'characters'] as const,
    history: areaId ? ['me', accountId, 'learning', areaId, 'conversations'] as const : ['me', accountId, scene, 'conversations'] as const,
    detail: (id: string | null) => ['me', accountId, 'tavern', 'conversation', id] as const,
    default: scene === 'management' ? ['me', accountId, 'management', 'default-conversation'] : ['me', accountId, 'tavern', 'tree-conversation', areaId],
  };
  function belongs(conversation: Conversation) {
    return owner.scene === 'learning'
      ? conversation.scene === 'learning' && conversation.learningAreaId === owner.areaId
      : (conversation.scene ?? 'tavern') === owner.scene && !conversation.learningAreaId && !conversation.libraryEntryId;
  }
  async function create(character?: Character, current?: Conversation) {
    if (scene === 'learning' && pending?.characterId && pending.characterId !== character?.characterId) {
      throw new PublicUiError('另一个角色的新建请求待确认，请先切回该角色重试新建。');
    }
    const previous = scene === 'management' || current?.characterId === character?.characterId ? current : undefined;
    const input = {
      ...(scene !== 'management' && character ? { characterId: character.characterId } : {}),
      userName: previous?.userName ?? owner.userName,
      ...(previous?.persona ? { persona: previous.persona } : {}),
      ...(previous?.vocabulary ? { vocabulary: previous.vocabulary } : {}),
      greetingIndex: 0,
    };
    if (scene === 'tavern') {
      if (!character) throw new PublicUiError('请先选择一个角色。');
      return createConversation({ ...input, characterId: character.characterId }, owner.csrfToken);
    }
    const request = pending ?? { ...input, clientRequestId: crypto.randomUUID(), ...(scene === 'learning' ? { toolsEnabled: previous?.treeToolsEnabled === true } : {}) };
    pending = request;
    persistPendingCreation(creationKey, request);
    try {
      const saved = scene === 'management'
        ? await openManagementConversation({ ...request, newConversation: true }, owner.csrfToken)
        : await createLearningConversation(areaId!, request, owner.csrfToken);
      pending = null;
      persistPendingCreation(creationKey, null);
      return saved;
    } catch (failure) {
      if (isTerminalCreationError(scene, failure)) {
        if (request.clientRequestId && readPendingCreation(creationKey)?.clientRequestId === request.clientRequestId) persistPendingCreation(creationKey, null);
        pending = null;
      }
      throw failure;
    }
  }
  function openDefault(signal?: AbortSignal) {
    return scene === 'management' ? openManagementConversation({}, owner.csrfToken, signal) : openTreeConversation(areaId!, owner.csrfToken, signal);
  }
  return { owner, selectionKey, creationKey, keys, belongs, create, openDefault };
}

export type ConversationScope = ReturnType<typeof conversationScope>;
