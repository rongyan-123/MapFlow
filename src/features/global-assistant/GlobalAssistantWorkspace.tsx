import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import type {Navigate} from '../../app/useLocation';
import type {AgentState,AgentStatus} from '../../api/agentExecutionClient';
import {AgentApiError} from '../../api/agentExecutionClient';
import {ExecutionRecovery} from '../../ui/conversation/ExecutionRecovery';
import {useAgentModelConfiguration} from '../../domains/models/AgentModelContext';
import {useSharedModelSelection} from '../../domains/models/ModelSelectionContext';
import {approvalSummary} from '../../domains/conversations/approvalSummary';
import {describePublicError} from '../../lib/publicErrors';
import {PageHeader} from '../../ui/PageHeader';
import {Button,IconButton} from '../../ui/Button';
import {Icon} from '../../ui/Icon';
import {Dialog} from '../../ui/Dialog';
import {BrandMark} from '../../ui/BrandMark';
import {WelcomeArtwork} from '../../ui/WelcomeArtwork';
import GlobalMessageMarkdown from './GlobalMessageMarkdown';
import GlobalMessageBody from './GlobalMessageBody';
import ModelSettings from '../../ui/conversation/ModelSettings';
import GenerationSettingsForm from '../../ui/conversation/GenerationSettingsForm';
import {ProcessInfo} from '../../ui/conversation/ConversationMessages';
import {GlobalAssistantController} from './GlobalAssistantController';
import GlobalExecutionResult from './GlobalExecutionResult';
import {globalModelCommand} from './modelCommand';
import './global-assistant.css';

const terminal=(state:AgentState|null|undefined)=>!!state&&['succeeded','stopped','failed'].includes(state);
const stateLabels:Record<AgentState,string>={queued:'等待执行',running:'正在处理',recovering:'正在恢复原请求',awaiting_reconciliation:'原请求需要核对',ready_to_commit:'正在保存结果',succeeded:'结果已保存',stopped:'原请求已停止',failed:'原请求未完成'};
type RequestIdentity=Pick<AgentStatus,'executionId'|'conversationId'|'state'|'funding'|'modelId'|'error'>;
function RequestCard({request,accountId,busy,error,stopRequested,onCheck,onStop,onCredential}:{request:RequestIdentity;accountId:string;busy:boolean;error:unknown;stopRequested?:boolean;onCheck:()=>void;onStop:()=>void;onCredential:()=>void}){
  return <section className="mf-global-request" aria-label="原请求状态" data-execution-id={request.executionId}>
    <p role="status">{stateLabels[request.state]}{stopRequested?' · 停止尚待服务器确认':''}</p>
    <p className="mf-muted">原模型：<span>{request.modelId||'正在确认'}</span> · {request.funding==='cash'?'现金额度':request.funding==='points'?'平台积分':'自填 API Key'}</p>
    <details className="mf-usage"><summary>请求标识</summary><p>{request.executionId}</p></details>
    {request.state==='stopped'&&<p className="mf-muted">可以继续发送。{request.funding==='byok'?'原上游调用依据保留，不扣本站额度。':'原费用证据和待核账事项保留。'}</p>}
    <ExecutionRecovery {...request} accountId={accountId} legacyErrorCode={request.error?.code} error={error} busy={busy} stopRequested={stopRequested} onCheck={onCheck} onResume={onCredential} onStop={onStop} />
  </section>;
}

