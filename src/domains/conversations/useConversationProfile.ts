import {useEffect,useRef,useState} from 'react';
import {parseVocabulary} from './conversationInput';
import {updateConversationProfile} from '../../api/tavernClient';
import {TavernApiError,type ConversationDetail} from './types';
export interface ProfileProps{detail:ConversationDetail;csrfToken:string;onUpdated:(detail:ConversationDetail)=>void;onConflict:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void}
export function useConversationProfile({detail,csrfToken,onUpdated,onConflict,onBusyChange}:ProfileProps){
  const { conversation } = detail;
  const [userName, setUserName] = useState(conversation.userName);
  const [persona, setPersona] = useState(conversation.persona ?? '');
  const [vocabulary, setVocabulary] = useState('');
  const [greeting, setGreeting] = useState('');
  const canChangeGreeting = detail.graph.messages.every(message => message.origin === 'opening') && detail.graph.branches.length === 1;
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const saving = useRef(false);
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(()=>()=>{onBusyChange?.(false);},[onBusyChange]);
  const savedVocabulary = (conversation.vocabulary ?? []).map(entry => entry.meaning ? `${entry.term} — ${entry.meaning}` : entry.term).join('\n');
  useEffect(() => {
    setGreeting('');
    setUserName(conversation.userName); setPersona(conversation.persona ?? '');
    setVocabulary(savedVocabulary);
  }, [conversation.conversationId, conversation.userName, conversation.persona, conversation.openingMessage, savedVocabulary]);
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null); setSaved(false);
    try {
      const updated = await updateConversationProfile(conversation.conversationId, detail.graph.revision, {
        characterId: conversation.characterId, userName, persona, vocabulary: parseVocabulary(vocabulary),
        ...(canChangeGreeting && greeting !== '' ? { greetingIndex: Number(greeting) } : {}),
      }, csrfToken);
      onUpdated(updated); setGreeting(''); setSaved(true);
    } catch (failure) {
      setError(failure);
      if (failure instanceof TavernApiError && failure.status === 409) await onConflict().catch(() => undefined);
    } finally { saving.current = false; setBusy(false); }
  }
  return {userName,setUserName,persona,setPersona,vocabulary,setVocabulary,greeting,setGreeting,canChangeGreeting,busy,saved,error,save};
}
