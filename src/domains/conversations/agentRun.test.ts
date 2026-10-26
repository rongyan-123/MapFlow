import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AgentConversationRun} from './agentRun';
import {AgentApiError,type AgentStatus,type AgentEvent,type AgentCompletion} from '../../api/agentExecutionClient';
const api=vi.hoisted(()=>({fetchActiveAgentExecution:vi.fn(),fetchAgentExecution:vi.fn(),fetchAgentExecutionControl:vi.fn(),acceptAgentExecution:vi.fn(),attachAgentExecution:vi.fn(),stopAgentExecution:vi.fn(),resumeAgentExecution:vi.fn()}));
vi.mock('../../api/agentExecutionClient',async original=>({...await original<typeof import('../../api/agentExecutionClient')>(),...api}));
const conversation='11111111-1111-4111-8111-111111111111',execution='22222222-2222-4222-8222-222222222222';
const completion:AgentCompletion={executionId:execution,conversationId:conversation,generationId:'33333333-3333-4333-8333-333333333333',messageId:'44444444-4444-4444-8444-444444444444',answer:'Saved answer',maps:[],usage:null,
  settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
const status:AgentStatus={executionId:execution,conversationId:conversation,state:'running',funding:'cash',modelId:'original-model',result:null,error:null};

it.each([false,true])('a disabled model releases the rejected command without retrying or switching models (global=%s)',async global=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('agent_model.not_selectable',409));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:global});
  expect(await run.send({type:'reply',message:'Keep my question'},0,{funding:'cash',profileId:'retired',profileVersion:1},'csrf')).toBe(false);
  expect(run.getSnapshot()).toMatchObject({pendingGeneration:null,busy:false,confirmedUnaccepted:true});
  await run.retry('csrf');expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  expect(run.getSnapshot().error).toMatchObject({message:expect.stringMatching(/模型.*暂停|重新选择/)});
});

it.each([false,true])('lets a confirmed cash rejection return to editing and a new BYOK send (global=%s)',async global=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('cash_non_positive',402));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:global});
  const action={type:'reply' as const,message:'Keep this question when my site balance is negative'};
  expect(await run.send(action,0,{funding:'cash'},'csrf')).toBe(false);
  expect(run.getSnapshot()).toMatchObject({pendingGeneration:null,busy:false,confirmedUnaccepted:true});
  const original=api.acceptAgentExecution.mock.calls[0][1];
  await run.retry('csrf','synthetic-user-key');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  api.acceptAgentExecution.mockResolvedValueOnce({execution:{...status,funding:'byok'},replayed:false});
  expect(await run.send(action,0,{funding:'byok',modelAccess:{apiKey:'synthetic-user-key',baseUrl:'https://models.example/v1',model:'byok-model',contextWindow:128000,reasoningProtocol:'none',reasoningSupported:false}},'csrf')).toBe(true);
  const latest=api.acceptAgentExecution.mock.calls[1][1];
  expect(latest.funding).toBe('byok');expect(latest.modelAccess?.apiKey).toBe('synthetic-user-key');
  expect(latest.clientActionId).not.toBe(original.clientActionId);
  expect(sessionStorage.getItem(`mapflow.agent.execution.v1.owner.${conversation}`)).not.toContain('synthetic-user-key');
});
it('checks an unknown BYOK call without offering or dispatching an impossible credential resume',async()=>{
  const waiting={...status,funding:'byok' as const,state:'awaiting_reconciliation' as const};
  api.fetchActiveAgentExecution.mockResolvedValueOnce(waiting);api.fetchAgentExecution.mockResolvedValueOnce(waiting);
  api.fetchAgentExecutionControl.mockResolvedValueOnce({version:1,executionId:execution,conversationId:conversation,state:waiting.state,
    reason:'external_outcome_unknown',actions:{canCheck:true,canStop:true,canResume:false,needsCredential:false}});
  const run=new AgentConversationRun('owner',conversation);await run.restore();await Promise.resolve();
  await run.retry('csrf','synthetic-original-key');
  expect(api.resumeAgentExecution).not.toHaveBeenCalled();expect(api.acceptAgentExecution).not.toHaveBeenCalled();
  expect(api.fetchAgentExecution).toHaveBeenCalled();
});

