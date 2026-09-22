import { useId, useState } from 'react';
import { parseVocabulary, prepareConversationInput } from './conversationInput';
import { createConversation } from './tavernClient';
import type { Character, Conversation } from './types';
import { ErrorNotice, TavernDialog, inputClass, primaryClass } from './TavernUi';

export default function NewConversationForm({ character, defaultName, csrfToken, onCreated, onClose }: {
  character: Character; defaultName: string; csrfToken: string; onCreated: (conversation: Conversation) => void; onClose: () => void;
}) {
  const id = useId();
  const [userName, setUserName] = useState(defaultName);
  const [persona, setPersona] = useState('');
  const [vocabularyText, setVocabularyText] = useState('');
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const greetings = [character.card.firstMessage, ...character.card.alternateGreetings];
  const opening = greetings[greetingIndex].replace(/\{\{(char|user)\}\}/gu, (_, token: string) => token === 'char' ? character.card.name : userName.trim());
  async function submit() {
    if (pending) return;
    setError(null);
    try {
      const input = prepareConversationInput({ characterId: character.characterId, userName, persona,
        vocabulary: parseVocabulary(vocabularyText), greetingIndex });
      setPending(true);
      onCreated(await createConversation(input, csrfToken));
    } catch (failure) { setError(failure); setPending(false); }
  }
  return <TavernDialog title={`与${character.card.name}创建会话`} onClose={onClose} busy={pending}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p className="text-sm text-slate-400">这些设定将在创建后固定。留空学习词表即可开始普通角色聊天。</p>
      <label htmlFor={`${id}-name`} className="block text-sm">用户称呼</label>
      <input id={`${id}-name`} className={inputClass} value={userName} onChange={event => setUserName(event.target.value)} disabled={pending} required autoComplete="nickname" />
      <label htmlFor={`${id}-persona`} className="block text-sm">Persona（可选）</label>
      <textarea id={`${id}-persona`} className={inputClass} value={persona} onChange={event => setPersona(event.target.value)} disabled={pending} rows={3} placeholder="你在故事中的身份、性格或背景，最多 4,000 字符" />
      <label htmlFor={`${id}-vocabulary`} className="block text-sm">学习词表（可选）</label>
      <textarea id={`${id}-vocabulary`} className={inputClass} value={vocabularyText} onChange={event => setVocabularyText(event.target.value)} disabled={pending} rows={4} placeholder={'每行一个词或短语；释义用 Tab 或「 — 」分隔\ntea — 茶\nby the way'} aria-describedby={`${id}-vocabulary-help`} />
      <p id={`${id}-vocabulary-help`} className="text-xs text-slate-400">最多 50 项、完整词表 2 KiB。词汇会在合适的语境中自然出现。</p>
      <label htmlFor={`${id}-greeting`} className="block text-sm">开场白</label>
      <select id={`${id}-greeting`} className={inputClass} value={greetingIndex} disabled={pending} onChange={event => setGreetingIndex(Number(event.target.value))}>
        {greetings.map((greeting, index) => <option key={index} value={index}>{index === 0 ? '默认开场白' : `备选开场白 ${index}`} · {greeting.slice(0, 45) || '无'}</option>)}
      </select>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-300">{opening || '没有开场白，发送消息即可开始。'}</p>
      <ErrorNotice error={error} />
      <button type="submit" disabled={pending || !userName.trim()} className={`${primaryClass} w-full`}>{pending ? '创建中…' : '开始对话'}</button>
    </form>
  </TavernDialog>;
}