export default function GlobalAssistantWorkspace({accountId,csrfToken,navigate}:{accountId:string;csrfToken:string;navigate:Navigate}){
  const queryClient=useQueryClient();const controller=useMemo(()=>new GlobalAssistantController(accountId,csrfToken,queryClient),[accountId,queryClient]);
  useLayoutEffect(()=>controller.updateCsrfToken(csrfToken),[controller,csrfToken]);
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const model=useAgentModelConfiguration();const shared=useSharedModelSelection()!;
  const [settingsOpen,setSettingsOpen]=useState(false);const [settingsBusy,setSettingsBusy]=useState(false);
  const [credentialTarget,setCredentialTarget]=useState<AgentStatus|null>(null);
  const [windowEnd,setWindowEnd]=useState<string|null>(null);
  const [focused,setFocused]=useState(false);const composer=useRef<HTMLTextAreaElement>(null);const scroll=useRef<HTMLDivElement>(null);const followLatest=useRef(true);
  const oldScroll=useRef<{height:number;top:number}|null>(null);
  const {timeline,execution}=state;
  const messages=timeline?.messages.filter(message=>message.origin!=='opening')??[];
  const completions=timeline?.completions??[];
  const endIndex=windowEnd?Math.max(0,messages.findIndex(message=>message.messageId===windowEnd)+1)||messages.length:messages.length;
  const startIndex=Math.max(0,endIndex-120);
  const visibleMessages=messages.slice(startIndex,endIndex);
  const atLatest=endIndex===messages.length;
  const receipts=useMemo(()=>{const byMessage=new Map<string,typeof completions>();completions.forEach(completion=>byMessage.set(completion.messageId,[...(byMessage.get(completion.messageId)??[]),completion]));return byMessage;},[completions]);
  const loadedIds=useMemo(()=>new Set(timeline?.messages.map(message=>message.messageId)),[timeline?.messages]);
  const projectedActive=timeline?.activeExecution;
  const active=!!execution?.pendingGeneration||!!execution?.rejectedGeneration||!!execution?.busy||!!projectedActive&&!terminal(projectedActive.state)&&!(execution?.executionId===projectedActive.executionId&&terminal(execution.state));
  const canSend=!!timeline&&!state.loading&&!state.error&&!state.syncing&&!state.syncError&&!settingsBusy&&!execution?.pendingGeneration&&!execution?.rejectedGeneration&&!execution?.busy&&timeline.sendAvailability.conversation&&(model.options.funding!=='cash'||timeline.sendAvailability.cash);
  const modelLabel=`${(model.options.modelLabel??shared.selection.model)||'配置模型'} · ${model.options.funding==='cash'?'现金额度':model.options.funding==='points'?'平台积分':'自填 Key'}`;
  const send=async()=>{if(!canSend)return;try{await controller.send(globalModelCommand(model.options,shared.selection));}catch(error){controller.rejectPreflight(error);}};
  const loadOlder=async()=>{
    const pane=scroll.current;if(pane)oldScroll.current={height:pane.scrollHeight,top:pane.scrollTop};followLatest.current=false;
    const anchor=visibleMessages.length>80?visibleMessages[visibleMessages.length-41].messageId:null;
    if(startIndex>0){setWindowEnd(anchor);if(pane)pane.scrollTop=0;return;}
    await controller.loadOlder();if(anchor)setWindowEnd(anchor);
  };
  const latest=()=>{setWindowEnd(null);followLatest.current=true;};
  useLayoutEffect(()=>{const field=composer.current;if(!field)return;field.style.height='auto';field.style.height=`${Math.min(144,Math.max(44,field.scrollHeight))}px`;},[state.draft]);
  useLayoutEffect(()=>{
    const pane=scroll.current;if(!pane)return;
    if(oldScroll.current&&!state.loadingOlder){pane.scrollTop=oldScroll.current.top+pane.scrollHeight-oldScroll.current.height;oldScroll.current=null;}
    else if(followLatest.current)pane.scrollTop=pane.scrollHeight;
  },[messages.length,execution?.draft,execution?.process,state.loadingOlder,state.guidesDismissed,windowEnd]);
  useEffect(()=>{const focus=()=>void controller.sync();window.addEventListener('focus',focus);const timer=setInterval(focus,15000);return()=>{window.removeEventListener('focus',focus);clearInterval(timer);};},[controller]);
  const stop=(target?:AgentStatus)=>{if(window.confirm('停止原请求后可继续对话，已发生的费用仍按原规则核对。确定停止？'))void controller.stop(target);};
  const credentials=(target?:AgentStatus)=>{setCredentialTarget(target??null);model.change({funding:'byok'});setSettingsOpen(true);};
  const currentRequest:RequestIdentity|null=execution?.executionId&&execution.state?{executionId:execution.executionId,conversationId:timeline?.conversationId??'',state:execution.state,funding:execution.funding??'cash',modelId:execution.modelId??'',error:execution.error instanceof AgentApiError?{code:execution.error.code,message:execution.error.message,requestId:execution.executionId}:null}:null;
  const renderCompletion=(completion:typeof completions[number])=><GlobalExecutionResult key={completion.executionId} completion={completion} accountId={accountId} csrfToken={csrfToken} navigate={navigate} />;
  return <section className="mf-global-assistant" data-composer-focused={focused}>
    <PageHeader title="MapFlow 助手" context={<span className="mf-muted mf-small">网站使用 · 学习规划</span>} actions={<Button variant="quiet" onClick={()=>{setCredentialTarget(null);setSettingsOpen(true);}}><Icon name="settings" /><span>模型设置</span></Button>} />
    <div className="mf-global-scroll" ref={scroll} onScroll={()=>{const pane=scroll.current;if(pane){followLatest.current=pane.scrollHeight-pane.scrollTop-pane.clientHeight<100;if(pane.scrollTop<40&&(startIndex>0||timeline?.olderCursor)&&!state.loadingOlder&&!state.historyError)void loadOlder();}}}>
      <div className="mf-global-content">
        <div className="mf-global-intro">
          <WelcomeArtwork />
          <div className="mf-global-intro-copy"><span className="mf-welcome-mark"><BrandMark /></span><p className="mf-eyebrow">MAPFLOW · 你的下一步</p><h2>把下一步，看清楚。</h2><p>网站怎么用，学习路线怎么规划。<br />从一个问题开始，一起找到方向。</p></div>
        </div>
        {state.loading&&<p role="status" className="mf-muted mf-small">正在读取最近消息…</p>}
        {Boolean(state.error)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(state.error)} <Button onClick={()=>void controller.reload()}>重新读取最近消息</Button></p>}
        {Boolean(state.noticeError)&&!state.error&&<p role="alert" className="mf-status">{describePublicError(state.noticeError)}</p>}
        {(startIndex>0||timeline?.olderCursor)&&<Button className="mf-global-history" variant="quiet" disabled={state.loadingOlder} onClick={()=>void loadOlder()}>{state.loadingOlder?'正在读取更早消息…':'读取更早消息'}</Button>}
        {Boolean(state.historyError)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(state.historyError)} <Button onClick={()=>void loadOlder()}>重试更早消息</Button></p>}
        <div role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions">{visibleMessages.map(message=><div key={message.messageId}><article className={`mf-message ${message.role==='user'?'mf-message--user':''}`}><div><p className={message.role==='user'?'mf-sr-only':'mf-message-author'}>{message.role==='user'?'你':message.role==='system'?'系统':'MapFlow 助手'}</p><GlobalMessageBody message={message} binding={timeline!} navigate={navigate} /></div></article>{receipts.get(message.messageId)?.map(renderCompletion)}</div>)}
          {atLatest&&completions.filter(completion=>!loadedIds.has(completion.messageId)).slice(-120).map(completion=><div key={completion.executionId}><article className="mf-message"><div><p className="mf-message-author">MapFlow 助手</p><GlobalMessageBody message={{messageId:completion.messageId,parentMessageId:null,role:'assistant',origin:'model',characterId:null,content:completion.answer,...(completion.answerRef?{bodyRef:{totalChars:completion.answerRef.totalChars,nextOffset:completion.answerRef.nextOffset}}:{})}} binding={timeline!} navigate={navigate} /></div></article>{renderCompletion(completion)}</div>)}
          {atLatest&&!execution?.completion&&(execution?.draft||execution?.busy)&&<><ProcessInfo events={execution.process} live={execution.busy} /><article className="mf-message"><div><p className="mf-message-author">MapFlow 助手{execution.stopped?' · 部分输出未保存':''}</p><GlobalMessageMarkdown markdown={execution.draft} navigate={navigate} /></div></article>{execution.busy&&<p className="mf-thinking" role="status"><span className="mf-spinner" />正在处理…</p>}</>}
        </div>
        {!atLatest&&<div className="mf-runtime-actions"><Button onClick={()=>{const next=endIndex+40;setWindowEnd(next>=messages.length?null:messages[next-1].messageId);}}>显示较新的消息</Button><Button onClick={latest}>返回最新消息</Button></div>}
        {execution?.pendingGeneration?.action.type==='reply'&&execution.pendingGeneration.action.message&&<details className="mf-usage"><summary>本次原请求</summary><p className="mf-global-original">{execution.pendingGeneration.action.message}</p></details>}
        {execution?.rejectedGeneration?.action.type==='reply'&&<details className="mf-usage"><summary>尚未受理的原问题</summary><p className="mf-global-original">{execution.rejectedGeneration.action.message}</p></details>}
        {currentRequest&&(!terminal(currentRequest.state)||currentRequest.state==='stopped'||currentRequest.state==='failed')&&<RequestCard accountId={accountId} request={currentRequest} busy={false} error={execution?.error} stopRequested={execution?.stopRequested} onCheck={()=>void controller.reconcile()} onStop={()=>stop()} onCredential={()=>credentials()} />}
        {state.blockingExecutions.filter(item=>item.executionId!==currentRequest?.executionId).map(request=><RequestCard accountId={accountId} key={request.executionId} request={request} busy={state.requestActions[request.executionId]?.busy??false} error={state.requestActions[request.executionId]?.error} onCheck={()=>void controller.reconcile(request)} onStop={()=>stop(request)} onCredential={()=>credentials(request)} />)}
        {Boolean(execution?.error)&&(!currentRequest||currentRequest.state==='succeeded')&&<p role="alert" className="mf-status mf-status--error">{describePublicError(execution?.error)} <Button onClick={()=>setSettingsOpen(true)}>打开模型设置</Button>{!execution?.pendingGeneration&&<Button onClick={()=>void controller.reconcile()}>重新核对执行状态</Button>}</p>}
        {!execution?.busy&&!execution?.pendingGeneration&&execution?.rejectedGeneration&&(!execution.executionId||terminal(execution.state))&&<div className="mf-runtime-actions"><Button onClick={()=>void controller.returnRejectedToEdit()}>返回编辑</Button></div>}
        {!execution?.busy&&execution?.pendingGeneration&&!execution.executionId&&<div className="mf-runtime-actions"><Button onClick={()=>void controller.resume(shared.selection.apiKey)}>查回原操作</Button>{execution.funding==='byok'&&<Button onClick={()=>credentials()}>补充 API Key</Button>}</div>}
        {execution?.pendingApprovals.map(({approval})=><div className="mf-approval" key={approval.approvalRequestId}><p>{approvalSummary(approval)}</p><div className="mf-row mf-wrap"><Button variant="primary" onClick={()=>{if(!approval.destructive||window.confirm('此操作会删除或替换已有内容，确定继续？'))void controller.approve(approval.approvalRequestId,true,approval.destructive);}}>{approval.destructive?'确认删除或替换':'确认修改'}</Button><Button onClick={()=>void controller.approve(approval.approvalRequestId,false,false)}>取消修改</Button></div></div>)}
        {Boolean(state.syncError)&&<p role="alert" className="mf-status mf-status--error">最近消息暂时未同步，已确认的回复和草稿已保留。 <Button onClick={()=>void controller.sync()}>重试同步</Button><Button onClick={()=>void controller.reload()}>重新读取最近消息</Button></p>}
        {atLatest&&!state.guidesDismissed&&!active&&<section className="mf-global-questions" aria-label="问一问"><h2>问一问 <span>从这里开始</span></h2>{state.questions.map((question,index)=><button key={question.id} type="button" aria-label={question.text} onClick={()=>{controller.chooseQuestion(question.text);composer.current?.focus();}}><span className="mf-question-icon"><Icon name={(['book','map','learn'] as const)[index%3]} /></span><span className="mf-question-copy"><strong>{question.text}</strong><small>{['认识 MapFlow','找到使用方法','规划学习方向'][index%3]}</small></span><Icon name="right" /></button>)}</section>}
      </div>
    </div>
    <div className="mf-composer-area"><form className="mf-composer" onSubmit={event=>{event.preventDefault();void send();}}>
      <textarea ref={composer} aria-label="消息" rows={1} placeholder="问问网站用法，或说说学习目标…" value={state.draft} onChange={event=>controller.setDraft(event.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&window.innerWidth>=768){event.preventDefault();void send();}}} />
      <div className="mf-composer-bottom"><button type="button" className="mf-model-chip" aria-label="打开模型设置" title={modelLabel} onClick={()=>{setCredentialTarget(null);setSettingsOpen(true);}}><Icon name="spark" /><span>{modelLabel}</span><Icon name="down" /></button><small className="mf-desktop-only">Enter 发送 · Shift+Enter 换行</small>{execution?.busy?<IconButton icon="stop" label="停止生成" className="mf-send" onClick={()=>stop()} />:<IconButton icon="arrow" label="发送" type="submit" className="mf-send" disabled={!canSend||!state.draft.trim()} />}</div>
    </form><p className="mf-composer-note">AI 的建议可以参考，理解和判断属于你。</p></div>
    {settingsOpen&&<Dialog title="模型设置" onClose={()=>setSettingsOpen(false)} dismissible={!settingsBusy}><div className="mf-stack">
      <p className="mf-muted mf-small">模型选择用于下一次发送；原请求沿用已接受的模型和资金通路。</p>
      <ModelSettings accountId={accountId} csrfToken={csrfToken} onWallet={()=>navigate('/wallet')} />
      {(credentialTarget||execution?.state==='awaiting_reconciliation'&&execution?.control?.actions.canResume===true||execution?.controlAvailability==='unsupported'&&execution?.error instanceof AgentApiError&&execution.error.code==='credential_required'||!execution?.executionId&&execution?.pendingGeneration&&execution.funding==='byok')&&<div className="mf-status mf-stack"><p>恢复原模型：{credentialTarget?.modelId??execution?.modelId??'原请求模型'}。请补回匹配原配置的 Key，再显式恢复。</p><Button disabled={!shared.selection.apiKey.trim()} onClick={()=>void controller.resume(shared.selection.apiKey,credentialTarget??undefined)}>恢复原请求</Button></div>}
      {timeline&&<details className="mf-global-parameters"><summary>生成参数</summary><GenerationSettingsForm conversationId={timeline.conversationId} settings={timeline.generationSettings} version={timeline.generationSettingsVersion} csrfToken={csrfToken} onUpdated={controller.patchSettings} onConflict={controller.reload} onBusyChange={setSettingsBusy} /></details>}
    </div></Dialog>}
  </section>;
}
