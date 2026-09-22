import { useEffect, useRef, useState } from 'react';
import { formatCreditAmount } from '../credit/creditClient';
import { validateId, validateMessage } from './conversationInput';
import { sendTurnStream } from './tavernClient';
import { TavernApiError, type CompletedTurn, type ConversationDetail } from './types';
import { isRecord, utf8Bytes } from './validation';
import { ErrorNotice, buttonClass, inputClass, primaryClass } from './TavernUi';

interface PendingTurn { clientTurnId: string; message: string }

export default function ConversationPane({ detail, accountId, csrfToken, onCompleted }: {
  detail: ConversationDetail; accountId: string; csrfToken: string; onCompleted: (completed: CompletedTurn) => void;
}) {
  const storageKey = `mapflow.tavern.pending.v1.${accountId}.${detail.conversation.conversationId}`;
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(() => {
    const saved = readPending(storageKey);
    if (saved && detail.turns.some(turn => turn.clientTurnId === saved.clientTurnId)) { storePending(storageKey, null); return null; }
    return saved;
  });
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    if (followLatest.current) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [draft, detail.turns.length, pendingTurn]);
  useEffect(() => {
    if (!busy && pendingTurn && detail.turns.some(turn => turn.clientTurnId === pendingTurn.clientTurnId)) {
      setPendingTurn(null); setDraft(''); setError(null); storePending(storageKey, null);
    }
  }, [busy, detail.turns, pendingTurn, storageKey]);

  async function send(retry?: PendingTurn) {
    if (activeRequest.current || (pendingTurn && !retry)) return;
    let outgoing: PendingTurn;
    try {
      validateMessage(retry?.message ?? message);
      outgoing = retry ?? { clientTurnId: crypto.randomUUID(), message };
    } catch (failure) { setError(failure); return; }
    const controller = new AbortController();
    activeRequest.current = controller;
    // Persist before sending: a refresh between request and completed must reuse the same ID.
    storePending(storageKey, outgoing);
    setPendingTurn(outgoing); setMessage(''); setDraft(''); setBusy(true); setError(null); followLatest.current = true;
    try {
      const completed = await sendTurnStream(detail.conversation.conversationId, outgoing.message, outgoing.clientTurnId,
        csrfToken, delta => { if (!controller.signal.aborted) setDraft(previous => previous + delta); }, controller.signal);
      if (controller.signal.aborted) return;
      storePending(storageKey, null);
      setPendingTurn(null); setDraft(''); onCompleted(completed);
    } catch (failure) { if (!controller.signal.aborted) setError(failure); }
    finally { if (!controller.signal.aborted) { activeRequest.current = null; setBusy(false); } }
  }
  const inputTooLarge = Array.from(message).length > 8000 || utf8Bytes(message) > 8192;
  const mayEdit = error instanceof TavernApiError && error.status === 400;

  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={pane} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" onScroll={() => {
      const container = pane.current;
      if (container) followLatest.current = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    }}>
      {detail.conversation.openingMessage && <Message author={detail.character.card.name} text={detail.conversation.openingMessage} />}
      {detail.turns.map(turn => <div key={turn.turnId} className="space-y-5">
        <Message author={detail.conversation.userName} text={turn.userMessage} user />
        <Message author={detail.character.card.name} text={turn.assistantMessage} />
        <p className="text-right text-[11px] text-slate-500">已保存 · {formatCreditAmount(turn.chargedCreditUnits / 1_000_000)} 积分</p>
      </div>)}
      {pendingTurn && <div className="space-y-5">
        <Message author={detail.conversation.userName} text={pendingTurn.message} user />
        {draft && <Message author={detail.character.card.name} text={draft} />}
        <p role="status" className="text-xs text-cyan-300">{busy ? '正在生成，完成后保存…' : '这条消息尚未确认完成，请重试以核对结果。'}</p>
      </div>}
      {!detail.turns.length && !detail.conversation.openingMessage && !pendingTurn && <p className="py-12 text-center text-sm text-slate-400">故事从你的第一句话开始。</p>}
      <div ref={bottom} />
    </div>
    <div className="shrink-0 space-y-3 border-t border-slate-800 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ErrorNotice error={error} />
      {pendingTurn && !busy && <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryClass} onClick={() => void send(pendingTurn)}>重试这条消息</button>
        {mayEdit && <button type="button" className={buttonClass} onClick={() => {
          setMessage(pendingTurn.message); setPendingTurn(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>编辑消息</button>}
      </div>}
      <form onSubmit={event => { event.preventDefault(); void send(); }} className="space-y-2">
        <label htmlFor={`tavern-message-${detail.conversation.conversationId}`} className="sr-only">消息</label>
        <textarea id={`tavern-message-${detail.conversation.conversationId}`} className={`${inputClass} max-h-48 resize-y`} rows={3} placeholder="写下你的行动或对白…" value={message} disabled={busy || pendingTurn !== null}
          onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
          }} />
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs ${inputTooLarge ? 'text-rose-300' : 'text-slate-500'}`}>{utf8Bytes(message)} / 8,192 字节 · Ctrl / ⌘ + Enter 发送</p>
          <button type="submit" className={primaryClass} disabled={busy || pendingTurn !== null || !message.trim() || inputTooLarge}>{busy ? '生成中…' : '发送'}</button>
        </div>
      </form>
    </div>
  </div>;
}

function Message({ author, text, user = false }: { author: string; text: string; user?: boolean }) {
  return <article className={`max-w-[92%] ${user ? 'ml-auto' : 'mr-auto'}`}>
    <h3 className={`mb-1 text-xs font-semibold text-slate-400 ${user ? 'text-right' : ''}`}>{author}</h3>
    <p className={`whitespace-pre-wrap break-words rounded-2xl border p-4 text-sm leading-7 text-slate-100 ${user ? 'border-cyan-800 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>{text}</p>
  </article>;
}
function readPending(key: string): PendingTurn | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
    if (!isRecord(saved) || typeof saved.clientTurnId !== 'string' || typeof saved.message !== 'string') return null;
    validateId(saved.clientTurnId); validateMessage(saved.message);
    return { clientTurnId: saved.clientTurnId, message: saved.message };
  } catch { return null; }
}
function storePending(key: string, pending: PendingTurn | null) {
  try { if (pending) window.sessionStorage.setItem(key, JSON.stringify(pending)); else window.sessionStorage.removeItem(key); }
  catch { /* Storage-denied browsers retain retry identity for the current mounted pane. */ }
}
