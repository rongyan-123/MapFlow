import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AgentConversationRun} from './agentConversationRun';
import type {AgentStatus,AgentEvent,AgentCompletion} from './agentExecutionClient';
const api=vi.hoisted(()=>({fetchActiveAgentExecution:vi.fn(),fetchAgentExecution:vi.fn(),acceptAgentExecution:vi.fn(),attachAgentExecution:vi.fn(),stopAgentExecution:vi.fn(),resumeAgentExecution:vi.fn()}));
vi.mock('./agentExecutionClient',async original=>({...await original<typeof import('./agentExecutionClient')>(),...api}));
const conversation='11111111-1111-4111-8111-111111111111',execution='22222222-2222-4222-8222-222222222222';
const completion:AgentCompletion={executionId:execution,conversationId:conversation,generationId:'33333333-3333-4333-8333-333333333333',messageId:'44444444-4444-4444-8444-444444444444',answer:'Saved answer',maps:[],usage:null,
  settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
const status:AgentStatus={executionId:execution,conversationId:conversation,state:'running',funding:'cash',modelId:'original-model',result:null,error:null};
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();api.fetchActiveAgentExecution.mockResolvedValue(null);api.fetchAgentExecution.mockResolvedValue(status);api.acceptAgentExecution.mockResolvedValue({execution:status,replayed:false});
  api.attachAgentExecution.mockImplementation((_id,_conversation,_after,_onEvent,signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));});
afterEach(()=>{vi.useRealTimers();});
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
