import { useEffect, useRef, useState } from 'react';
import AssistantMarkdown from '../knowledge-chat/AssistantMarkdown';
import { validateId, validateMessage } from './conversationInput';
import { generateStream, mutateGraph, requestCashQuote, resolveTavernToolApproval } from './tavernClient';
import {formatAmountMicros} from '../wallet/walletClient';
import type {CashQuote} from './types';
import { TavernApiError, type CompletedTurn, type ConversationDetail, type ConversationGraph, type GenerationAction, type GenerationRecord, type GraphMessage, type GraphMutation, type TavernModelSelection, type TavernUserModelAccess } from './types';
import { isRecord, utf8Bytes } from './validation';
import { CharacterAvatar, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass, type TavernDialogSection } from './TavernUi';
import type { Character } from './types';

interface PendingGeneration { clientActionId: string; expectedRevision: number; action: GenerationAction;
  billing?:CashQuote;
  platformBinding?: { model: string; historyBytes: 8192 | 16384 | 32768 };
  modelBinding?: { model: string; baseUrl: string; historyBytes: 8192 | 16384 | 32768 } }

export default function ConversationPane({ detail, accountId, csrfToken, modelSelection, onCompleted, onGraphChanged, configurationOpen, configurationSection, onOpenModelConfiguration, onNavigateWallet, onCloseConfiguration, configuration }: {
  detail: ConversationDetail; accountId: string; csrfToken: string;
  modelSelection: TavernModelSelection;
  onCompleted: (completed: CompletedTurn) => void; onGraphChanged: (graph: ConversationGraph) => void;
  configurationOpen: boolean; onCloseConfiguration: () => void; configuration: TavernDialogSection[];
  configurationSection?: string; onOpenModelConfiguration: () => void; onNavigateWallet?: () => void;
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
    if (activeRequest.current || graphBusy || editing || (pendingGeneration && !retry)) return;
    let outgoing: PendingGeneration;
    let platformModel: string | undefined;
    let modelAccess: TavernUserModelAccess | undefined;
    try {
      validateGenerationAction(action);
      if (retry?.platformBinding || (!retry && modelSelection.provider === 'platform')) {
        if (modelSelection.provider !== 'platform' || !modelSelection.model.trim()) {
          throw new TavernApiError(400, 'tavern.platform_model_required', '请选择可用的平台模型；如果列表为空，请联系管理员配置 AnyAI。');
        }
        platformModel = modelSelection.model;
        if (retry?.platformBinding && (platformModel !== retry.platformBinding.model || modelSelection.historyBytes !== retry.platformBinding.historyBytes)) {
          throw new TavernApiError(400, 'tavern.platform_model_required', '请恢复本次使用的平台模型和历史上下文，再重试。');
        }
      } else if (retry?.modelBinding) {
        modelAccess = selectedUserAccess(modelSelection);
        if (!modelAccess || modelAccess.model !== retry.modelBinding.model
          || modelAccess.baseUrl !== retry.modelBinding.baseUrl
          || modelSelection.historyBytes !== retry.modelBinding.historyBytes) {
          throw new TavernApiError(400, 'tavern.model_access_required', '请重新填写本次使用的 Key 和模型，再重试。');
        }
      } else if (!retry) modelAccess = selectedUserAccess(modelSelection);
      outgoing = retry ?? { clientActionId: crypto.randomUUID(), expectedRevision: detail.graph.revision, action,
        ...(platformModel ? { platformBinding: { model: platformModel, historyBytes: modelSelection.historyBytes } } : {}),
        ...(modelAccess ? { modelBinding: { model: modelAccess.model, baseUrl: modelAccess.baseUrl,
          historyBytes: modelSelection.historyBytes } } : {}) };
    } catch (failure) { setError(failure); return; }
    const controller = new AbortController();
    activeRequest.current = controller;
    if (platformModel && modelSelection.billingPolicy && !outgoing.billing) {
      setBusy(true);setError(null);
      try {
        const quote=await requestCashQuote(detail.conversation.conversationId,outgoing.expectedRevision,outgoing.action,
          platformModel,modelSelection.historyBytes,csrfToken,controller.signal);
        if (controller.signal.aborted) return;
        outgoing = { ...outgoing, billing: quote };
      } catch (failure) {
        if (!controller.signal.aborted) { setError(failure); activeRequest.current = null; setBusy(false); }
        return;
      }
    }
    // Persist before sending: a refresh between request and completed must reuse the same ID.
    storePending(storageKey, outgoing);
    setPendingGeneration(outgoing);
    if (outgoing.action.type === 'reply') setMessage('');
    setDraft(''); setBusy(true); setError(null); followLatest.current = true;
    try {
      const completed = await generateStream(detail.conversation.conversationId, outgoing.clientActionId, outgoing.expectedRevision, outgoing.action,
        csrfToken, delta => { if (!controller.signal.aborted) setDraft(previous => previous + delta); }, controller.signal,
        modelAccess, modelAccess || platformModel ? modelSelection.historyBytes : undefined, platformModel,outgoing.billing,
        async approval => {
          const prompt=approval.destructive ? `请单独确认：${approval.action}（${approval.target}）。确认后才会执行。` : `确认${approval.action}（${approval.target}）？`;
          const allowed=!controller.signal.aborted && window.confirm(prompt);
          await resolveTavernToolApproval(detail.conversation.conversationId,approval.approvalRequestId,allowed,allowed && approval.destructive,csrfToken);
        });
      if (controller.signal.aborted) return;
      storePending(storageKey, null);
      setPendingGeneration(null); setDraft(''); onCompleted(completed);
    } catch (failure) { if (!controller.signal.aborted) {
      if (failure instanceof TavernApiError && failure.code==='tavern.cash_quote_expired') {
        const renewed={...outgoing,billing:undefined};setPendingGeneration(renewed);storePending(storageKey,renewed);
      }
      setError(failure);
    } }
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
    <div ref={pane} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8" onScroll={() => {
      const container = pane.current;
      if (container) followLatest.current = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    }}>
      {displayMessages.map(activeMessage => <div key={activeMessage.messageId}><Message
        author={activeMessage.role === 'user' ? detail.conversation.userName : activeMessage.role === 'system' ? '系统' : detail.character.card.name}
        character={activeMessage.role === 'assistant' ? detail.character : undefined}
        text={activeMessage.content} user={activeMessage.role === 'user'} />
        {(detail.cashCharges??[]).filter(charge=>charge.outputMessageId===activeMessage.messageId
          || activeMessages.some(message=>message.messageId===charge.outputMessageId && message.origin==='continue' &&
            continuationRoot(message,messagesById)===activeMessage.messageId)).map(charge=> {
            const usage=detail.turns.find(turn=>turn.turnId===charge.generationId)?.usage;
            return <p key={charge.generationId} className="mx-auto -mt-4 mb-6 max-w-3xl pl-14 text-xs text-slate-400">
              {usage&&<>输入 {usage.inputTokens} · 输出 {usage.outputTokens} Token · </>}
              本次费用 ¥{formatAmountMicros(charge.amountMicros)} · 现金余额 ¥{formatAmountMicros(charge.balanceAfterMicros)}
              {charge.capped&&' · 已按预留上限结算'}
            </p>;
          })}</div>)}
      {activeLeaf && activeLeaf.origin !== 'opening' && <div aria-label="回复操作" className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center gap-1 pl-14 text-xs text-slate-500">
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={!canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canReviseAssistant) { setEditContent(activeLeaf.content); setEditing(true); setError(null); } }}>编辑当前消息</button>
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={!canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canReviseAssistant) void runGeneration({ type: 'regenerate', assistantMessageId: activeLeaf.messageId }); }}>重新生成</button>
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={!canContinueAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canContinueAssistant) void runGeneration({ type: 'continue', assistantMessageId: activeLeaf.messageId }); }}>继续</button>
      </div>}
      {pendingGeneration && <div className="space-y-5">
        {pendingReply && <Message author={detail.conversation.userName} text={pendingReply.message} user />}
        {draft && <Message author={detail.character.card.name} character={detail.character} text={draft} />}
        <p role="status" className="text-xs text-cyan-300">{busy ? '正在生成，完成后保存…' : '这条消息尚未确认完成，请重试以核对结果。'}</p>
      </div>}
      {!activeMessages.length && !pendingGeneration && <p className="py-12 text-center text-sm text-slate-400">故事从你的第一句话开始。</p>}
      <div ref={bottom} />
    </div>
    <div className="mx-auto w-full max-w-4xl shrink-0 space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-8">
      <ErrorNotice error={error} />
      {error instanceof TavernApiError && ['tavern.model_access_required', 'tavern.model_access_invalid',
        'tavern.platform_model_required', 'tavern.runtime_unavailable', 'generation.model_access_invalid',
        'tavern.user_model_authentication', 'tavern.user_model_balance', 'tavern.user_model_timeout',
        'tavern.user_model_rejected', 'tavern.model_configuration_required', 'tavern.platform_trial_unavailable',
        'tavern.platform_trial_rejected', 'tavern.cash_billing_unavailable'].includes(error.code)
        && <button type="button" className={buttonClass} onClick={onOpenModelConfiguration}>填写 API Key 或使用平台额度</button>}
      {error instanceof TavernApiError && error.code === 'tavern.cash_insufficient' && onNavigateWallet
        && <button type="button" className={buttonClass} onClick={onNavigateWallet}>充值平台额度</button>}
      {error instanceof TavernApiError && error.code === 'tavern.runtime_unavailable' && <p className="text-xs leading-5 text-slate-400">
        模型连接暂不可用。请稍后重试，或取消本次重试返回编辑；不会使用模拟回复替代模型。
      </p>}
      {alternatives.length > 1 && <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <button type="button" className={buttonClass} disabled={graphBusy || activeAlternativeIndex <= 0}
          onClick={() => void applyGraphMutation({ type: 'select_alternative', assistantMessageId: alternatives[activeAlternativeIndex - 1].messageId })}>上一个回复</button>
        <span>{activeAlternativeIndex + 1} / {alternatives.length}</span>
        <button type="button" className={buttonClass} disabled={graphBusy || activeAlternativeIndex < 0 || activeAlternativeIndex >= alternatives.length - 1}
          onClick={() => void applyGraphMutation({ type: 'select_alternative', assistantMessageId: alternatives[activeAlternativeIndex + 1].messageId })}>下一个回复</button>
      </div>}
      {configurationOpen && <TavernDialog title="配置" initialSection={configurationSection} onClose={onCloseConfiguration} sections={[...configuration, {
        id: 'branches', label: '历史与分支', content: <section>
        <h3 className="text-sm font-semibold text-slate-300">历史与分支</h3>
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
        </section>,
      }]} />}
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
          if (pendingReply) setMessage(pendingReply.message);
          setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>取消本次重试</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void runGeneration({ type: 'reply', message }); }} className="rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-lg transition focus-within:border-cyan-500/70">
        <label htmlFor={`tavern-message-${detail.conversation.conversationId}`} className="sr-only">消息</label>
        <textarea id={`tavern-message-${detail.conversation.conversationId}`} className="max-h-48 min-h-16 w-full resize-y border-0 bg-transparent px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50" rows={2} placeholder="写下你的行动或对白…" value={message} disabled={busy || graphBusy || pendingGeneration !== null || editing}
          onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault(); if (message.trim() && !inputTooLarge) void runGeneration({ type: 'reply', message });
            }
          }} />
        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <p className={`text-[11px] ${inputTooLarge ? 'text-rose-300' : 'text-slate-500'}`}><span className="hidden sm:inline">Enter 发送 · Shift+Enter 换行</span>{inputTooLarge && '消息过长（上限 8,192 字节）'}</p>
          <button type="submit" className={primaryClass} disabled={busy || graphBusy || editing || pendingGeneration !== null || !message.trim() || inputTooLarge}>{busy ? '生成中…' : '发送'}</button>
        </div>
      </form>
    </div>
  </div>;
}

