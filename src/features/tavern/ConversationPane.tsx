import { useEffect, useRef, useState } from 'react';
import { validateId, validateMessage } from './conversationInput';
import { generateStream, mutateGraph } from './tavernClient';
import { TavernApiError, type CompletedTurn, type ConversationDetail, type ConversationGraph, type GenerationAction, type GenerationRecord, type GraphMessage, type GraphMutation, type TavernModelSelection, type TavernUserModelAccess } from './types';
import { isRecord, utf8Bytes } from './validation';
import { ErrorNotice, buttonClass, inputClass, primaryClass } from './TavernUi';

interface PendingGeneration { clientActionId: string; expectedRevision: number; action: GenerationAction;
  modelBinding?: { model: string; baseUrl: string; historyBytes: 8192 | 16384 | 32768 } }

export default function ConversationPane({ detail, accountId, csrfToken, modelSelection, onCompleted, onGraphChanged }: {
  detail: ConversationDetail; accountId: string; csrfToken: string;
  modelSelection: TavernModelSelection;
  onCompleted: (completed: CompletedTurn) => void; onGraphChanged: (graph: ConversationGraph) => void;
}) {
  const storageKey = `mapflow.tavern.pending.v1.${accountId}.${detail.conversation.conversationId}`;
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(() => {
    const saved = readPending(storageKey, detail.graph.revision);
    if (saved && detail.generations.some(generation => generation.clientActionId === saved.clientActionId)) { storePending(storageKey, null); return null; }
    return saved;
  });
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [graphBusy, setGraphBusy] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAnchorId, setBranchAnchorId] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    if (followLatest.current) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [draft, detail.graph.revision, pendingGeneration]);
  useEffect(() => { setEditing(false); setEditContent(''); }, [detail.graph.revision]);
  useEffect(() => {
    if (!busy && pendingGeneration && detail.generations.some(generation => generation.clientActionId === pendingGeneration.clientActionId)) {
      setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
    }
  }, [busy, detail.generations, pendingGeneration, storageKey]);

  async function runGeneration(action: GenerationAction, retry?: PendingGeneration) {
    if (activeRequest.current || (pendingGeneration && !retry)) return;
    let outgoing: PendingGeneration;
    let modelAccess: TavernUserModelAccess | undefined;
    try {
      validateGenerationAction(action);
      if (retry?.modelBinding) {
        modelAccess = selectedUserAccess(modelSelection);
        if (!modelAccess || modelAccess.model !== retry.modelBinding.model
          || modelAccess.baseUrl !== retry.modelBinding.baseUrl
          || modelSelection.historyBytes !== retry.modelBinding.historyBytes) {
          throw new TavernApiError(400, 'tavern.model_access_required', '请重新填写本次使用的 Key 和模型，再重试。');
        }
      } else if (!retry) modelAccess = selectedUserAccess(modelSelection);
      outgoing = retry ?? { clientActionId: crypto.randomUUID(), expectedRevision: detail.graph.revision, action,
        ...(modelAccess ? { modelBinding: { model: modelAccess.model, baseUrl: modelAccess.baseUrl,
          historyBytes: modelSelection.historyBytes } } : {}) };
    } catch (failure) { setError(failure); return; }
    const controller = new AbortController();
    activeRequest.current = controller;
    // Persist before sending: a refresh between request and completed must reuse the same ID.
    storePending(storageKey, outgoing);
    setPendingGeneration(outgoing);
    if (outgoing.action.type === 'reply') setMessage('');
    setDraft(''); setBusy(true); setError(null); followLatest.current = true;
    try {
      const completed = await generateStream(detail.conversation.conversationId, outgoing.clientActionId, outgoing.expectedRevision, outgoing.action,
        csrfToken, delta => { if (!controller.signal.aborted) setDraft(previous => previous + delta); }, controller.signal,
        modelAccess, modelAccess ? modelSelection.historyBytes : undefined);
      if (controller.signal.aborted) return;
      storePending(storageKey, null);
      setPendingGeneration(null); setDraft(''); onCompleted(completed);
    } catch (failure) { if (!controller.signal.aborted) setError(failure); }
    finally { if (!controller.signal.aborted) { activeRequest.current = null; setBusy(false); } }
  }
  const inputTooLarge = Array.from(message).length > 8000 || utf8Bytes(message) > 8192;
  const mayEdit = error instanceof TavernApiError && error.status === 400;
  const pendingReply = pendingGeneration?.action.type === 'reply' ? pendingGeneration.action : null;
  const messagesById = new Map(detail.graph.messages.map(item => [item.messageId, item]));
  const activeMessages = detail.graph.activePath.flatMap(messageId => {
    const activeMessage = messagesById.get(messageId);
    return activeMessage ? [activeMessage] : [];
  });
  const displayMessages = mergeContinuationMessages(activeMessages);
  const activeLeaf = activeMessages[activeMessages.length - 1];
  const branchAnchors = activeMessages.filter(item => item.role === 'assistant');
  const selectedBranchAnchorId = branchAnchors.some(item => item.messageId === branchAnchorId)
    ? branchAnchorId : activeLeaf?.role === 'assistant' ? activeLeaf.messageId : '';
  const activeLeafParent = activeLeaf?.parentMessageId ? messagesById.get(activeLeaf.parentMessageId) : undefined;
  const canReviseAssistant = activeLeaf?.role === 'assistant' && activeLeafParent?.role === 'user';
  const canContinueAssistant = activeLeaf?.role === 'assistant' && activeLeaf.origin !== 'opening';
  const alternatives = activeLeaf?.role === 'assistant'
    ? orderAlternatives(
      detail.graph.messages.filter(item => item.role === 'assistant' && item.parentMessageId === activeLeaf.parentMessageId),
      detail.generations,
    )
    : [];
  const activeAlternativeIndex = alternatives.findIndex(item => item.messageId === activeLeaf?.messageId);

  async function applyGraphMutation(action: GraphMutation): Promise<boolean> {
    if (graphBusy) return false;
    try {
      setGraphBusy(true); setError(null);
      const graph = await mutateGraph(detail.conversation.conversationId, detail.graph.revision, action, csrfToken);
      onGraphChanged(graph);
      return true;
    } catch (failure) { setError(failure); return false; }
    finally { setGraphBusy(false); }
  }

  async function saveEdit() {
    if (!activeLeaf || graphBusy) return;
    try {
      validateMessage(editContent);
      await applyGraphMutation({
        type: 'edit', messageId: activeLeaf.messageId, replacementContent: editContent,
      });
    } catch (failure) { setError(failure); }
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={pane} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" onScroll={() => {
      const container = pane.current;
      if (container) followLatest.current = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    }}>
      {displayMessages.map(activeMessage => <Message key={activeMessage.messageId}
        author={activeMessage.role === 'user' ? detail.conversation.userName : activeMessage.role === 'system' ? '系统' : detail.character.card.name}
        text={activeMessage.content} user={activeMessage.role === 'user'} />)}
      {pendingGeneration && <div className="space-y-5">
        {pendingReply && <Message author={detail.conversation.userName} text={pendingReply.message} user />}
        {draft && <Message author={detail.character.card.name} text={draft} />}
        <p role="status" className="text-xs text-cyan-300">{busy ? '正在生成，完成后保存…' : '这条消息尚未确认完成，请重试以核对结果。'}</p>
      </div>}
      {!activeMessages.length && !pendingGeneration && <p className="py-12 text-center text-sm text-slate-400">故事从你的第一句话开始。</p>}
      <div ref={bottom} />
    </div>
    <div className="shrink-0 space-y-3 border-t border-slate-800 bg-slate-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ErrorNotice error={error} />
      {alternatives.length > 1 && <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <button type="button" className={buttonClass} disabled={graphBusy || activeAlternativeIndex <= 0}
          onClick={() => void applyGraphMutation({ type: 'select_alternative', assistantMessageId: alternatives[activeAlternativeIndex - 1].messageId })}>上一个回复</button>
        <span>{activeAlternativeIndex + 1} / {alternatives.length}</span>
        <button type="button" className={buttonClass} disabled={graphBusy || activeAlternativeIndex < 0 || activeAlternativeIndex >= alternatives.length - 1}
          onClick={() => void applyGraphMutation({ type: 'select_alternative', assistantMessageId: alternatives[activeAlternativeIndex + 1].messageId })}>下一个回复</button>
      </div>}
      <details className="rounded-xl border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">历史与分支</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-400">当前分支
            <select aria-label="当前分支" className={`${inputClass} mt-1`} value={detail.graph.activeBranchId} disabled={graphBusy}
              onChange={event => void applyGraphMutation({ type: 'select_branch', branchId: event.target.value })}>
              {detail.graph.branches.filter(branch => branch.kind !== 'checkpoint').map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">分支起点
            <select aria-label="分支起点" className={`${inputClass} mt-1`} value={selectedBranchAnchorId} disabled={graphBusy || branchAnchors.length === 0}
              onChange={event => setBranchAnchorId(event.target.value)}>
              {branchAnchors.map((message, index) => <option key={message.messageId} value={message.messageId}>
                {index + 1}. {message.content.trim().slice(0, 48) || '空白开场'}
              </option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">分支或检查点名称
            <input aria-label="分支或检查点名称" className={`${inputClass} mt-1`} maxLength={200} value={branchName} disabled={graphBusy}
              onChange={event => setBranchName(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={!selectedBranchAnchorId || graphBusy || !branchName.trim()} onClick={() => {
              if (selectedBranchAnchorId) void applyGraphMutation({ type: 'create_branch', anchorMessageId: selectedBranchAnchorId, name: branchName.trim(), activate: true });
            }}>创建分支</button>
            <button type="button" className={buttonClass} disabled={!selectedBranchAnchorId || graphBusy || !branchName.trim()} onClick={() => {
              if (selectedBranchAnchorId) void applyGraphMutation({ type: 'create_checkpoint', anchorMessageId: selectedBranchAnchorId, name: branchName.trim() });
            }}>保存检查点</button>
          </div>
          {detail.graph.branches.some(branch => branch.kind === 'checkpoint') && <div className="text-xs text-slate-400">
            <p className="font-semibold text-slate-300">检查点</p>
            <ul className="mt-1 space-y-1">{detail.graph.branches.filter(branch => branch.kind === 'checkpoint').map(branch => <li key={branch.branchId} className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words">{branch.name}</span>
              <button type="button" className={buttonClass} aria-label={`从${branch.name}回档`} disabled={graphBusy || !branch.leafMessageId}
                onClick={() => { if (branch.leafMessageId) void applyGraphMutation({ type: 'create_branch', anchorMessageId: branch.leafMessageId,
                  name: `${branch.name.slice(0, 190)} · 回档`, activate: true }); }}>回档</button>
            </li>)}</ul>
          </div>}
        </div>
      </details>
      {editing && activeLeaf && <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <label htmlFor={`tavern-edit-${activeLeaf.messageId}`} className="text-xs font-semibold text-slate-300">编辑消息内容</label>
        <textarea id={`tavern-edit-${activeLeaf.messageId}`} aria-label="编辑消息内容" className={`${inputClass} max-h-48 resize-y`} rows={3}
          value={editContent} disabled={graphBusy} onChange={event => setEditContent(event.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass} disabled={graphBusy} onClick={() => { setEditing(false); setEditContent(''); }}>取消</button>
          <button type="button" className={primaryClass} disabled={graphBusy || !editContent.trim()} onClick={() => void saveEdit()}>{graphBusy ? '保存中…' : '保存编辑'}</button>
        </div>
      </div>}
      {pendingGeneration && !busy && <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryClass} onClick={() => void runGeneration(pendingGeneration.action, pendingGeneration)}>重试这条消息</button>
        {mayEdit && pendingReply && <button type="button" className={buttonClass} onClick={() => {
          setMessage(pendingReply.message); setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>编辑消息</button>}
        <button type="button" className={buttonClass} onClick={() => {
          setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>取消本次重试</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void runGeneration({ type: 'reply', message }); }} className="space-y-2">
        <label htmlFor={`tavern-message-${detail.conversation.conversationId}`} className="sr-only">消息</label>
        <textarea id={`tavern-message-${detail.conversation.conversationId}`} className={`${inputClass} max-h-48 resize-y`} rows={3} placeholder="写下你的行动或对白…" value={message} disabled={busy || pendingGeneration !== null}
          onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void runGeneration({ type: 'reply', message }); }
          }} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" className={buttonClass} disabled={!canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
              onClick={() => { if (canReviseAssistant && activeLeaf) { setEditContent(activeLeaf.content); setEditing(true); setError(null); } }}>编辑当前消息</button>
            <button type="button" className={buttonClass} disabled={!canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
              onClick={() => { if (canReviseAssistant && activeLeaf) void runGeneration({ type: 'regenerate', assistantMessageId: activeLeaf.messageId }); }}>重新生成</button>
            <button type="button" className={buttonClass} disabled={!canContinueAssistant || busy || graphBusy || pendingGeneration !== null || editing}
              onClick={() => { if (canContinueAssistant && activeLeaf) void runGeneration({ type: 'continue', assistantMessageId: activeLeaf.messageId }); }}>继续</button>
            <p className={`truncate text-xs ${inputTooLarge ? 'text-rose-300' : 'text-slate-500'}`}>{utf8Bytes(message)} / 8,192 字节 · Ctrl / ⌘ + Enter 发送</p>
          </div>
          <button type="submit" className={primaryClass} disabled={busy || graphBusy || pendingGeneration !== null || !message.trim() || inputTooLarge}>{busy ? '生成中…' : '发送'}</button>
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
function mergeContinuationMessages(messages: GraphMessage[]): GraphMessage[] {
  return messages.reduce<GraphMessage[]>((display, message) => {
    const previous = display[display.length - 1];
    if (message.role === 'assistant' && message.origin === 'continue' && previous?.role === 'assistant') {
      return [...display.slice(0, -1), { ...previous, content: `${previous.content}\n${message.content}` }];
    }
    return [...display, message];
  }, []);
}

function orderAlternatives(messages: GraphMessage[], generations: GenerationRecord[]): GraphMessage[] {
  const generationOrder = new Map(generations.map((generation, index) => [generation.outputMessageId, index]));
  return [...messages].sort((left, right) => {
    const leftOrder = generationOrder.get(left.messageId);
    const rightOrder = generationOrder.get(right.messageId);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.messageId.localeCompare(right.messageId);
  });
}

function validateGenerationAction(action: GenerationAction) {
  if (action.type === 'reply') validateMessage(action.message);
  else validateId(action.assistantMessageId);
}

function readPending(key: string, currentRevision: number): PendingGeneration | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
    if (!isRecord(saved)) return null;
    if (typeof saved.clientActionId === 'string' && isGenerationAction(saved.action)) {
      validateId(saved.clientActionId); validateGenerationAction(saved.action);
      const expectedRevision = typeof saved.expectedRevision === 'number' && Number.isSafeInteger(saved.expectedRevision) && saved.expectedRevision >= 0
        ? saved.expectedRevision : currentRevision;
      const modelBinding = isRecord(saved.modelBinding) && typeof saved.modelBinding.model === 'string'
        && typeof saved.modelBinding.baseUrl === 'string'
        && [8192, 16384, 32768].includes(Number(saved.modelBinding.historyBytes))
        ? { model: saved.modelBinding.model, baseUrl: saved.modelBinding.baseUrl,
          historyBytes: Number(saved.modelBinding.historyBytes) as 8192 | 16384 | 32768 } : undefined;
      if (saved.modelBinding !== undefined && !modelBinding) return null;
      return { clientActionId: saved.clientActionId, expectedRevision, action: saved.action,
        ...(modelBinding ? { modelBinding } : {}) };
    }
    // Read the previous reply-only shape so an in-flight turn survives this frontend upgrade.
    if (typeof saved.clientTurnId === 'string' && typeof saved.message === 'string') {
      validateId(saved.clientTurnId); validateMessage(saved.message);
      return { clientActionId: saved.clientTurnId, expectedRevision: currentRevision, action: { type: 'reply', message: saved.message } };
    }
    return null;
  } catch { return null; }
}

function selectedUserAccess(selection: TavernModelSelection): TavernUserModelAccess | undefined {
  if (selection.provider === 'platform') return undefined;
  const apiKey = selection.apiKey.trim();
  const model = selection.model.trim();
  const baseUrl = selection.baseUrl.trim();
  if (!apiKey || !model || !/^https:\/\/[^\s]+\/v1\/?$/u.test(baseUrl)) {
    throw new TavernApiError(400, 'tavern.model_access_required', '请填写 API Key、上游模型和公开 HTTPS /v1 地址。');
  }
  return { apiKey, model, baseUrl, settings: selection.provider === 'anyai' ? selection.settings : {} };
}
function isGenerationAction(value: unknown): value is GenerationAction {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'reply') return typeof value.message === 'string';
  if (value.type === 'regenerate' || value.type === 'continue') return typeof value.assistantMessageId === 'string';
  return false;
}
function storePending(key: string, pending: PendingGeneration | null) {
  try { if (pending) window.sessionStorage.setItem(key, JSON.stringify(pending)); else window.sessionStorage.removeItem(key); }
  catch { /* Storage-denied browsers retain retry identity for the current mounted pane. */ }
}
