import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { conversationRun, type PendingGeneration } from './conversationRuns';
import {agentConversationRun} from '../assistant/agentConversationRun';
import {AgentApiError} from '../assistant/agentExecutionClient';
import type {AgentConversationOptions} from '../assistant/agentConversationOptions';
import AgentMapResults from '../assistant/AgentMapResults';
import { approvalSummary } from './approvalSummary';
import { messageAuthors } from './messageAuthors';
import { useTeachingCanvas } from './useTeachingCanvas';
import './teachingWorkspace.css';
import PanelResizeHandle from './PanelResizeHandle';
import GenerationProcess from './GenerationProcess';
import { StreamingPresentation } from './streamingPresentation';
import type { GenerationProcessEvent } from './types';
const TeachingCanvasPanel = lazy(() => import('./TeachingCanvasPanel'));
import AssistantMarkdown from '../knowledge-chat/AssistantMarkdown';
import useIsMobile from '../../lib/useIsMobile';
import { validateId, validateMessage } from './conversationInput';
import { fetchConversation, generateStream, mutateGraph, resolveTavernToolApproval } from './tavernClient';
import {formatAmountMicros} from '../wallet/walletClient';
import type { CashQuote } from './types';
import { TavernApiError, type CompletedTurn, type ConversationDetail, type ConversationGraph, type GenerationAction, type GenerationRecord, type GraphMessage, type GraphMutation, type TavernModelSelection, type TavernUserModelAccess } from './types';
import { isRecord, utf8Bytes } from './validation';
import { CharacterAvatar, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass, type TavernDialogSection } from './TavernUi';
import type { Character } from './types';