function Message({ author, text, user = false, character }: { author: string; text: string; user?: boolean; character?: Character }) {
  return <article className={`mx-auto mb-6 flex max-w-3xl gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4 ${user ? 'bg-slate-800/40' : ''}`}>
    <CharacterAvatar character={character} name={author} />
    <div className="min-w-0 flex-1"><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">{author}<span className="text-[10px] font-normal tracking-wider text-slate-500">{user ? '你' : '角色'}</span></h3>
    <div className="text-[15px] leading-7 text-slate-200 [overflow-wrap:anywhere] [&_em]:text-slate-400 [&_p+p]:mt-3"><AssistantMarkdown content={text} /></div></div>
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
      const platformBinding = isRecord(saved.platformBinding) && typeof saved.platformBinding.model === 'string'
        && saved.platformBinding.model.trim() && [8192, 16384, 32768].includes(Number(saved.platformBinding.historyBytes))
        ? { model: saved.platformBinding.model, historyBytes: Number(saved.platformBinding.historyBytes) as 8192 | 16384 | 32768 } : undefined;
      if ((saved.modelBinding !== undefined && !modelBinding) || (saved.platformBinding !== undefined && !platformBinding) || (modelBinding && platformBinding)) return null;
      return { clientActionId: saved.clientActionId, expectedRevision, action: saved.action,
        ...(isRecord(saved.billing) && typeof saved.billing.quoteId==='string' && saved.billing.policyVersion==='cash-v1-actual-x2'
          && typeof saved.billing.maximumChargeMicros==='number' && Number.isSafeInteger(saved.billing.maximumChargeMicros) && saved.billing.maximumChargeMicros>=0
          ?{billing:saved.billing as unknown as CashQuote}:{}),
        ...(modelBinding ? { modelBinding } : {}), ...(platformBinding ? { platformBinding } : {}) };
    }
    // Read the previous reply-only shape so an in-flight turn survives this frontend upgrade.
    if (typeof saved.clientTurnId === 'string' && typeof saved.message === 'string') {
      validateId(saved.clientTurnId); validateMessage(saved.message);
      return { clientActionId: saved.clientTurnId, expectedRevision: currentRevision, action: { type: 'reply', message: saved.message } };
    }
    return null;
  } catch { return null; }
}
function continuationRoot(message:GraphMessage,messages:Map<string,GraphMessage>):string {
  let root=message;
  for (let count=0;count<messages.size && root.origin==='continue' && root.parentMessageId;count++) {
    const parent=messages.get(root.parentMessageId);if (!parent) break;root=parent;
  }
  return root.messageId;
}
function selectedUserAccess(selection: TavernModelSelection): TavernUserModelAccess | undefined {
  if (selection.provider === 'platform') {
    throw new TavernApiError(400, 'tavern.model_access_required', '请切换回本次使用的自填 API Key 线路，再重试。');
  }
  const apiKey = selection.apiKey.trim();
  const model = selection.model.trim();
  const baseUrl = selection.baseUrl.trim();
  if (!apiKey) {
    throw new TavernApiError(400, 'tavern.model_access_required', '尚未填写 API Key，请打开“配置 → 模型接入”填写后再发送。历史会话仍可查看。');
  }
  if (!baseUrl) {
    throw new TavernApiError(400, 'tavern.model_access_required', '尚未填写 API URL，请在“配置 → 模型接入”填写中转站地址。');
  }
  if (!/^https:\/\/[^\s]+\/v1\/?$/u.test(baseUrl)) {
    throw new TavernApiError(400, 'tavern.model_access_required', 'API URL 必须是公开 HTTPS 地址，并以 /v1 结尾。');
  }
  if (!model) {
    throw new TavernApiError(400, 'tavern.model_access_required', '尚未填写上游模型，请在“配置 → 模型接入”填写模型 ID。');
  }
  return { apiKey, model, baseUrl, settings: {} };
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