it.each(['failed','stopped'] as const)('unlocks a restored BYOK conversation after the old round is %s, without replaying it',async terminalState=>{
  const command={clientActionId:'old-byok-action',expectedRevision:0,funding:'byok' as const,action:{type:'reply' as const,message:'Preserve my original question'}};
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:execution,command}));
  api.fetchAgentExecution.mockResolvedValueOnce({...status,funding:'byok',state:'awaiting_reconciliation'});
  const run=new AgentConversationRun('owner',conversation);await run.restore();
  expect(run.getSnapshot().pendingGeneration).not.toBeNull();
  api.fetchAgentExecution.mockResolvedValueOnce({...status,funding:'byok',state:terminalState,error:{code:'external_outcome_unknown',message:'Original provider result unknown',requestId:execution}});
  await run.checkStatus();
  expect(run.getSnapshot()).toMatchObject({state:terminalState,pendingGeneration:null,busy:false,interruptedGeneration:{action:command.action}});
  expect(api.acceptAgentExecution).not.toHaveBeenCalled();expect(api.resumeAgentExecution).not.toHaveBeenCalled();
  api.fetchAgentExecution.mockResolvedValueOnce({...status,funding:'byok'});await run.checkStatus();
  expect(run.getSnapshot()).toMatchObject({state:terminalState,pendingGeneration:null});
  const next='66666666-6666-4666-8666-666666666666';
  api.acceptAgentExecution.mockResolvedValueOnce({execution:{...status,executionId:next,funding:'byok'},replayed:false});
  expect(await run.send({type:'reply',message:'A new explicit question'},0,{funding:'byok'},'csrf')).toBe(true);
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  expect(api.acceptAgentExecution.mock.calls[0][1].clientActionId).not.toBe(command.clientActionId);
  expect(run.getSnapshot()).toMatchObject({executionId:next,interruptedGeneration:null});
});

it('a missing saved execution terminates recovery and clears the old browser record', async () => {
  const key = 'mapflow.agent.execution.v1.owner.' + conversation;
  sessionStorage.setItem(key, JSON.stringify({ executionId: execution }));
  api.fetchAgentExecution.mockRejectedValueOnce(new AgentApiError('execution_not_found', 404));
  const run = new AgentConversationRun('owner', conversation);
  await run.restore();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(run.getSnapshot().pendingGeneration).toBeNull();
  expect(run.getSnapshot().busy).toBe(false);
  await run.retry('csrf');
  expect(api.fetchAgentExecution).toHaveBeenCalledTimes(1);
});

