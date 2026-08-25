import { useEffect, useRef, useState } from 'react';
import {
  resetKnowledgeChat,
  sendKnowledgeChatMessageStream,
} from './knowledgeChatClient';
import type { KnowledgeChatMessage } from './types';
import AssistantMarkdown from './AssistantMarkdown';

const MAX_MESSAGE_CHARACTERS = 4_000;

interface KnowledgeChatPanelProps {
  treeTitle: string;
  libraryEntryId: string;
  csrfToken: string;
  onClose: () => void;
}

export default function KnowledgeChatPanel({
  treeTitle,
  libraryEntryId,
  csrfToken,
  onClose,
}: KnowledgeChatPanelProps) {
  const [messages, setMessages] = useState<KnowledgeChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCharge, setLastCharge] = useState<number | null>(null);
  const [remainingUnits, setRemainingUnits] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messagesEnd = messagesEndRef.current;
    if (messagesEnd && typeof messagesEnd.scrollIntoView === 'function') {
      messagesEnd.scrollIntoView({ block: 'nearest' });
    }
  }, [messages, pending, streamingAnswer]);

  async function handleSubmit() {
    const message = draft.trim();
    if (!message || pending || resetPending) return;

    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', content: message },
    ]);
    setDraft('');
    setError(null);
    setLastCharge(null);
    setStreamingAnswer('');
    setPending(true);

    try {
      const response = await sendKnowledgeChatMessageStream(
        libraryEntryId,
        message,
        createTurnId(),
        csrfToken,
        (delta) => {
          setStreamingAnswer((current) => (current ?? '') + delta);
        },
      );
      setMessages((current) => [
        ...current,
        { id: createMessageId(), role: 'assistant', content: response.answer },
      ]);
      setStreamingAnswer(null);
      setLastCharge(response.chargedCredits);
      setRemainingUnits(response.sandboxRemainingUnits);
    } catch (caught: unknown) {
      setStreamingAnswer(null);
      setError(caught instanceof Error ? caught.message : '知识聊天暂时不可用，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  async function handleReset() {
    if (pending || resetPending) return;
    setResetPending(true);
    setError(null);
    try {
      await resetKnowledgeChat(libraryEntryId, csrfToken);
      setMessages([]);
      setDraft('');
      setStreamingAnswer(null);
      setLastCharge(null);
      setRemainingUnits(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '重置对话失败，请稍后重试。');
    } finally {
      setResetPending(false);
    }
  }

  return (
    <section
      data-testid="knowledge-chat-panel-content"
      className="flex min-h-0 w-full flex-1 flex-col border-l border-slate-800 bg-slate-950/95"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button
          type="button"
          aria-label="返回节点详情"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-400/60 hover:text-white"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-100">知识聊天 Agent</h2>
          <p className="mt-1 truncate text-xs text-slate-500">当前树：{treeTitle}</p>
        </div>
        <button
          type="button"
          aria-label="重置对话"
          onClick={() => void handleReset()}
          disabled={pending || resetPending}
          className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-cyan-400/60 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-50"
        >
          {resetPending ? '重置中…' : '重置'}
        </button>
      </header>

      <div
        ref={messagesEndRef}
        data-testid="knowledge-chat-messages"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && !pending ? (
          <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4 text-sm leading-6 text-slate-400">
            <p className="font-semibold text-cyan-200">只读知识助手</p>
            <p className="mt-2">
              我会读取这棵个人技能树的节点、目标和前置关系；需要补充资料时，只会进行只读网站搜索。
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-message-role={message.role}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`min-w-0 max-w-[94%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'whitespace-pre-wrap rounded-br-md bg-cyan-300 text-slate-950'
                    : 'rounded-bl-md border border-slate-800 bg-slate-900 text-slate-200'
                }`}
              >
                {message.role === 'assistant' ? (
                  <AssistantMarkdown content={message.content} />
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))
        )}
        {streamingAnswer !== null && streamingAnswer && (
          <div className="flex justify-start" data-message-role="assistant">
            <div className="min-w-0 max-w-[94%] rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm leading-6 text-slate-200 shadow-sm">
              <AssistantMarkdown content={streamingAnswer} />
            </div>
          </div>
        )}
        {pending && !streamingAnswer && (
          <div className="flex justify-start" aria-label="正在生成回答">
            <div className="rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-500">
              正在思考…
            </div>
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {error && (
        <div role="alert" className="mx-4 mb-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-200">
          {error}
        </div>
      )}

      {lastCharge !== null && (
        <p className="mx-4 mb-2 text-xs text-emerald-300">
          本次测试消耗 {formatCredits(lastCharge)} 积分
        </p>
      )}
      {remainingUnits !== null && (
        <p className="mx-4 mb-2 text-xs text-slate-500">
          沙箱剩余 {formatSandboxCredits(remainingUnits)} 积分
        </p>
      )}

      <form
        data-testid="knowledge-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
        className="shrink-0 border-t border-slate-800 p-3 pb-[env(safe-area-inset-bottom)]"
      >
        <label htmlFor="knowledge-chat-input" className="sr-only">
          输入问题
        </label>
        <textarea
          id="knowledge-chat-input"
          aria-label="输入问题"
          value={draft}
          maxLength={MAX_MESSAGE_CHARACTERS}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="问问这棵技能树…"
          rows={3}
          disabled={pending || resetPending}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 disabled:cursor-wait disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-600">
            {draft.length}/{MAX_MESSAGE_CHARACTERS} · Shift+Enter 换行
          </span>
          <button
            type="submit"
            aria-label="发送"
            disabled={pending || resetPending || !draft.trim()}
            className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? '生成中…' : '发送'}
          </button>
        </div>
      </form>
    </section>
  );
}

function createMessageId(): string {
  return `message-${createTurnId()}`;
}

function createTurnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCredits(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, '');
}

function formatSandboxCredits(units: number): string {
  return formatCredits(units / 10);
}