export default function ConversationPane({ detail, accountId, csrfToken, modelSelection, platformModelError, onBusyChange, onCompleted, onRecovered, onGraphChanged, configurationOpen, configurationSection, onOpenModelConfiguration, onOpenParameters, onNavigateWallet, onCloseConfiguration, configuration, nodeReference, onNodeReferenceConsumed, mapVisible, onOpenCanvas, readOnly = false, agentOptions }: {
  detail: ConversationDetail; accountId: string; csrfToken: string;
  modelSelection: TavernModelSelection;
  agentOptions?: AgentConversationOptions;
  platformModelError?: string;
  onBusyChange?: (busy: boolean) => void;
  onCompleted: (completed: CompletedTurn) => void; onGraphChanged: (graph: ConversationGraph) => void;
  onRecovered: (saved: ConversationDetail) => void;
  configurationOpen: boolean; onCloseConfiguration: () => void; configuration: TavernDialogSection[];
  configurationSection?: string; onOpenModelConfiguration: () => void; onNavigateWallet?: () => void;
  onOpenParameters?: () => void;
  nodeReference?: { id: string; title: string };
  mapVisible?: boolean; onOpenCanvas?: () => void;
  readOnly?: boolean;
  onNodeReferenceConsumed?: () => void;
}) {
  const storageKey = `mapflow.tavern.pending.v1.${accountId}.${detail.conversation.conversationId}`;
  const queryClient=useQueryClient();
  const run=useMemo(()=>conversationRun(queryClient,{accountId,scene:detail.conversation.scene??(detail.conversation.libraryEntryId?'learning':'tavern'),
    areaId:detail.conversation.learningAreaId??null,conversationId:detail.conversation.conversationId},()=>{
    const saved = agentOptions ? null : readPending(storageKey, detail.graph.revision);
    if (saved && detail.generations.some(generation => generation.clientActionId === saved.clientActionId)) { storePending(storageKey, null); return null; }
    return saved;
  }),[queryClient,storageKey,detail.conversation.scene,detail.conversation.learningAreaId]);
  const legacySnapshot=useSyncExternalStore(agentOptions?noSubscription:run.subscribe,run.getSnapshot,run.getSnapshot);
  const nativeRun=useMemo(()=>agentConversationRun(queryClient,accountId,detail.conversation.conversationId),[queryClient,accountId,detail.conversation.conversationId]);
  const nativeSnapshot=useSyncExternalStore<ReturnType<typeof nativeRun.getSnapshot>|null>(agentOptions?nativeRun.subscribe:noSubscription,agentOptions?nativeRun.getSnapshot:noSnapshot,noSnapshot);
  const {pendingGeneration,draft,process,stopped,busy,error}=nativeSnapshot??legacySnapshot;
  const canvasPreview=agentOptions?nativeSnapshot?.canvasPreview??null:legacySnapshot.canvasPreview;
  const setPendingGeneration=(pendingGeneration:PendingGeneration|null)=>{if(agentOptions){if(pendingGeneration===null)nativeRun.dismiss();}else run.set({pendingGeneration});};
  const setDraft=(draft:string)=>run.set({draft});
  const setProcess=(process:GenerationProcessEvent[])=>run.set({process});
  const setStopped=(stopped:boolean)=>run.set({stopped});
  const setBusy=(busy:boolean)=>run.set({busy});
  const setError=(error:unknown)=>agentOptions?nativeRun.rejectPreflight(error):run.set({error});
  useEffect(()=>{if(agentOptions&&nativeSnapshot?.stopRequested)void nativeRun.resumeRequestedStop(csrfToken);},[nativeRun,csrfToken,!!agentOptions,nativeSnapshot?.executionId,nativeSnapshot?.stopRequested]);
  const restoredPending = useRef(run.controller.current?null:pendingGeneration);
  const [message, setMessage] = useState('');
  const [referenceActive, setReferenceActive] = useState(!!nodeReference);
  useEffect(() => { setReferenceActive(!!nodeReference); }, [nodeReference?.id, nodeReference?.title]);
  const [recovering, setRecovering] = useState(false);
  const canvas = useTeachingCanvas(detail.conversation.conversationId, csrfToken, detail.graph.revision, detail.canvas,
    { readOnly, initiallyOpen: !detail.conversation.libraryEntryId && !readOnly && !!detail.canvas?.enabled });
  useEffect(()=>{canvas.setPreview(canvasPreview);},[canvasPreview,canvas.setPreview]);
  const mapVisibleRef = useRef(mapVisible); mapVisibleRef.current = mapVisible;
  useEffect(() => { if (mapVisible) canvas.setOpen(false); }, [mapVisible]);
  async function openTeachingCanvas() {
    onOpenCanvas?.();
    await canvas.show();
    if (mapVisibleRef.current) canvas.setOpen(false);
  }
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [graphBusy, setGraphBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy || graphBusy || pendingGeneration !== null); }, [busy, graphBusy, pendingGeneration, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const [branchName, setBranchName] = useState('');
  const [branchAnchorId, setBranchAnchorId] = useState('');
  const activeRequest = run.controller;
  const publishPreview = run.publishPreview;
  const presentationRef=run.presentation;
  const bottom = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  // 手机端输入区每多一行就少一行聊天记录，模型选择并到底部按钮行，历史字节说明收起。
  const isMobile = useIsMobile();
  const modelChipButton = <button type="button" aria-label={agentOptions ? `配置当前模型 ${agentOptions.modelLabel || modelSelection.model || ''}` : undefined} className="shrink-0 rounded-full bg-slate-800 px-3 py-1.5 text-slate-200 hover:text-cyan-200" onClick={onOpenModelConfiguration}>{agentOptions?.modelLabel||modelSelection.model || '选择模型'} · {agentOptions?agentOptions.funding==='cash'?'现金额度':agentOptions.funding==='points'?'平台积分':'自填 Key':modelSelection.provider === 'platform' ? '平台额度' : '自填 Key'}</button>;
  const followLatest = useRef(true);
  useEffect(() => {
    if (followLatest.current) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [draft, process, detail.graph.revision, pendingGeneration]);
  useEffect(() => { setEditing(false); setEditContent(''); }, [detail.graph.revision]);
  useEffect(() => {
    if (!busy && pendingGeneration && detail.generations.some(generation => generation.clientActionId === pendingGeneration.clientActionId)) {
      setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
    }
  }, [busy, detail.generations, pendingGeneration, storageKey]);
  useEffect(() => {
    if (agentOptions) return;
    const saved = restoredPending.current;
    if (!saved) return;
    const controller = new AbortController();
    void recoverSavedResult(saved, controller.signal);
    return () => controller.abort();
  }, []);
  const completedIdentity=useRef<string|null>(null);
  useEffect(()=>{
    const completed=nativeSnapshot?.completion;if(!completed||completedIdentity.current===completed.executionId)return;
    completedIdentity.current=completed.executionId;
    const action=nativeSnapshot?.completedAction;
    if(action?.type==='reply'&&referenceActive&&nodeReference&&action.message.includes(`[学习节点参考：${nodeReference.title}；节点 ID：${nodeReference.id}]`)){
      setReferenceActive(false);onNodeReferenceConsumed?.();
    }
    const controller=new AbortController();
    void fetchConversation(detail.conversation.conversationId,controller.signal).then(saved=>{
      if(!controller.signal.aborted)onRecovered(saved);
    }).catch(()=>{ /* The trusted completion remains usable if subsequent history delivery fails. */ });
    return()=>controller.abort();
  },[nativeSnapshot?.completion?.executionId,detail.conversation.conversationId]);

  async function recoverSavedResult(expected = pendingGeneration, signal?: AbortSignal): Promise<boolean> {
    if (!expected || recovering) return false;
    setRecovering(true);
    try {
      const saved = await fetchConversation(detail.conversation.conversationId, signal);
      if (!signal?.aborted && saved.generations.some(generation => generation.clientActionId === expected.clientActionId)) {
        storePending(storageKey, null); setPendingGeneration(null); setDraft(''); setProcess([]); setError(null);
        if (expected.action.type === 'reply' && referenceActive && nodeReference
          && expected.action.message.includes(`[学习节点参考：${nodeReference.title}；节点 ID：${nodeReference.id}]`)) {
          setReferenceActive(false); onNodeReferenceConsumed?.();
        }
        run.set({canvasPreview:null}); onRecovered(saved);
        return true;
      }
      const latestAttempt = saved.diagnostics?.find(record=>record.actionId===expected.clientActionId&&record.payload.type==='attempt');
      if(!signal?.aborted&&latestAttempt&&['failed','cancelled','interrupted'].includes(String(latestAttempt.payload.state))) {
        storePending(storageKey,null);setPendingGeneration(null);
        if(expected.action.type==='reply')setMessage(expected.action.message);
        run.set({canvasPreview:null});onRecovered(saved);return true;
      }
    } catch { /* Keep the original failure and request ID when recovery cannot confirm a saved result. */ }
    finally { setRecovering(false); }
    return false;
  }

  function stopGeneration() {
    if(agentOptions){void nativeRun.stop(csrfToken);return;}
    run.cancel();
    void recoverSavedResult();
  }

  async function runGeneration(action: GenerationAction, retry?: PendingGeneration) {
    if (readOnly) return;
    if (activeRequest.current || graphBusy || editing || (pendingGeneration && !retry)) return;
    if (!retry && action.type === 'reply' && referenceActive && nodeReference) {
      action = { ...action, message: `${action.message}\n\n[学习节点参考：${nodeReference.title}；节点 ID：${nodeReference.id}]` };
    }
    if(agentOptions){
      if(retry&&nativeSnapshot?.state!=='failed'&&nativeSnapshot?.state!=='stopped'){
        await nativeRun.retry(csrfToken,modelSelection.apiKey);return;
      }
      if(retry)nativeRun.dismiss();
      try{
        if(action.type!=='reply')validateId(action.assistantMessageId);
        const access=agentOptions.funding==='byok'?selectedUserAccess(modelSelection):undefined;
        if(agentOptions.funding==='byok'&&(!access||!Number.isSafeInteger(agentOptions.contextWindow)||!agentOptions.contextWindow||agentOptions.contextWindow<1))
          throw new TavernApiError(400,'tavern.model_access_required','请填写 API Key、模型和实际上下文窗口。');
        try{await canvas.flush();}catch{/* The canvas retains its manual draft and shows its own error; unrelated chat can proceed. */}
        const admitted=await nativeRun.send(action,detail.graph.revision,{funding:agentOptions.funding,
          ...(agentOptions.profileId?{profileId:agentOptions.profileId,profileVersion:agentOptions.profileVersion}:{}),
          ...(access?{modelAccess:{apiKey:access.apiKey,baseUrl:access.baseUrl,model:access.model,contextWindow:agentOptions.contextWindow!,
            maxOutputTokens:agentOptions.maxOutputTokens,reasoningProtocol:agentOptions.reasoningProtocol??'none',reasoningSupported:agentOptions.reasoningSupported??false}}:{})},csrfToken);
        if(admitted&&action.type==='reply')setMessage('');
      }catch(failure){nativeRun.rejectPreflight(failure);}
      return;
    }
    let outgoing: PendingGeneration;
    let platformModel: string | undefined;
    let modelAccess: TavernUserModelAccess | undefined;
    try {
      validateGenerationAction(action);
      if (retry?.platformBinding || (!retry && modelSelection.provider === 'platform')) {
        if (platformModelError) throw new TavernApiError(400, 'tavern.platform_model_required', platformModelError);
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
    run.begin(controller,detail.graph.activeBranchId,outgoing.clientActionId);
    const presentation=new StreamingPresentation((answer,events)=>{
      if(!controller.signal.aborted){setDraft(answer);setProcess(events);}
    });
    presentationRef.current=presentation;
    publishPreview.current=()=>presentation.flush();
    // Persist before sending: a refresh between request and completed must reuse the same ID.
    storePending(storageKey, outgoing);
    setPendingGeneration(outgoing);
    if (outgoing.action.type === 'reply') setMessage('');
    setDraft(''); setProcess([]); setStopped(false); setBusy(true); setError(null); followLatest.current = true;
    try {
      await canvas.flush();
      const completed = await generateStream(detail.conversation.conversationId, outgoing.clientActionId, outgoing.expectedRevision, outgoing.action,
        csrfToken, delta => { if (!controller.signal.aborted) presentation.answer(delta); }, controller.signal,
        modelAccess, modelAccess || platformModel ? modelSelection.historyBytes : undefined, platformModel,
        platformModel && modelSelection.billingPolicy ? { policyVersion: modelSelection.billingPolicy } : undefined,
        async approval => {
          const prompt=approvalSummary(approval);
          const allowed=!controller.signal.aborted && run.isVisible() && window.confirm(prompt);
          await resolveTavernToolApproval(detail.conversation.conversationId,approval.approvalRequestId,allowed,allowed && approval.destructive,csrfToken);
        }, event => {
          if (controller.signal.aborted) return;
          if (event.type === 'canvas') run.set({canvasPreview:event.canvas});
          else if(event.type==='snapshot')presentation.restore(event.process);
          else if(event.type==='reasoning')presentation.reasoning(event.text);
          else if(event.type==='tool')presentation.tool(event);
        });
      await presentation.drain();
      if (controller.signal.aborted) return;
      storePending(storageKey, null);
      if (outgoing.action.type === 'reply') { setReferenceActive(false); onNodeReferenceConsumed?.(); }
      setPendingGeneration(null); setDraft(''); setProcess([]); run.set({canvasPreview:null}); onCompleted(completed);
    } catch (failure) { if (!controller.signal.aborted) {
      presentation.flush();
      if (failure instanceof TavernApiError && !failure.generationFailed && (failure.status === 0 || failure.status >= 500)
        && await recoverSavedResult(outgoing, controller.signal)) return;
      if (controller.signal.aborted) return;
      if (failure instanceof TavernApiError && failure.code==='tavern.cash_quote_expired') {
        const renewed={...outgoing,billing:undefined};setPendingGeneration(renewed);storePending(storageKey,renewed);
      }
      setError(failure); run.set({canvasPreview:null});
    } }
    finally { presentation.dispose(); if (activeRequest.current === controller) { activeRequest.current = null; publishPreview.current = null;presentationRef.current=null; setBusy(false); } }
  }
  const inputTooLarge = !agentOptions && (Array.from(message).length > 8000 || utf8Bytes(message) > 8192);
  const mayEdit = error instanceof TavernApiError && error.status === 400;
  const pendingReply = pendingGeneration?.action.type === 'reply' ? pendingGeneration.action : null;
  const generationFailed = error instanceof TavernApiError && error.generationFailed;
  const messagesById = new Map(detail.graph.messages.map(item => [item.messageId, item]));
  const activeMessages = detail.graph.activePath.flatMap(messageId => {
    const activeMessage = messagesById.get(messageId);
    return activeMessage ? [activeMessage] : [];
  });
  const roleChangeAnchors = new Set((detail.roleChanges ?? []).flatMap(change => change.afterMessageId ? [change.afterMessageId] : []));
  const displayMessages = mergeContinuationMessages(activeMessages, roleChangeAnchors);
  const historicalAuthors = messageAuthors(activeMessages, detail.roleChanges ?? [], detail.character.characterId, detail.character.card.name);
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
    if (readOnly) {
      const branch = action.type === 'select_branch' ? detail.graph.branches.find(item => item.branchId === action.branchId) : undefined;
      const leaf = branch ? branch.leafMessageId : action.type === 'select_alternative' ? action.assistantMessageId : undefined;
      if (leaf === undefined) return false;
      const byId = new Map(detail.graph.messages.map(item => [item.messageId, item]));
      const reversePath: string[] = [];
      let current = leaf;
      while (current) {
        if (reversePath.includes(current) || !byId.has(current)) return false;
        reversePath.push(current); current = byId.get(current)!.parentMessageId;
      }
      onGraphChanged({ ...detail.graph, activeBranchId: branch?.branchId ?? detail.graph.activeBranchId,
        activePath: reversePath.reverse() });
      return true;
    }
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

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            <select aria-label="分支起点" className={`${inputClass} mt-1`} value={selectedBranchAnchorId} disabled={readOnly || graphBusy || branchAnchors.length === 0}
              onChange={event => setBranchAnchorId(event.target.value)}>
              {branchAnchors.map((message, index) => <option key={message.messageId} value={message.messageId}>
                {index + 1}. {message.content.trim().slice(0, 48) || '空白开场'}
              </option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">分支或检查点名称
            <input aria-label="分支或检查点名称" className={`${inputClass} mt-1`} maxLength={200} value={branchName} disabled={readOnly || graphBusy}
              onChange={event => setBranchName(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={readOnly || !selectedBranchAnchorId || graphBusy || !branchName.trim()} onClick={() => {
              if (selectedBranchAnchorId) void applyGraphMutation({ type: 'create_branch', anchorMessageId: selectedBranchAnchorId, name: branchName.trim(), activate: true });
            }}>创建分支</button>
            <button type="button" className={buttonClass} disabled={readOnly || !selectedBranchAnchorId || graphBusy || !branchName.trim()} onClick={() => {
              if (selectedBranchAnchorId) void applyGraphMutation({ type: 'create_checkpoint', anchorMessageId: selectedBranchAnchorId, name: branchName.trim() });
            }}>保存检查点</button>
          </div>
          {detail.graph.branches.some(branch => branch.kind === 'checkpoint') && <div className="text-xs text-slate-400">
            <p className="font-semibold text-slate-300">检查点</p>
            <ul className="mt-1 space-y-1">{detail.graph.branches.filter(branch => branch.kind === 'checkpoint').map(branch => <li key={branch.branchId} className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words">{branch.name}</span>
              <button type="button" className={buttonClass} aria-label={`从${branch.name}回档`} disabled={readOnly || graphBusy || !branch.leafMessageId}
                onClick={() => { if (branch.leafMessageId) void applyGraphMutation({ type: 'create_branch', anchorMessageId: branch.leafMessageId,
                  name: `${branch.name.slice(0, 190)} · 回档`, activate: true }); }}>回档</button>
            </li>)}</ul>
          </div>}
        </div>
        </section>,
      }]} />}
    <nav aria-label="学习区" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-1.5 text-xs sm:py-2">
      <button type="button" aria-expanded={canvas.open} aria-controls={`tavern-canvas-${detail.conversation.conversationId}`} disabled={canvas.saving}
        className={`${buttonClass} ${canvas.open ? 'border-cyan-500 text-cyan-200' : ''}`} onClick={() => canvas.open ? canvas.setOpen(false) : void openTeachingCanvas()}>
        <span aria-hidden="true" className="mr-1.5">▧</span>{canvas.open ? '收起画布' : canvas.document ? '展开画布' : '绘图讲解'}</button>
      <span className="hidden text-slate-500 sm:inline">让 AI 用图形讲解，也可以自己绘制</span>
      {canvas.open && <div className="ml-auto flex gap-2 md:hidden">
        <button type="button" className={buttonClass} onClick={() => canvas.setOpen(false)}>聊天</button>
        <button type="button" className={buttonClass} disabled={readOnly} onClick={onOpenParameters ?? onOpenModelConfiguration}>模型参数</button>
      </div>}
    </nav>
    <div className="tavern-workspace">
    <div id={`tavern-canvas-${detail.conversation.conversationId}`} className="tavern-canvas" data-open={canvas.open} data-wide={canvas.wide}
      aria-hidden={!canvas.open} {...(!canvas.open ? { inert: '' } : {})}>
    {canvas.open && canvas.document && <Suspense fallback={<section aria-label="教学画布" className="flex-1 p-6" role="status">正在打开教学画布…</section>}>
      <TeachingCanvasPanel accountId={accountId} document={canvas.document} busy={busy} saving={canvas.saving} wide={canvas.wide} readOnly={readOnly}
        onSave={canvas.save} onChange={canvas.queue} onClose={() => canvas.setOpen(false)} onWidth={() => canvas.setWide(previous => !previous)} />
    </Suspense>}
    </div>
    {canvas.open&&<PanelResizeHandle label="调整画布与聊天宽度" storageKey={`mapflow.layout.canvas.${accountId}`} />}
    <div className="tavern-chat" data-canvas-open={canvas.open}>
    <div ref={pane} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8" onScroll={() => {
      const container = pane.current;
      if (container) followLatest.current = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    }}>
      {(detail.roleChanges ?? []).filter(change => change.afterMessageId === null).map(change => <p key={change.changeId} className="mx-auto mb-4 max-w-3xl text-center text-xs text-slate-500">已切换角色：{change.characterName}</p>)}
      {displayMessages.map(activeMessage => <div key={activeMessage.messageId}>
        <GenerationProcess events={detail.generations.filter(generation => generation.outputMessageId === activeMessage.messageId).flatMap(generation => generation.process ?? [])} />
        <Message
        author={activeMessage.role === 'user' ? detail.conversation.userName : activeMessage.role === 'system' ? '系统' : historicalAuthors.get(activeMessage.messageId) ?? '历史角色'}
        character={activeMessage.role === 'assistant' && activeMessage.characterId === detail.character.characterId ? detail.character : undefined}
        text={activeMessage.content} user={activeMessage.role === 'user'} />
        {(detail.cashCharges??[]).filter(charge=>charge.outputMessageId===activeMessage.messageId
          || activeMessages.some(message=>message.messageId===charge.outputMessageId && message.origin==='continue' &&
            continuationRoot(message,messagesById,roleChangeAnchors)===activeMessage.messageId)).map(charge=> {
            const usage=detail.turns.find(turn=>turn.turnId===charge.generationId)?.usage;
            return <p key={charge.generationId} className="mx-auto -mt-4 mb-6 max-w-3xl pl-14 text-xs text-slate-400">
              {usage&&<>输入 {usage.inputTokens} · 输出 {usage.outputTokens} Token · </>}
              本次费用 ¥{formatAmountMicros(charge.amountMicros)} · 现金余额 ¥{formatAmountMicros(charge.balanceAfterMicros)}
              {charge.capped&&' · 已按预留上限结算'}
            </p>;
          })}
        {(detail.roleChanges ?? []).filter(change => change.afterMessageId === activeMessage.messageId
          || activeMessages.some(message => message.origin === 'continue' && message.messageId === change.afterMessageId && continuationRoot(message, messagesById, roleChangeAnchors) === activeMessage.messageId))
          .map(change => <p key={change.changeId} className="mx-auto mb-4 max-w-3xl text-center text-xs text-slate-500">已切换角色：{change.characterName}</p>)}
      </div>)}
      {activeLeaf && activeLeaf.origin !== 'opening' && <div aria-label="回复操作" className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center gap-1 pl-14 text-xs text-slate-500">
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={readOnly || !canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canReviseAssistant) { setEditContent(activeLeaf.content); setEditing(true); setError(null); } }}>编辑当前消息</button>
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={readOnly || !canReviseAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canReviseAssistant) void runGeneration({ type: 'regenerate', assistantMessageId: activeLeaf.messageId }); }}>重新生成</button>
        <button type="button" className="rounded-lg px-2 py-1.5 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30" disabled={readOnly || !canContinueAssistant || busy || graphBusy || pendingGeneration !== null || editing}
          onClick={() => { if (canContinueAssistant) void runGeneration({ type: 'continue', assistantMessageId: activeLeaf.messageId }); }}>继续</button>
      </div>}
      {pendingGeneration && <div className="space-y-5">
        {pendingReply && <Message author={detail.conversation.userName} text={pendingReply.message} user />}
        <GenerationProcess events={process} live={busy} />
        {draft && <Message author={detail.character.card.name} character={detail.character} text={draft} />}
        <p role="status" className="mx-auto max-w-3xl text-xs text-slate-400">{stopped ? '已停止生成。可核对结果或取消本次重试。' : busy ? '正在生成，完成后保存…' : generationFailed ? '本次生成失败，未扣除本站额度。可重试或返回编辑。' : '这条消息尚未确认完成，请重试以核对结果。'}</p>
      </div>}
      {nativeSnapshot?.completion&&!detail.graph.messages.some(message=>message.messageId===nativeSnapshot.completion?.messageId)&&
        <Message author={detail.character.card.name} character={detail.character} text={nativeSnapshot.completion.answer} />}
      {nativeSnapshot?.completion&&<AgentMapResults completion={nativeSnapshot.completion} accountId={accountId} csrfToken={csrfToken} />}
      {!activeMessages.length && !pendingGeneration && <p className="py-12 text-center text-sm text-slate-400">故事从你的第一句话开始。</p>}
      <div ref={bottom} />
    </div>
    <div className="mx-auto w-full max-w-4xl shrink-0 space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-8 sm:pt-2">
      <ErrorNotice error={error} onRetry={agentOptions?()=>void nativeRun.retry(csrfToken,modelSelection.apiKey):undefined} />
      {nativeSnapshot?.completion&&<p role="status" className="text-xs text-slate-400">
        {nativeSnapshot.completion.usage?`输入 ${nativeSnapshot.completion.usage.inputTokens} · 输出 ${nativeSnapshot.completion.usage.outputTokens} Token · `:'用量待核对 · '}
        {['pending_evidence','pending_posting'].includes(nativeSnapshot.completion.settlement.status)?'结果已保存，费用待核对。':
          nativeSnapshot.completion.settlement.cashMicros!==null?`本次费用 ¥${formatAmountMicros(nativeSnapshot.completion.settlement.cashMicros)}${nativeSnapshot.completion.settlement.balanceMicros!==null?` · 现金余额 ¥${formatAmountMicros(nativeSnapshot.completion.settlement.balanceMicros)}`:''}`:
          nativeSnapshot.completion.settlement.pointUnits!==null?`本次消耗 ${nativeSnapshot.completion.settlement.pointUnits} 积分`:'未扣本站额度。'}
      </p>}
      {agentOptions&&error instanceof AgentApiError&&['credential_required','request_failed'].includes(error.code)&&<button className={buttonClass} onClick={onOpenModelConfiguration}>填写 API Key 或选择平台额度</button>}
      {agentOptions&&error instanceof AgentApiError&&error.code==='cash_non_positive'&&onNavigateWallet&&<button className={buttonClass} onClick={onNavigateWallet}>充值平台额度</button>}
      <ErrorNotice error={canvas.error} />
      {nativeSnapshot?.pendingApprovals.map(({approval})=><div key={approval.approvalRequestId} className="rounded-xl border border-amber-400 bg-slate-900 p-4 text-sm">
        <p className="whitespace-pre-wrap">{approvalSummary(approval)}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className={buttonClass} onClick={()=>{
            if(!approval.destructive||window.confirm('此操作会删除或替换已有内容，确定继续？'))void nativeRun.resolveApproval(approval.approvalRequestId,true,approval.destructive,csrfToken);
          }}>{approval.destructive?'确认删除或替换':'确认修改'}</button>
          <button type="button" className={buttonClass} onClick={()=>void nativeRun.resolveApproval(approval.approvalRequestId,false,false,csrfToken)}>取消修改</button>
        </div>
      </div>)}
      {error instanceof TavernApiError && ['tavern.model_access_required', 'tavern.model_access_invalid',
        'tavern.platform_model_required', 'tavern.runtime_unavailable', 'generation.model_access_invalid',
        'tavern.user_model_authentication', 'tavern.user_model_balance', 'tavern.user_model_timeout',
        'tavern.user_model_rejected', 'tavern.user_model_unavailable', 'tavern.user_model_invalid_response',
        'tavern.model_configuration_required', 'tavern.platform_trial_unavailable',
        'tavern.platform_trial_rejected', 'tavern.cash_billing_unavailable'].includes(error.code)
        && <button type="button" className={buttonClass} onClick={onOpenModelConfiguration}>填写 API Key 或使用平台额度</button>}
      {error instanceof TavernApiError && error.code === 'tavern.cash_insufficient' && onNavigateWallet
        && <button type="button" className={buttonClass} onClick={onNavigateWallet}>充值平台额度</button>}
      {error instanceof TavernApiError && error.code === 'tavern.user_model_output_limit' && onOpenParameters
        && <button type="button" className={buttonClass} onClick={onOpenParameters}>调整生成参数</button>}
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
      {editing && activeLeaf && <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <label htmlFor={`tavern-edit-${activeLeaf.messageId}`} className="text-xs font-semibold text-slate-300">编辑消息内容</label>
        <textarea id={`tavern-edit-${activeLeaf.messageId}`} aria-label="编辑消息内容" className={`${inputClass} max-h-48 resize-y`} rows={3}
          value={editContent} disabled={graphBusy} onChange={event => setEditContent(event.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass} disabled={graphBusy} onClick={() => { setEditing(false); setEditContent(''); }}>取消</button>
          <button type="button" className={primaryClass} disabled={graphBusy || !editContent.trim()} onClick={() => void saveEdit()}>{graphBusy ? '保存中…' : '保存编辑'}</button>
        </div>
      </div>}
      {agentOptions&&pendingGeneration&&!busy&&<div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={()=>void runGeneration(pendingGeneration.action,pendingGeneration)}>{stopped||nativeSnapshot?.state==='failed'?'重新发送':'核对并继续原请求'}</button>
        {nativeSnapshot?.state!=='awaiting_reconciliation'&&<button className={buttonClass} onClick={()=>{
          if(pendingReply)setMessage(pendingReply.message);nativeRun.dismiss();
        }}>返回编辑</button>}
      </div>}
      {!agentOptions&&pendingGeneration && !busy && <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={recovering} onClick={() => void recoverSavedResult()}>{recovering ? '正在核对结果…' : '核对已保存结果'}</button>
        <button type="button" className={primaryClass} disabled={recovering} onClick={() => void runGeneration(pendingGeneration.action, pendingGeneration)}>重试这条消息</button>
        {mayEdit && pendingReply && <button type="button" className={buttonClass} onClick={() => {
          setMessage(pendingReply.message); setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>编辑消息</button>}
        <button type="button" className={buttonClass} onClick={() => {
          if (pendingReply) setMessage(pendingReply.message);
          setPendingGeneration(null); setDraft(''); setError(null); storePending(storageKey, null);
        }}>取消本次重试</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void runGeneration({ type: 'reply', message }); }} className="rounded-3xl border border-slate-700 bg-slate-900 p-2 shadow-lg transition focus-within:border-cyan-500/70 sm:p-3">
        {referenceActive && nodeReference && <div className="mb-2 flex items-center gap-2 px-2 text-xs text-cyan-200">
          <span>节点参考：{nodeReference.title}</span><button type="button" className="rounded-full px-2 py-1 text-slate-400 hover:text-slate-200" aria-label="移除节点参考"
            disabled={busy || pendingGeneration !== null} onClick={() => { setReferenceActive(false); onNodeReferenceConsumed?.(); }}>×</button>
        </div>}
        {!isMobile && <div className="mb-2 flex flex-wrap items-center gap-2 px-2 text-[11px] text-slate-400">
          {modelChipButton}
          <span>{agentOptions?'按模型窗口整理历史':`历史 ${modelSelection.historyBytes / 1024} KiB`} · 最大输出 {detail.conversation.generationSettings.maxOutputTokens === null ? '模型默认' : `${detail.conversation.generationSettings.maxOutputTokens} Token`}</span>
        </div>}
        <label htmlFor={`tavern-message-${detail.conversation.conversationId}`} className="sr-only">消息</label>
        <textarea id={`tavern-message-${detail.conversation.conversationId}`} className="max-h-48 min-h-14 w-full resize-y border-0 bg-transparent px-3 py-2 text-[15px] leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50 sm:min-h-20" rows={2} placeholder="输入你的问题，或让 AI 画图讲解…" value={message} disabled={readOnly || busy || graphBusy || pendingGeneration !== null || editing}
          onChange={event => setMessage(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault(); if (message.trim() && !inputTooLarge) void runGeneration({ type: 'reply', message });
            }
          }} />
        <div className="flex items-center justify-between gap-2 px-2 pb-0 sm:pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            {isMobile && modelChipButton}
            <button type="button" className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-cyan-400 disabled:opacity-30" disabled={readOnly} onClick={onOpenParameters ?? onOpenModelConfiguration}>参数</button>
            <span className={`hidden text-[11px] sm:inline ${inputTooLarge ? 'text-rose-300' : 'text-slate-500'}`}>{inputTooLarge ? '消息过长（上限 8,192 字节）' : 'Enter 发送 · Shift+Enter 换行'}</span>
          </div>
          {busy ? <button key="stop" type="button" className={primaryClass} onClick={stopGeneration}>停止生成</button>
            : <button key="send" type="submit" className={primaryClass} disabled={readOnly || graphBusy || editing || pendingGeneration !== null || !message.trim() || inputTooLarge}>发送</button>}
        </div>
      </form>
    </div>
    </div>
    </div>
  </div>;
}
const noSubscription=()=>()=>{};
const noSnapshot=()=>null;

