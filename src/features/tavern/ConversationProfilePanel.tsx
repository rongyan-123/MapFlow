import { useEffect, useRef, useState } from 'react';
import { parseVocabulary } from './conversationInput';
import { updateConversationProfile } from './tavernClient';
import { TavernApiError, type ConversationDetail } from './types';
import { ErrorNotice, inputClass, primaryClass } from './TavernUi';

export default function ConversationProfilePanel({ detail, csrfToken, onUpdated, onConflict }: {
  detail: ConversationDetail; csrfToken: string; onUpdated: (detail: ConversationDetail) => void;
  onConflict: () => Promise<void>;
}) {
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
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3 className="text-sm font-semibold">会话设定</h3>
    <p className="text-xs leading-5 text-slate-500">修改从下一轮生效，已发生的故事和开场白不会被重写。词表留空即可普通聊天。</p>
    <label className="block text-xs text-slate-400">用户称呼<input className={`${inputClass} mt-1`} value={userName} onChange={event => setUserName(event.target.value)} disabled={busy} required /></label>
    <label className="block text-xs text-slate-400">Persona（可选）<textarea className={`${inputClass} mt-1`} rows={3} value={persona} onChange={event => setPersona(event.target.value)} disabled={busy} placeholder="你在故事中的身份、性格或背景" /></label>
    <label className="block text-xs text-slate-400">学习词表（可选）<textarea className={`${inputClass} mt-1`} rows={4} value={vocabulary} onChange={event => setVocabulary(event.target.value)} disabled={busy} placeholder={'每行一个词或短语，可附释义\nshelter — 避难所'} /></label>
    <p className="text-xs text-slate-500">最多 50 项、总计 2 KiB；自然融入剧情，不强制输出。</p>
    {canChangeGreeting ? <label className="block text-xs text-slate-400">开场白<select className={`${inputClass} mt-1`} value={greeting} disabled={busy} onChange={event => setGreeting(event.target.value)}>
      <option value="">保留当前开场白</option>{[detail.character.card.firstMessage, ...detail.character.card.alternateGreetings].map((text, index) => <option key={index} value={index}>{index ? `备选开场白 ${index}` : '默认开场白'} · {text.slice(0, 60)}</option>)}
    </select></label> : <p className="text-xs text-slate-500">故事已开始，开场白保留在历史中，不再替换。</p>}
    <ErrorNotice error={error} />
    <div className="flex items-center gap-3"><button type="submit" className={primaryClass} disabled={busy || !userName.trim()}>{busy ? '保存中…' : '保存会话设定'}</button>{saved && <span role="status" className="text-xs text-cyan-300">会话设定已保存</span>}</div>
  </form>;
}
