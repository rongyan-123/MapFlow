import {useRef,useState} from 'react';
import {updateCharacter} from '../../api/tavernClient';
import {TavernApiError,type Character,type ConversationDetail} from '../conversations/types';
import {hasControls,utf8Bytes} from '../conversations/validation';
export interface CharacterEditorProps{character:Character;conversation?:ConversationDetail;csrfToken:string;onSaved:(result:{character:Character;conversation:ConversationDetail|null})=>void;onConflict:()=>Promise<void>}
export function useCharacterEditor({character,conversation,csrfToken,onSaved,onConflict}:CharacterEditorProps){
  const [draft, setDraft] = useState(character.card);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [applyToConversation, setApplyToConversation] = useState(false);
  const saving = useRef(false);
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      const card = { ...draft, name: draft.name.trim() };
      if (!card.name || Array.from(card.name).length > 200 || hasControls(card.name)) throw new TavernApiError(400, 'tavern.card_invalid', '角色名称需为 1–200 字，不能包含不可见控制字符。');
      if (utf8Bytes(JSON.stringify(card)) > 512 * 1024) throw new TavernApiError(400, 'tavern.input_too_large', '角色卡内容不能超过 512 KiB。');
      onSaved(await updateCharacter(character.characterId, character.normalizedHash, card, csrfToken,
        applyToConversation && conversation ? { conversationId: conversation.conversation.conversationId, expectedRevision: conversation.graph.revision } : undefined));
    } catch (failure) {
      setError(failure instanceof TavernApiError && failure.status === 409
        ? new TavernApiError(409, 'tavern.turn_conflict', '角色或会话已更新，或正在生成回复。草稿仍在此窗口中，请保留修改内容，稍后重新打开窗口读取最新设定。') : failure);
      if (failure instanceof TavernApiError && failure.status === 409) await onConflict().catch(() => undefined);
    } finally { saving.current = false; setBusy(false); }
  }
  return {draft,setDraft,busy,error,applyToConversation,setApplyToConversation,save};
}
