import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {conversationRun,type PendingGeneration} from './legacyRun';
import {agentConversationRun} from './agentRun';
import type {AgentConversationOptions} from '../models/agentOptions';
import {approvalSummary} from './approvalSummary';
import {messageAuthors} from './messageAuthors';
import {useTeachingCanvas} from '../canvas/useTeachingCanvas';
import {StreamingPresentation} from './streamingPresentation';
import useIsMobile from '../../lib/useIsMobile';
import {validateId,validateMessage} from './conversationInput';
import {fetchConversation,generateStream,mutateGraph,resolveTavernToolApproval} from '../../api/tavernClient';
import {TavernApiError,type CompletedTurn,type ConversationDetail,type ConversationGraph,type GenerationAction,type GenerationRecord,type GraphMessage,type GraphMutation,type TavernModelSelection,type TavernUserModelAccess,type GenerationProcessEvent,type CashQuote} from './types';
import {isRecord,utf8Bytes} from './validation';

export interface ExecutionProps {
  detail:ConversationDetail;accountId:string;csrfToken:string;modelSelection:TavernModelSelection;agentOptions?:AgentConversationOptions;
  platformModelError?:string;onBusyChange?:(busy:boolean)=>void;onCompleted:(turn:CompletedTurn)=>void;
  onRecovered:(detail:ConversationDetail)=>void;onGraphChanged:(graph:ConversationGraph)=>void;
  nodeReference?:{id:string;title:string};onNodeReferenceConsumed?:()=>void;mapVisible?:boolean;onOpenCanvas?:()=>void;readOnly?:boolean;initialDraft?:string;
}
export function useConversationExecution({detail,accountId,csrfToken,modelSelection,agentOptions:configuredAgentOptions,platformModelError,onBusyChange,onCompleted,onRecovered,onGraphChanged,nodeReference,onNodeReferenceConsumed,mapVisible,onOpenCanvas,readOnly=false,initialDraft=''}:ExecutionProps){
  const storageKey = `mapflow.tavern.pending.v1.${accountId}.${detail.conversation.conversationId}`;
  const [legacyRecovery,setLegacyRecovery]=useState(()=>!!readPending(storageKey,detail.graph.revision));
  const agentOptions=legacyRecovery?undefined:configuredAgentOptions;
  const queryClient=useQueryClient();
  const run=useMemo(()=>conversationRun(queryClient,{accountId,scene:detail.conversation.scene??(detail.conversation.libraryEntryId?'learning':'tavern'),
    areaId:detail.conversation.learningAreaId??null,conversationId:detail.conversation.conversationId},()=>{
    const saved = agentOptions ? null : readPending(storageKey, detail.graph.revision);
    if (saved && detail.generations.some(generation => generation.clientActionId === saved.clientActionId)) { storePending(storageKey, null); return null; }
    return saved;
  }),[queryClient,storageKey,detail.conversation.scene,detail.conversation.learningAreaId]);
  const legacySnapshot=useSyncExternalStore(agentOptions?noSubscription:run.subscribe,run.getSnapshot,run.getSnapshot);
  useEffect(()=>{if(legacyRecovery&&!legacySnapshot.busy&&!legacySnapshot.pendingGeneration)setLegacyRecovery(false);},[legacyRecovery,legacySnapshot.busy,legacySnapshot.pendingGeneration]);
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
  const [message, updateMessage] = useState(initialDraft);
  const messageRevision=useRef(0);
  function setMessage(value:string){messageRevision.current++;updateMessage(value);}
  const restoredInterruption=useRef<string|null>(null);
  useEffect(()=>{
    const interrupted=nativeSnapshot?.interruptedGeneration;
    if(!interrupted||restoredInterruption.current===interrupted.clientActionId)return;
    restoredInterruption.current=interrupted.clientActionId;
    if(interrupted.action.type==='reply'&&!message.trim())setMessage(interrupted.action.message);
  },[nativeSnapshot?.interruptedGeneration?.clientActionId]);
  const [referenceActive, setReferenceActive] = useState(!!nodeReference);
  useEffect(() => { setReferenceActive(!!nodeReference); }, [nodeReference?.id, nodeReference?.title]);
  const [recovering, setRecovering] = useState(false);
  const isMobile = useIsMobile();
  const learningScene = (detail.conversation.scene ?? (detail.conversation.libraryEntryId ? 'learning' : 'tavern')) === 'learning';
  const canvas = useTeachingCanvas(detail.conversation.conversationId, csrfToken, detail.graph.revision, detail.canvas,
    { readOnly, initiallyOpen: false, visibilityKey: learningScene ? `mapflow.ui.canvas.v1.${accountId}.${detail.conversation.conversationId}` : undefined, queryClient, accountId });
  const learningCanvasOpened = useRef(false);
  useEffect(() => {
    if (!learningScene || readOnly || busy || pendingGeneration || learningCanvasOpened.current) return;
    learningCanvasOpened.current = true;
    void canvas.enableDrawing();
  }, [learningScene, readOnly, busy, pendingGeneration]);
  useEffect(()=>{canvas.setPreview(canvasPreview);},[canvasPreview,canvas.setPreview]);
  const mapVisibleRef = useRef(mapVisible); mapVisibleRef.current = mapVisible;
  useEffect(() => { if (mapVisible && canvas.open) canvas.setOpen(false); }, [mapVisible]);
  async function openTeachingCanvas() {
    if (isMobile) composer.current?.blur();
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
  // 手机端输入区保持紧凑，模型选择和参数从统一抽屉进入。
  const composer = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    if (followLatest.current&&(busy||draft||pendingGeneration||detail.graph.messages.some(message=>message.role==='user'))) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [draft, process, detail.graph.revision, pendingGeneration,busy]);
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
    if (readOnly || canvas.deletionPreparing || canvas.deleted) return;
    if (activeRequest.current || graphBusy || editing || (pendingGeneration && !retry)) return;
    const submittedMessageRevision=messageRevision.current;
    if (!retry && action.type === 'reply' && referenceActive && nodeReference) {
      action = { ...action, message: `${action.message}\n\n[学习节点参考：${nodeReference.title}；节点 ID：${nodeReference.id}]` };
    }
    if(agentOptions){
      await nativeRun.restore();
      if(retry&&nativeSnapshot?.state!=='failed'&&nativeSnapshot?.state!=='stopped'){
        const unaccepted=await nativeRun.retry(csrfToken,modelSelection.apiKey);
        if(unaccepted?.type==='reply'&&!message.trim()&&messageRevision.current===submittedMessageRevision)setMessage(unaccepted.message);
        return;
      }
      if(retry)nativeRun.dismiss();
      try{
        if(action.type!=='reply')validateId(action.assistantMessageId);
        if(agentOptions.funding==='cash'&&(!agentOptions.profileId||!agentOptions.profileVersion))
          throw new TavernApiError(409,'agent_model.not_selectable','请在模型设置中重新选择可用的现金模型，问题已保留。');
        const access=agentOptions.funding==='byok'?selectedUserAccess(modelSelection):undefined;
        if(agentOptions.funding==='byok'&&(!access||!Number.isSafeInteger(agentOptions.contextWindow)||!agentOptions.contextWindow||agentOptions.contextWindow<1))
          throw new TavernApiError(400,'tavern.model_access_required','请填写 API Key、模型和实际上下文窗口。');
        try{await canvas.flush();}catch{/* The canvas retains its manual draft and shows its own error; unrelated chat can proceed. */}
        followLatest.current=true;
        const admitted=await nativeRun.send(action,detail.graph.revision,{funding:agentOptions.funding,
          ...(agentOptions.profileId?{profileId:agentOptions.profileId,profileVersion:agentOptions.profileVersion}:{}),
          ...(access?{modelAccess:{apiKey:access.apiKey,baseUrl:access.baseUrl,model:access.model,contextWindow:agentOptions.contextWindow!,
            maxOutputTokens:agentOptions.maxOutputTokens,reasoningProtocol:agentOptions.reasoningProtocol??'none',reasoningSupported:agentOptions.reasoningSupported??false}}:{})},csrfToken);
        if(admitted&&action.type==='reply'&&messageRevision.current===submittedMessageRevision)setMessage('');
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
  // Replace this transient question by request identity when durable history arrives, never by matching text.
  const completed=nativeSnapshot?.completion;
  const outgoingAction=pendingGeneration?.action??(completed&&!messagesById.has(completed.messageId)?nativeSnapshot?.completedAction:null);
  const pendingInputSaved=!!pendingGeneration&&detail.generations.some(generation=>generation.clientActionId===pendingGeneration.clientActionId
    &&activeMessages.some(message=>message.messageId===generation.inputMessageId));
  const outgoingReply=outgoingAction?.type==='reply'&&outgoingAction.message.trim()&&!pendingInputSaved?{
    message:outgoingAction.message,
    status:pendingGeneration&&!busy?(stopped?'生成已停止':nativeSnapshot?.state==='failed'||generationFailed?'回复生成未完成':'发送状态待确认')
      :nativeSnapshot&&busy&&!nativeSnapshot.executionId?'正在发送…':undefined,
  }:null;
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
    if (canvas.deletionPreparing || canvas.deleted) return false;
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

  function cancelRetry(){
    if(pendingReply)setMessage(pendingReply.message);
    if(agentOptions)nativeRun.dismiss();else{setPendingGeneration(null);setDraft('');setError(null);storePending(storageKey,null);}
  }
  return {detail,message,setMessage,busy,draft,process,stopped,error,pendingGeneration,graphBusy,editing,setEditing,
    editContent,setEditContent,referenceActive,setReferenceActive,canvas,nativeSnapshot,nativeRun,agentOptions,legacyRecovery,
    activeMessages,displayMessages,outgoingReply,messagesById,roleChangeAnchors,historicalAuthors,activeLeaf,branchAnchors,selectedBranchAnchorId,
    branchName,setBranchName,branchAnchorId,setBranchAnchorId,canReviseAssistant,canContinueAssistant,alternatives,activeAlternativeIndex,
    inputTooLarge,mayEdit,pendingReply,generationFailed,recovering,recoverSavedResult,runGeneration,stopGeneration,applyGraphMutation,saveEdit,cancelRetry,
    openTeachingCanvas,composer,pane,bottom,followLatest,setError};
}
const noSubscription=()=>()=>{};
const noSnapshot=()=>null;

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
export function continuationRoot(message:GraphMessage,messages:Map<string,GraphMessage>,boundaries:Set<string>):string {
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
