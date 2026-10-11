import {afterEach,expect,it,vi} from 'vitest';
import {acceptAgentExecution,attachAgentExecution,fetchActiveAgentExecution,fetchAgentExecution,fetchAgentModelCatalogue,stopAgentExecution} from './agentExecutionClient';

const executionId='11111111-1111-4111-8111-111111111111';
const conversationId='22222222-2222-4222-8222-222222222222';
const eventId='33333333-3333-4333-8333-333333333333';
const status={executionId,conversationId,state:'running',funding:'cash',modelId:'fixture-model',result:null,error:null};
afterEach(()=>vi.unstubAllGlobals());
function json(value:unknown,code=200){return new Response(JSON.stringify(value),{status:code,headers:{'Content-Type':'application/json'}});}
function stream(pages:unknown[]){return new Response(pages.map(page=>`event: progress\ndata: ${JSON.stringify(page)}\n\n`).join(''),{headers:{'Content-Type':'text/event-stream'}});}

it('accepts one explicitly identified operation without keeping a user key in browser storage',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({execution:{...status,funding:'byok'},replayed:false}));vi.stubGlobal('fetch',fetch);
  const before=JSON.stringify(localStorage);
  const command={clientActionId:'action-fixture',expectedRevision:1,action:{type:'reply' as const,message:'Explain session'},
    funding:'byok' as const,modelAccess:{apiKey:'private-user-fixture',baseUrl:'https://model.example/v1',model:'fixture-model',
      contextWindow:131072,reasoningProtocol:'none' as const,reasoningSupported:false}};
  expect((await acceptAgentExecution(conversationId,command,'csrf-fixture')).execution.executionId).toBe(executionId);
  expect(fetch).toHaveBeenCalledWith(`/api/me/tavern/conversations/${conversationId}/executions`,expect.objectContaining({
    method:'POST',credentials:'same-origin',headers:expect.objectContaining({'X-CSRF-Token':'csrf-fixture'}),body:JSON.stringify(command)}));
  expect(JSON.stringify(localStorage)).toBe(before);
});

it('reattaches by sequence, discards duplicated events and advances across private records',async()=>{
  const event={executionId,eventId,sequence:3,payload:{type:'text_delta',text:'Hello'}};
  const fetch=vi.fn().mockResolvedValue(stream([
    {events:[event],nextSequence:8,state:'running'},
    {events:[event,{...event,eventId:'44444444-4444-4444-8444-444444444444',sequence:9,payload:{type:'reasoning_delta',text:'Next'}}],nextSequence:12,state:'running'},
  ]));vi.stubGlobal('fetch',fetch);
  const received:unknown[]=[];
  const attachment=await attachAgentExecution(executionId,conversationId,2,event=>received.push(event),new AbortController().signal);
  expect(received).toHaveLength(2);expect(attachment).toEqual({nextSequence:12,state:'running'});
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`/api/me/agent-executions/${executionId}/events?afterSequence=2`);
  expect(fetch.mock.calls[0][1].method).toBe('GET');
});

it('keeps a newer completion terminal when an older replay page arrives in the same chunk',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(stream([
    {events:[],nextSequence:10,state:'succeeded'},
    {events:[],nextSequence:3,state:'running'},
  ])));
  expect(await attachAgentExecution(executionId,conversationId,8,()=>{},new AbortController().signal)).toEqual({nextSequence:10,state:'succeeded'});
});

it('accepts the persisted ready-to-commit state without claiming that publication has happened',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...status,state:'ready_to_commit'})));
  expect((await fetchAgentExecution(executionId,conversationId)).state).toBe('ready_to_commit');
});

it('rejects a funding path changed by an acceptance response',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({execution:{...status,funding:'points'},replayed:false})));
  await expect(acceptAgentExecution(conversationId,{clientActionId:'cash-action',expectedRevision:1,action:{type:'reply',message:'Hi'},funding:'cash'},'csrf-fixture')).rejects.toThrow('响应');
});

it('navigation aborts the stream reader and never sends a stop or another generation',async()=>{
  const controller=new AbortController();let cancel:unknown;
  const response=new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));},cancel(reason){cancel=reason;}}),{headers:{'Content-Type':'text/event-stream'}});
  const fetch=vi.fn().mockResolvedValue(response);vi.stubGlobal('fetch',fetch);
  const attached=attachAgentExecution(executionId,conversationId,0,()=>{},controller.signal);
  await Promise.resolve();await Promise.resolve();controller.abort();
  await expect(attached).rejects.toMatchObject({name:'AbortError'});expect(cancel).toBeDefined();
  expect(fetch).toHaveBeenCalledOnce();expect(fetch.mock.calls[0][1].method).toBe('GET');
});

it('only an explicit stop mutates the execution and preserves the server terminal result',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({...status,state:'stopped'}));vi.stubGlobal('fetch',fetch);
  expect((await stopAgentExecution(executionId,conversationId,'stop-fixture','csrf-fixture')).state).toBe('stopped');
  expect(fetch.mock.calls[0]).toEqual([`/api/me/agent-executions/${executionId}/stop`,expect.objectContaining({
    method:'POST',headers:expect.objectContaining({'X-CSRF-Token':'csrf-fixture'}),body:JSON.stringify({clientActionId:'stop-fixture'})})]);
});

it('retains unknown money as pending while making a complete result usable',async()=>{
  const result={executionId,conversationId,generationId:executionId,messageId:eventId,answer:'Done',maps:[],usage:null,
    settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...status,state:'succeeded',result})));
  const restored=await fetchAgentExecution(executionId,conversationId);
  expect(restored.result?.settlement.cashMicros).toBeNull();expect(restored.result?.answer).toBe('Done');
  expect(restored.result?.usage).toBeNull();
});

it('rejects results and active attachments from a different conversation',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>json({...status,conversationId:eventId})));
  await expect(fetchAgentExecution(executionId,conversationId)).rejects.toThrow('响应');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({execution:{...status,conversationId:eventId}})));
  await expect(fetchActiveAgentExecution(conversationId)).rejects.toThrow('响应');
});

it('classifies server network failure without echoing model routes or secret diagnostics',async()=>{
  const fetch=vi.fn().mockResolvedValue(json({error:{code:'server_network_unavailable',message:'private-provider.example sk-secret',requestId:executionId}},503));vi.stubGlobal('fetch',fetch);
  await expect(fetchAgentExecution(executionId,conversationId)).rejects.toMatchObject({message:'服务器网络异常，请稍后重试。',requestId:executionId});
});

it('keeps cash choice and points default separate and refuses credential-bearing public models',async()=>{
  const profile={profileId:'cash-1',profileVersion:1,modelId:'fixture-model',displayName:'Teaching model',contextWindow:131072,maxOutputTokens:null};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({cash:[profile],defaultCash:profile,points:null})));
  expect(await fetchAgentModelCatalogue()).toEqual({cash:[profile],defaultCash:profile,points:null});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({cash:[{...profile,apiKey:'private-key'}],defaultCash:profile,points:null})));
  await expect(fetchAgentModelCatalogue()).rejects.toThrow('响应');
});