function Message({ author, text, user = false, character }: { author: string; text: string; user?: boolean; character?: Character }) {
  return <article className={`mx-auto mb-7 flex max-w-3xl gap-3 ${user ? 'justify-end py-2' : 'py-3 sm:gap-4'}`}>
    {!user && <CharacterAvatar character={character} name={author} />}
    <div className={`min-w-0 ${user ? 'max-w-[85%] rounded-3xl rounded-tr-md bg-slate-800 px-5 py-3' : 'flex-1'}`}><h3 className={`${user ? 'sr-only' : 'mb-2'} flex items-center gap-2 text-xs font-medium text-slate-400`}>{author}</h3>
    <div className="text-[15px] leading-7 text-slate-200 [overflow-wrap:anywhere] [&_em]:text-slate-400 [&_p+p]:mt-3"><AssistantMarkdown content={text} /></div></div>
  </article>;
}
function mergeContinuationMessages(messages: GraphMessage[], boundaries: Set<string>): GraphMessage[] {
  return messages.reduce<GraphMessage[]>((display, message) => {
    const previous = display[display.length - 1];
    if (previous && continuesSameAuthor(message, previous, boundaries)) {
      return [...display.slice(0, -1), { ...previous, content: `${previous.content}\n${message.content}` }];
    }
    return [...display, message];
  }, []);
}

function continuesSameAuthor(message: GraphMessage, parent: GraphMessage, boundaries: Set<string>): boolean {
  return message.role === 'assistant' && message.origin === 'continue' && parent.role === 'assistant'
    && !boundaries.has(message.parentMessageId ?? '') && message.characterId === parent.characterId
    && (message.characterName ?? null) === (parent.characterName ?? null);
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
function continuationRoot(message:GraphMessage,messages:Map<string,GraphMessage>,boundaries:Set<string>):string {
  let root=message;
  for (let count=0;count<messages.size && root.origin==='continue' && root.parentMessageId;count++) {
    const parent=messages.get(root.parentMessageId);if (!parent || !continuesSameAuthor(root,parent,boundaries)) break;root=parent;
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