it('a deleted event source stops reading instead of reconnecting indefinitely', async () => {
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  api.attachAgentExecution.mockRejectedValue(new AgentApiError('execution_not_found', 404));
  const run = new AgentConversationRun('owner', conversation);
  const detach = run.subscribe(() => {});
  await run.restore();
  await vi.waitFor(() => expect(run.getSnapshot().busy).toBe(false));
  expect(run.getSnapshot().executionId).toBeNull();
  expect(api.attachAgentExecution).toHaveBeenCalledTimes(1);
  detach();
});
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();api.fetchAgentExecutionControl.mockResolvedValue(null);api.fetchActiveAgentExecution.mockResolvedValue(null);api.fetchAgentExecution.mockResolvedValue(status);api.acceptAgentExecution.mockResolvedValue({execution:status,replayed:false});
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,_onEvent,signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));});
afterEach(()=>{vi.useRealTimers();});
it('ignores a detached reader delivering the old completion after a new execution starts',async()=>{
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  const readers:Array<(event:AgentEvent)=>void>=[];
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{readers.push(onEvent);return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();await vi.waitFor(()=>expect(readers).toHaveLength(1));
  readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:8,payload:{type:'completed',result:completion}});
  const nextExecution='66666666-6666-4666-8666-666666666666';
  api.acceptAgentExecution.mockResolvedValue({execution:{...status,executionId:nextExecution},replayed:false});
  await run.send({type:'reply',message:'Next question'},1,{funding:'cash'},'csrf');
  readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:11,payload:{type:'completed',result:completion}});
  readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:12,payload:{type:'settlement',settlement:{status:'settled',cashMicros:4000,pointUnits:null,balanceMicros:0},usage:null}});
  expect(run.getSnapshot()).toMatchObject({executionId:nextExecution,state:'running',completion:null,busy:true});detach();
});
it('clears stale confirmations on stop and retains a committed canvas if history delivery is unavailable',async()=>{
 let deliver:(event:AgentEvent)=>void=()=>{};api.fetchActiveAgentExecution.mockResolvedValue(status);
 api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{deliver=onEvent;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();await vi.waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalled());
 deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:1,payload:{type:'approval_required',libraryEntryId:conversation,callId:'edit',approval:{approvalRequestId:conversation,action:'修改',target:'地图',destructive:false}}});
 api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});await run.stop('csrf');expect(run.getSnapshot().pendingApprovals).toEqual([]);detach();
 const another=new AgentConversationRun('another-owner',conversation);const close=another.subscribe(()=>{});await another.restore();await vi.waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalledTimes(2));
 const canvas={revision:12,enabled:true,elements:[{id:'diagram',type:'rectangle'}]};
 deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:2,payload:{type:'canvas',canvas}});
 deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:3,payload:{type:'completed',result:completion}});
 expect(another.getSnapshot().canvasPreview).toEqual(canvas);close();
});
it('fences a late stop response from an earlier execution away from the next execution',async()=>{
  api.fetchActiveAgentExecution.mockResolvedValue(status);let deliver:(event:AgentEvent)=>void=()=>{};
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{deliver=onEvent;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();await vi.waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalled());
  let stopped:(value:AgentStatus)=>void=()=>{};api.stopAgentExecution.mockImplementation(()=>new Promise(resolve=>{stopped=resolve;}));
  const stopping=run.stop('csrf');
  deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:8,payload:{type:'completed',result:completion}});
  const nextExecution='66666666-6666-4666-8666-666666666666';api.acceptAgentExecution.mockResolvedValue({execution:{...status,executionId:nextExecution},replayed:false});
  await run.send({type:'reply',message:'Next question'},1,{funding:'cash'},'csrf');
  stopped({...status,state:'stopped'});await stopping;
  expect(run.getSnapshot()).toMatchObject({executionId:nextExecution,state:'running',stopped:false,busy:true});detach();
});
it('retains a saved completion when an older running status arrives later',async()=>{
  api.fetchActiveAgentExecution.mockResolvedValue(status);let deliver:(event:AgentEvent)=>void=()=>{};
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{deliver=onEvent;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();await vi.waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalled());
  let readStatus:(value:AgentStatus)=>void=()=>{};api.fetchAgentExecution.mockImplementation(()=>new Promise(resolve=>{readStatus=resolve;}));
  const refreshing=run.retry('csrf');
  await vi.waitFor(()=>expect(api.fetchAgentExecution).toHaveBeenCalledOnce());
  deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:8,payload:{type:'completed',result:completion}});
  readStatus(status);await refreshing;
  expect(run.getSnapshot()).toMatchObject({state:'succeeded',completion,busy:false});detach();
});
it('holds sending when active-execution restoration failed and retries the read before admitting new work',async()=>{
  api.fetchActiveAgentExecution.mockRejectedValueOnce(new Error('network lost'));
  const run=new AgentConversationRun('owner',conversation);await run.restore();
  await run.send({type:'reply',message:'Uncertain duplicate'},0,{funding:'cash'},'csrf');
  expect(api.acceptAgentExecution).not.toHaveBeenCalled();expect(run.getSnapshot().error).toBeTruthy();
  api.fetchActiveAgentExecution.mockResolvedValue(null);await run.retry('csrf');
  expect(api.acceptAgentExecution).not.toHaveBeenCalled();
  await run.send({type:'reply',message:'Known new request'},0,{funding:'cash'},'csrf');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('reports admission separately from a failed acceptance so the composer keeps an unaccepted draft',async()=>{
  api.fetchActiveAgentExecution.mockRejectedValueOnce(new Error('network lost'));
  const run=new AgentConversationRun('owner',conversation);
  expect(await run.send({type:'reply',message:'Keep my text'},0,{funding:'cash'},'csrf')).toBe(false);
  api.fetchActiveAgentExecution.mockResolvedValue(null);await run.retry('csrf');
  api.acceptAgentExecution.mockRejectedValueOnce(new Error('uncertain acceptance'));
  expect(await run.send({type:'reply',message:'Preserve the operation'},0,{funding:'cash'},'csrf')).toBe(true);
  expect(run.getSnapshot().pendingGeneration?.action).toEqual({type:'reply',message:'Preserve the operation'});
});
it('continues fee-status reads when an explicit stop finds an already-completed result',async()=>{
  vi.useFakeTimers();
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});
  await run.send({type:'reply',message:'Original'},0,{funding:'cash'},'csrf');
  api.stopAgentExecution.mockResolvedValue({...status,state:'succeeded',result:completion});
  await run.stop('csrf');
  const settled={...completion,settlement:{status:'settled' as const,cashMicros:2000,pointUnits:null,balanceMicros:5000}};
  api.fetchAgentExecution.mockResolvedValue({...status,state:'succeeded',result:settled});
  await vi.advanceTimersByTimeAsync(30000);
  expect(run.getSnapshot().completion).toEqual(settled);expect(api.acceptAgentExecution).toHaveBeenCalledOnce();detach();
});
it('refreshes a completed pending settlement without generating or accepting another execution',async()=>{
  vi.useFakeTimers();api.fetchActiveAgentExecution.mockResolvedValue({...status,state:'succeeded',result:completion});
  const settled={...completion,settlement:{status:'settled' as const,cashMicros:2000,pointUnits:null,balanceMicros:5000}};
  api.fetchAgentExecution.mockResolvedValue({...status,state:'succeeded',result:settled});
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();
  await vi.advanceTimersByTimeAsync(30000);
  expect(run.getSnapshot().completion).toEqual(settled);expect(api.acceptAgentExecution).not.toHaveBeenCalled();detach();
});
it('keeps an undelivered stop request across reload and retries the same stop identity with the current CSRF',async()=>{
  const run=new AgentConversationRun('owner',conversation);await run.send({type:'reply',message:'Original'},0,{funding:'cash'},'csrf');
  api.stopAgentExecution.mockRejectedValueOnce(new Error('network lost'));
  await run.stop('csrf');const stopIdentity=api.stopAgentExecution.mock.calls[0][2];
  const restored=new AgentConversationRun('owner',conversation);await restored.restore();
  api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});
  await restored.resumeRequestedStop('fresh-csrf');
  expect(api.stopAgentExecution.mock.calls[1]).toEqual([execution,conversation,stopIdentity,'fresh-csrf']);
  expect(restored.getSnapshot().stopped).toBe(true);expect(JSON.stringify(sessionStorage)).not.toContain('csrf');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('sends an uncapped user message once and never saves a transient API Key',async()=>{
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});
  const message='长输入'.repeat(30000);
  api.acceptAgentExecution.mockResolvedValue({execution:{...status,funding:'byok'},replayed:false});
  await run.send({type:'reply',message},0,{funding:'byok',modelAccess:{apiKey:'private-session-key',baseUrl:'https://model.example/v1',model:'model',contextWindow:131072,reasoningProtocol:'none',reasoningSupported:false}},'csrf');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  expect(api.acceptAgentExecution.mock.calls[0][1].action.message).toBe(message);
  expect(JSON.stringify(sessionStorage)).not.toContain('private-session-key');detach();
});
it('detaches only the reader on navigation and restores the same execution from its cursor',async()=>{
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  let deliver:(event:AgentEvent)=>void=()=>{};let reader:AbortSignal|undefined;
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{deliver=onEvent;reader=signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});await run.restore();await vi.waitFor(()=>expect(reader).toBeDefined());
  deliver({executionId:execution,eventId:'55555555-5555-4555-8555-555555555555',sequence:7,payload:{type:'text_delta',text:'Partial'}});
  detach();expect(reader?.aborted).toBe(true);expect(api.stopAgentExecution).not.toHaveBeenCalled();
  const detachAgain=run.subscribe(()=>{});await vi.waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalledTimes(2));
  expect(api.attachAgentExecution.mock.calls[1][2]).toBe(7);expect(api.acceptAgentExecution).not.toHaveBeenCalled();detachAgain();
});
it.each([false,true])('keeps received reasoning, tool progress and answer when returning to a streaming conversation (global=%s)',async global=>{
  vi.useFakeTimers();api.fetchActiveAgentExecution.mockResolvedValue(status);
  const readers:Array<(event:AgentEvent)=>void>=[];
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{readers.push(onEvent);return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:global});
  let detach=run.subscribe(()=>{});
  try{
    await run.restore();expect(readers).toHaveLength(1);
    const deliver=(reader:number,sequence:number,payload:AgentEvent['payload'])=>readers[reader]({executionId:execution,eventId:crypto.randomUUID(),sequence,payload});
    deliver(0,1,{type:'reasoning_delta',text:'先确认学习目标'});
    deliver(0,2,{type:'tool_process',toolName:'read_canvas',state:'started',callId:'read-1'});
    deliver(0,3,{type:'text_delta',text:'正在整理已有知识'});
    expect(run.getSnapshot().draft).toBe('');
    detach();
    const receivedProcess=[{type:'reasoning',text:'先确认学习目标'},{type:'tool',name:'read_canvas',state:'started'}];
    expect(run.getSnapshot()).toMatchObject({draft:'正在整理已有知识',process:receivedProcess});
    const notifications:Array<{draft:string;process:unknown[]}>=[];
    detach=run.subscribe(()=>{const {draft,process}=run.getSnapshot();notifications.push({draft,process});});
    await Promise.resolve();expect(readers).toHaveLength(2);
    expect(run.getSnapshot()).toMatchObject({draft:'正在整理已有知识',process:receivedProcess});
    expect(notifications.every(snapshot=>snapshot.draft==='正在整理已有知识'&&JSON.stringify(snapshot.process)===JSON.stringify(receivedProcess))).toBe(true);
    expect(api.attachAgentExecution.mock.calls[1][2]).toBe(3);
    deliver(0,4,{type:'reasoning_delta',text:'旧读取器的迟到事件'});
    deliver(1,4,{type:'reasoning_delta',text:'再补充例子'});
    deliver(1,5,{type:'tool_process',toolName:'read_canvas',state:'completed',callId:'read-1'});
    deliver(1,6,{type:'text_delta',text:'，继续学习。'});
    await vi.advanceTimersByTimeAsync(1000);
    expect(run.getSnapshot()).toMatchObject({draft:'正在整理已有知识，继续学习。',process:[...receivedProcess,{type:'reasoning',text:'再补充例子'},{type:'tool',name:'read_canvas',state:'completed'}]});
    expect(api.acceptAgentExecution).not.toHaveBeenCalled();expect(api.stopAgentExecution).not.toHaveBeenCalled();expect(api.resumeAgentExecution).not.toHaveBeenCalled();
  }finally{detach();}
});
it('reloads a saved execution identity by GET, including a completed result with unknown fees',async()=>{
  const first=new AgentConversationRun('owner',conversation);await first.send({type:'reply',message:'Question'},0,{funding:'cash'},'csrf');
  api.fetchAgentExecution.mockResolvedValue({...status,state:'succeeded',result:completion});
  const restored=new AgentConversationRun('owner',conversation);await restored.restore();
  expect(restored.getSnapshot().completion).toEqual(completion);expect(restored.getSnapshot().error).toBeNull();
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();expect(api.fetchAgentExecution).toHaveBeenCalledWith(execution,conversation,expect.any(AbortSignal));
});
it('retries an ambiguous acceptance using the original operation and funding instead of creating a second task',async()=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new Error('connection lost'));
  const run=new AgentConversationRun('owner',conversation);await run.send({type:'reply',message:'Question'},0,{funding:'cash',profileId:'original',profileVersion:1},'csrf');
  const original=api.acceptAgentExecution.mock.calls[0][1];
  await run.retry('csrf');
  expect(api.acceptAgentExecution.mock.calls[1][1]).toEqual(original);expect(run.getSnapshot().executionId).toBe(execution);
});
it('changes to a different model cannot replace an already accepted execution',async()=>{
  const run=new AgentConversationRun('owner',conversation);await run.send({type:'reply',message:'First'},0,{funding:'cash'},'csrf');
  await run.send({type:'reply',message:'Second'},0,{funding:'points'},'csrf');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();expect(run.getSnapshot().funding).toBe('cash');
});
it('only an explicit stop mutates the task and uses the saved completion if submission already won',async()=>{
  const run=new AgentConversationRun('owner',conversation);await run.send({type:'reply',message:'Question'},0,{funding:'cash'},'csrf');
  api.stopAgentExecution.mockResolvedValue({...status,state:'succeeded',result:completion});await run.stop('csrf');
  expect(api.stopAgentExecution).toHaveBeenCalledWith(execution,conversation,expect.any(String),'csrf');
  expect(run.getSnapshot().completion).toEqual(completion);expect(run.getSnapshot().stopped).toBe(false);
});
it('keeps a trusted completed event usable when the subsequent status read fails',async()=>{
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  api.attachAgentExecution.mockImplementation(async(_id,_conversation,_after,onEvent)=>{
    onEvent({executionId:execution,eventId:'55555555-5555-4555-8555-555555555555',sequence:9,payload:{type:'completed',result:completion}});
    return {nextSequence:9,state:'succeeded'};
  });
  api.fetchAgentExecution.mockRejectedValue(new Error('database read unavailable'));
  const run=new AgentConversationRun('owner',conversation);const detach=run.subscribe(()=>{});
  await vi.waitFor(()=>expect(run.getSnapshot().completion).toEqual(completion));
  expect(run.getSnapshot().busy).toBe(false);expect(run.getSnapshot().pendingGeneration).toBeNull();expect(run.getSnapshot().error).toBeNull();detach();
});
it('retains an explicit stop pressed before the acceptance response arrives',async()=>{
  let accepted:(value:unknown)=>void=()=>{};
  api.acceptAgentExecution.mockImplementation(()=>new Promise(resolve=>{accepted=resolve;}));
  api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});
  const run=new AgentConversationRun('owner',conversation);const sending=run.send({type:'reply',message:'Question'},0,{funding:'cash'},'csrf');
  await vi.waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());await run.stop('csrf');
  accepted({execution:status,replayed:false});await sending;
  expect(api.stopAgentExecution).toHaveBeenCalledOnce();expect(run.getSnapshot().stopped).toBe(true);
});
it('releases only a confirmed stopped operation so the next send can use its own identity',async()=>{
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await run.send({type:'reply',message:'Original'},0,{funding:'cash',bindingVersion:7},'csrf');
  api.stopAgentExecution.mockRejectedValueOnce(new Error('stop response lost'));
  await run.stop('csrf');
  expect(run.getSnapshot().pendingGeneration).not.toBeNull();
  api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});
  await run.stop('csrf');
  expect(run.getSnapshot().pendingGeneration).toBeNull();
  expect(run.getSnapshot().executionId).toBe(execution);
  api.acceptAgentExecution.mockResolvedValue({execution:{...status,executionId:'66666666-6666-4666-8666-666666666666'},replayed:false});
  expect(await run.send({type:'reply',message:'Next'},1,{funding:'cash',bindingVersion:7},'csrf')).toBe(true);
  expect(api.acceptAgentExecution.mock.calls[1][1].clientActionId).not.toBe(api.acceptAgentExecution.mock.calls[0][1].clientActionId);
  expect(api.acceptAgentExecution.mock.calls[1][1].bindingVersion).toBe(7);
});
it('attaches a projected active execution without reaccepting and ignores a projection read before a newer execution',async()=>{
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await run.restore();
  run.synchronizeStatus(status,null);
  expect(run.getSnapshot()).toMatchObject({executionId:execution,state:'running'});
  api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});await run.stop('csrf');
  const nextExecution='66666666-6666-4666-8666-666666666666';api.acceptAgentExecution.mockResolvedValue({execution:{...status,executionId:nextExecution},replayed:false});
  await run.send({type:'reply',message:'Next'},1,{funding:'cash',bindingVersion:7},'csrf');
  run.synchronizeStatus({...status,state:'stopped'},execution);
  expect(run.getSnapshot()).toMatchObject({executionId:nextExecution,state:'running',busy:true});
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('does not keep a terminally rejected global command available for automatic replay',async()=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('global_conversation_not_current',409));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await run.send({type:'reply',message:'Original draft'},0,{funding:'cash',bindingVersion:1},'csrf');
  expect(run.getSnapshot().pendingGeneration).toBeNull();
  await run.retry('csrf');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  const stored=JSON.parse(sessionStorage.getItem(`mapflow.agent.execution.v1.owner.${conversation}`)!);
  expect(stored.command).toBeNull();
});
it('restores safe model metadata for an ambiguous BYOK acceptance without restoring its credential',async()=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new Error('lost acceptance'));
  const first=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await first.send({type:'reply',message:'Original'},0,{funding:'byok',bindingVersion:2,modelAccess:{apiKey:'ephemeral-test-key',baseUrl:'https://model.example/v1',model:'original-byok',contextWindow:128000,reasoningProtocol:'none',reasoningSupported:false}},'csrf');
  const recovered=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await recovered.restore();
  expect(recovered.getSnapshot()).toMatchObject({funding:'byok',modelId:'original-byok',pendingGeneration:{action:{type:'reply',message:'Original'}}});
  expect(JSON.stringify(sessionStorage)).not.toContain('ephemeral-test-key');
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('retries a failed execution-state read explicitly without reaccepting the original request',async()=>{
  api.fetchActiveAgentExecution.mockRejectedValueOnce(new Error('state read unavailable'));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await run.restore();
  api.fetchActiveAgentExecution.mockResolvedValue(status);await run.checkStatus();
  expect(run.getSnapshot()).toMatchObject({executionId:execution,state:'running',error:null});
  expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('allows explicit return to editing only after a confirmed unaccepted global revision conflict, including refresh',async()=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('global_assistant_revision_conflict',409));
  const first=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await first.send({type:'reply',message:'Original rejected request'},4,{funding:'cash',bindingVersion:2},'csrf');
  const recovered=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await recovered.restore();
  expect(recovered.returnRejectedToEdit()).toEqual({type:'reply',message:'Original rejected request'});
  expect(recovered.getSnapshot()).toMatchObject({executionId:null,pendingGeneration:null,busy:false,error:null});
  await recovered.retry('csrf');expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  expect(JSON.parse(sessionStorage.getItem(`mapflow.agent.execution.v1.owner.${conversation}`)!).command).toBeNull();
});
it.each(['succeeded','stopped'] as const)('keeps a rejected request independent across two refreshes and another device execution ending %s',async terminalState=>{
  const rejected={type:'reply' as const,message:'Rejected A must survive the other device request'};
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('global_assistant_revision_conflict',409));
  const first=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await first.send(rejected,4,{funding:'byok',bindingVersion:2,modelAccess:{apiKey:'never-persist-this-key',baseUrl:'https://model.example/v1',model:'rejected-model',contextWindow:128000,reasoningProtocol:'none',reasoningSupported:false}},'csrf');
  const actionId=api.acceptAgentExecution.mock.calls[0][1].clientActionId;
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  const refreshed=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await refreshed.restore();
  expect(refreshed.getSnapshot()).toMatchObject({executionId:execution,funding:'cash',modelId:'original-model',state:'running',
    pendingGeneration:{clientActionId:execution,action:{type:'reply',message:''}},rejectedGeneration:{clientActionId:actionId,action:rejected}});
  expect(refreshed.returnRejectedToEdit()).toBeNull();
  const refreshedAgain=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await refreshedAgain.restore();
  expect(refreshedAgain.getSnapshot()).toMatchObject({executionId:execution,state:'running',pendingGeneration:{clientActionId:execution},rejectedGeneration:{clientActionId:actionId,action:rejected}});
  const finished:AgentStatus={...status,state:terminalState,result:terminalState==='succeeded'?{...completion,settlement:{status:'no_site_charge',cashMicros:null,pointUnits:null,balanceMicros:null}}:null};
  if(terminalState==='stopped'){api.stopAgentExecution.mockResolvedValue(finished);await refreshedAgain.stop('csrf');}
  else {api.fetchAgentExecution.mockResolvedValue(finished);await refreshedAgain.checkStatus();}
  expect(refreshedAgain.getSnapshot()).toMatchObject({executionId:execution,state:terminalState,pendingGeneration:null,completedAction:null,
    completion:finished.result,rejectedGeneration:{clientActionId:actionId,action:rejected}});
  api.fetchAgentExecution.mockResolvedValue(finished);
  const afterTerminalRefresh=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await afterTerminalRefresh.restore();
  expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
  expect(JSON.stringify(sessionStorage)).not.toContain('never-persist-this-key');
  expect(afterTerminalRefresh.returnRejectedToEdit()).toEqual(rejected);
  expect(afterTerminalRefresh.getSnapshot()).toMatchObject({executionId:execution,state:terminalState,completion:finished.result,completedAction:null,rejectedGeneration:null,confirmedUnaccepted:false});
  expect(afterTerminalRefresh.returnRejectedToEdit()).toBeNull();
  await afterTerminalRefresh.retry('csrf');expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('migrates the original rejected-command proof before attaching another device execution',async()=>{
  const actionId=crypto.randomUUID(),rejected={type:'reply' as const,message:'Rejected before the recovery schema changed'};
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:null,
    command:{clientActionId:actionId,expectedRevision:4,bindingVersion:2,funding:'cash',action:rejected},unacceptedActionId:actionId}));
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await run.restore();
  expect(run.getSnapshot()).toMatchObject({executionId:execution,pendingGeneration:{clientActionId:execution},rejectedGeneration:{clientActionId:actionId,action:rejected}});
  api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});await run.stop('csrf');
  expect(run.returnRejectedToEdit()).toEqual(rejected);expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('keeps a separate unknown operation frozen even when a rejected draft is also saved',async()=>{
  const unknownId=crypto.randomUUID(),rejectedId=crypto.randomUUID();
  const command={clientActionId:unknownId,expectedRevision:4,bindingVersion:2,funding:'cash',action:{type:'reply',message:'Unknown acceptance must keep its identity'}};
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:null,command,
    rejectedCommand:{...command,clientActionId:rejectedId,action:{type:'reply',message:'Independently rejected'}},unacceptedActionId:rejectedId}));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await run.restore();
  expect(run.getSnapshot().pendingGeneration?.clientActionId).toBe(unknownId);
  expect(run.returnRejectedToEdit()).toBeNull();
  expect(await run.send({type:'reply',message:'Must not replace the unknown request'},5,{funding:'cash',bindingVersion:2},'csrf')).toBe(false);
  await run.retry('csrf');expect(api.acceptAgentExecution).toHaveBeenCalledOnce();expect(api.acceptAgentExecution.mock.calls[0][1]).toEqual(command);
});
it('does not restore a rejected command whose saved proof names another operation',async()=>{
  const actionId=crypto.randomUUID();
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:null,
    command:{clientActionId:actionId,expectedRevision:4,bindingVersion:2,funding:'cash',action:{type:'reply',message:'Uncertain request'}},
    rejectedCommand:{clientActionId:actionId,expectedRevision:4,bindingVersion:2,funding:'cash',action:{type:'reply',message:'Uncertain request'}},unacceptedActionId:crypto.randomUUID()}));
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await run.restore();
  expect(run.getSnapshot()).toMatchObject({confirmedUnaccepted:false,rejectedGeneration:null,pendingGeneration:{clientActionId:actionId}});
  expect(run.returnRejectedToEdit()).toBeNull();expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('does not carry the rejected request stop intent onto another device execution',async()=>{
  let rejectAcceptance:(failure:unknown)=>void=()=>{};
  api.acceptAgentExecution.mockImplementation(()=>new Promise((_resolve,reject)=>{rejectAcceptance=reject;}));
  const first=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  const sending=first.send({type:'reply',message:'A was never accepted'},4,{funding:'cash',bindingVersion:2},'csrf');
  await vi.waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());await first.stop('csrf');
  rejectAcceptance(new AgentApiError('global_assistant_revision_conflict',409));await sending;
  expect(first.getSnapshot().stopRequested).toBe(false);
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  const refreshed=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});await refreshed.restore();await refreshed.resumeRequestedStop('csrf');
  expect(refreshed.getSnapshot()).toMatchObject({executionId:execution,state:'running',stopRequested:false,rejectedGeneration:{action:{type:'reply',message:'A was never accepted'}}});
  expect(api.stopAgentExecution).not.toHaveBeenCalled();expect(api.acceptAgentExecution).toHaveBeenCalledOnce();
});
it('keeps the rejected slot separate from completion, fees and late stop callbacks when the next explicit send starts',async()=>{
  const actionId=crypto.randomUUID(),rejected={type:'reply' as const,message:'Recover A without changing the B receipt'};
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:null,
    command:{clientActionId:actionId,expectedRevision:4,bindingVersion:2,funding:'cash',action:rejected},unacceptedActionId:actionId}));
  api.fetchActiveAgentExecution.mockResolvedValue(status);
  const readers:Array<(event:AgentEvent)=>void>=[];
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{readers.push(onEvent);return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});const detach=run.subscribe(()=>{});
  try{
    await run.restore();await vi.waitFor(()=>expect(readers).toHaveLength(1));
    let finishStop:(value:AgentStatus)=>void=()=>{};api.stopAgentExecution.mockImplementation(()=>new Promise(resolve=>{finishStop=resolve;}));
    const stopping=run.stop('csrf');
    readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:8,payload:{type:'completed',result:completion}});
    expect(run.getSnapshot().completedAction).toBeNull();expect(run.returnRejectedToEdit()).toEqual(rejected);
    const settled={status:'settled' as const,cashMicros:4000,pointUnits:null,balanceMicros:5000};
    readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:9,payload:{type:'settlement',settlement:settled,usage:null}});
    expect(run.getSnapshot()).toMatchObject({executionId:execution,completion:{settlement:settled},rejectedGeneration:null});
    const nextExecution='66666666-6666-4666-8666-666666666666';api.acceptAgentExecution.mockResolvedValue({execution:{...status,executionId:nextExecution},replayed:false});
    expect(await run.send(rejected,5,{funding:'cash',bindingVersion:2},'csrf')).toBe(true);
    finishStop({...status,state:'stopped'});await stopping;
    readers[0]({executionId:execution,eventId:crypto.randomUUID(),sequence:10,payload:{type:'settlement',settlement:settled,usage:null}});
    expect(run.getSnapshot()).toMatchObject({executionId:nextExecution,state:'running',busy:true,completion:null,rejectedGeneration:null,confirmedUnaccepted:false});
    expect(api.acceptAgentExecution).toHaveBeenCalledOnce();expect(api.acceptAgentExecution.mock.calls[0][1].clientActionId).not.toBe(actionId);
  }finally{detach();}
});
it.each([
  ['generic conflict',new AgentApiError('execution_conflict',409)],
  ['server failure',new AgentApiError('request_failed',503)],
  ['reserved code with a non-authoritative status',new AgentApiError('global_assistant_revision_conflict',503)],
  ['unknown network outcome',new Error('connection lost')],
])('keeps the original operation identity and forbids return-to-edit for %s',async(_label,failure)=>{
  api.acceptAgentExecution.mockRejectedValueOnce(failure);
  const run=new AgentConversationRun('owner',conversation,{releaseTerminalPending:true});
  await run.send({type:'reply',message:'Potentially accepted'},4,{funding:'cash',bindingVersion:2},'csrf');
  const original=api.acceptAgentExecution.mock.calls[0][1];
  expect(run.returnRejectedToEdit()).toBeNull();expect(run.getSnapshot().pendingGeneration?.clientActionId).toBe(original.clientActionId);
  await run.retry('csrf');expect(api.acceptAgentExecution.mock.calls[1][1]).toEqual(original);
});
it('does not enable the global rejected-edit path for a learning or tavern run',async()=>{
  api.acceptAgentExecution.mockRejectedValueOnce(new AgentApiError('global_assistant_revision_conflict',409));
  const run=new AgentConversationRun('owner',conversation);await run.send({type:'reply',message:'Existing scene request'},4,{funding:'cash'},'csrf');
  expect(run.getSnapshot().confirmedUnaccepted).toBe(false);expect(run.returnRejectedToEdit()).toBeNull();
  expect(run.getSnapshot().pendingGeneration).not.toBeNull();
  expect(JSON.parse(sessionStorage.getItem(`mapflow.agent.execution.v1.owner.${conversation}`)!)).not.toHaveProperty('unacceptedActionId');
});
