import {afterEach,expect,it,vi} from 'vitest';
import {GlobalAssistantController} from './GlobalAssistantController';

const conversationId='11111111-1111-4111-8111-111111111111';
const firstId='22222222-2222-4222-8222-222222222222',olderId='33333333-3333-4333-8333-333333333333',nextId='44444444-4444-4444-8444-444444444444';
const message=(messageId:string,content:string)=>({messageId,parentMessageId:null,role:'assistant',origin:'model',characterId:null,content});
const snapshot={conversationId,bindingVersion:2,graphRevision:10000,headMessageId:firstId,messages:[message(firstId,'已保存的回复')],completions:[],olderCursor:'older-40',syncCursor:'sync-10000',
  generationSettings:{maxOutputTokens:null,stopSequences:[]},generationSettingsVersion:1,activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true}};
const changes=(patch:Record<string,unknown>={})=>({conversationId,bindingVersion:2,graphRevision:10001,headMessageId:nextId,changes:[],nextCursor:'sync-10001',hasMore:false,
  activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true},...patch});
const json=(value:unknown)=>new Response(JSON.stringify(value));
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});

it.each(['','较新的未发送草稿'])('recovers a stranded cash question without replacing a newer draft (%s)',async draft=>{
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversationId}`,JSON.stringify({executionId:null,command:{clientActionId:firstId,
    expectedRevision:10000,bindingVersion:2,action:{type:'reply',message:'原来卡住的问题'},funding:'cash'}}));
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return json(snapshot);
    if(path.includes('/changes?'))return json(changes());
    if(path.endsWith('/executions')&&options?.method==='POST')return new Response(JSON.stringify({error:{code:'cash_non_positive'}}),{status:402});
    if(path.endsWith('/executions'))return json({execution:null});
    throw Error('Unexpected local fixture request');
  });
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().execution?.pendingGeneration).toBeTruthy());
  if(draft)controller.setDraft(draft);
  await controller.resume('synthetic-user-key');
  expect(controller.getSnapshot().execution?.pendingGeneration).toBeNull();
  expect(controller.getSnapshot().draft).toBe(draft||'原来卡住的问题');detach();
});

it('reads older messages and all incremental pages while retaining the draft and deduplicating stable message IDs',async()=>{
  const response=vi.fn().mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json({conversationId,bindingVersion:2,messages:[message(olderId,'更早的消息'),message(firstId,'旧投影')],completions:[],olderCursor:null}))
    .mockResolvedValueOnce(json(changes({changes:[{sequence:10001,type:'message',message:message(nextId,'新的回复')}],hasMore:true})))
    .mockResolvedValueOnce(json(changes({graphRevision:10002,changes:[{sequence:10002,type:'message',message:message(firstId,'已更新的回复')}],nextCursor:'sync-10002'})));
  const fetch=vi.fn((path:string)=>path.endsWith('/executions')?Promise.resolve(json({execution:null})):response());vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));
  controller.setDraft('继续编辑的草稿');
  await controller.loadOlder();await controller.sync();
  expect(controller.getSnapshot().timeline?.messages.map(item=>[item.messageId,item.content])).toEqual([[olderId,'更早的消息'],[firstId,'已更新的回复'],[nextId,'新的回复']]);
  expect(controller.getSnapshot()).toMatchObject({draft:'继续编辑的草稿',timeline:{syncCursor:'sync-10002',graphRevision:10002,olderCursor:null}});
  expect(fetch.mock.calls.map(([path])=>path).filter(path=>!path.endsWith('/executions'))).toEqual(['/api/me/global-assistant/open','/api/me/global-assistant/messages?before=older-40&limit=40','/api/me/global-assistant/changes?after=sync-10000&limit=100','/api/me/global-assistant/changes?after=sync-10001&limit=100']);
  detach();
});

it('waits for a confirmed stop, preserves edits made during execution, and sends the next request with the current binding',async()=>{
  const executionId='55555555-5555-4555-8555-555555555555';
  const status={executionId,conversationId,state:'running',funding:'cash',modelId:'original-model',result:null,error:null};
  let stopped=false,stopAttempts=0;
  const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return json(snapshot);
    if(path.endsWith('/executions')&&options?.method==='POST')return json({execution:status,replayed:false});
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/changes?'))return json(changes({sendAvailability:{conversation:stopped,cash:stopped}}));
    if(path.endsWith('/stop')){if(++stopAttempts===1)throw new Error('lost stop response');stopped=true;return json({...status,state:'stopped'});}
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    throw new Error(`Unexpected request ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));
  controller.setDraft('原问题');await controller.send({funding:'cash'});
  expect(controller.getSnapshot()).toMatchObject({draft:'',guidesDismissed:true,execution:{executionId,state:'running'}});
  controller.setDraft('尚未发送的新草稿');
  await controller.stop();
  expect(controller.getSnapshot().execution?.pendingGeneration).not.toBeNull();
  await controller.stop();
  expect(controller.getSnapshot()).toMatchObject({draft:'尚未发送的新草稿',execution:{state:'stopped',pendingGeneration:null},timeline:{sendAvailability:{conversation:true,cash:true}}});
  const stopRequests=fetch.mock.calls.filter(([path])=>path.endsWith('/stop'));
  expect(stopRequests[0][1]?.body).toBe(stopRequests[1][1]?.body);
  const command=JSON.parse(String(fetch.mock.calls.find(([path,options])=>path.endsWith('/executions')&&options?.method==='POST')?.[1]?.body));
  expect(command).toMatchObject({bindingVersion:2,expectedRevision:10000,action:{type:'reply',message:'原问题'}});
  detach();
});
it('shows prebinding blockers, stops the original execution, and reopens a bounded snapshot without sending the draft',async()=>{
  const blocker={executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'awaiting_reconciliation' as const,funding:'byok' as const,modelId:'original-model',result:null,error:null};
  let opened=false;
  const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return opened?json(snapshot):new Response(JSON.stringify({error:{code:'global_assistant_migration_pending',blockingExecutions:[blocker]}}),{status:409});
    if(path.endsWith('/stop')){opened=true;return json({...blocker,state:'stopped'});}
    if(path.endsWith('/executions'))return json({execution:null});
    throw new Error(`Unexpected ${path} ${options?.method}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));
  expect(controller.getSnapshot().blockingExecutions).toEqual([blocker]);
  controller.setDraft('仍未发送的草稿');await controller.stop(blocker);
  expect(controller.getSnapshot()).toMatchObject({draft:'仍未发送的草稿',error:null,timeline:{conversationId},blockingExecutions:[]});
  expect(fetch.mock.calls.filter(([path,options])=>path.endsWith('/executions')&&options?.method==='POST')).toHaveLength(0);
  detach();
});
it('reopens only the recent snapshot when a cursor expires and keeps the same questions and unsent draft',async()=>{
  let opens=0;
  const fetch=vi.fn(async(path:string)=>{
    if(path.endsWith('/open')){opens++;return json({...snapshot,syncCursor:`sync-open-${opens}`});}
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/changes?'))return new Response(JSON.stringify({error:{code:'global_assistant_cursor_invalid'}}),{status:409});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));
  const questions=controller.getSnapshot().questions;controller.setDraft('尚未发送');await controller.sync();
  await vi.waitFor(()=>expect(controller.getSnapshot().timeline?.syncCursor).toBe('sync-open-2'));
  expect(controller.getSnapshot()).toMatchObject({draft:'尚未发送',questions,syncError:null});
  expect(fetch.mock.calls.some(([path])=>/conversations\/[^/]+$/.test(path))).toBe(false);detach();
});
it('preserves a terminally rejected draft and acquires the current binding without resending it',async()=>{
  const newConversation='66666666-6666-4666-8666-666666666666';let opens=0;
  const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return json(++opens===1?snapshot:{...snapshot,conversationId:newConversation,bindingVersion:3});
    if(path.endsWith('/executions')&&options?.method==='POST')return new Response(JSON.stringify({error:{code:'global_conversation_not_current'}}),{status:409});
    if(path.endsWith('/executions'))return json({execution:null});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));
  controller.setDraft('原草稿');expect(await controller.send({funding:'cash'})).toBe(false);
  await vi.waitFor(()=>expect(controller.getSnapshot().timeline?.conversationId).toBe(newConversation));
  expect(controller.getSnapshot().draft).toBe('原草稿');
  expect(fetch.mock.calls.filter(([,options])=>options?.method==='POST'&&options.body)).toHaveLength(1);detach();
});
it('attaches an execution discovered by incremental synchronization without accepting a new model request',async()=>{
  const active={executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'running',funding:'cash',modelId:'other-device-model',result:null,error:null};
  const fetch=vi.fn(async(path:string)=>{
    if(path.endsWith('/open'))return json(snapshot);
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/changes?'))return json(changes({activeExecution:active,sendAvailability:{conversation:false,cash:true}}));
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));await controller.sync();
  expect(controller.getSnapshot().execution).toMatchObject({executionId:active.executionId,state:'running',modelId:'other-device-model'});
  expect(fetch.mock.calls.some(([path])=>path.includes(`/agent-executions/${active.executionId}/events?`))).toBe(true);detach();
});
it('keeps a trusted streamed completion and a new draft when incremental synchronization fails',async()=>{
  const executionId='55555555-5555-4555-8555-555555555555';
  const running={executionId,conversationId,state:'running',funding:'cash',modelId:'original',result:null,error:null};
  const receipt={executionId,conversationId,generationId:olderId,messageId:nextId,answer:'已确认保存的回复',maps:[],usage:null,settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
  let stream:ReadableStreamDefaultController<Uint8Array>|undefined;
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    if(path.endsWith('/open'))return json({...snapshot,activeExecution:running});
    if(path.endsWith('/executions'))return json({execution:running});
    if(path.includes('/changes?'))throw new Error('synchronization unavailable');
    if(path.includes('/events?'))return new Response(new ReadableStream<Uint8Array>({start(sink){stream=sink;}}),{headers:{'Content-Type':'text/event-stream'}});
    throw new Error(`Unexpected ${path}`);
  }));
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(stream).toBeDefined());controller.setDraft('另一个尚未发送的问题');
  stream!.enqueue(new TextEncoder().encode(`event: progress\ndata: ${JSON.stringify({events:[{executionId,eventId:crypto.randomUUID(),sequence:3,payload:{type:'completed',result:receipt}}],nextSequence:3,state:'succeeded'})}\n\n`));
  await vi.waitFor(()=>expect(controller.getSnapshot().syncError).toBeTruthy());
  expect(controller.getSnapshot()).toMatchObject({draft:'另一个尚未发送的问题',execution:{pendingGeneration:null,state:'succeeded'},timeline:{completions:[receipt]}});detach();
});
it('ignores an old synchronization response after a newer bounded snapshot has replaced the binding',async()=>{
  let resolveChanges:(response:Response)=>void=()=>{};let opens=0;
  const fetch=vi.fn(async(path:string)=>{
    if(path.endsWith('/open'))return json(++opens===1?snapshot:{...snapshot,bindingVersion:3,syncCursor:'new-binding',messages:[message(nextId,'当前绑定的回复')]});
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/changes?'))return new Promise<Response>(resolve=>{resolveChanges=resolve;});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));const reading=controller.sync();await controller.reload();
  resolveChanges(json(changes({changes:[{sequence:10001,type:'message',message:message(olderId,'过期回复')}]})));await reading;
  expect(controller.getSnapshot().timeline).toMatchObject({bindingVersion:3,syncCursor:'new-binding',messages:[message(nextId,'当前绑定的回复')]});detach();
});
it('sends the draft captured at the click and preserves text edited while original-state recovery was pending',async()=>{
  let restore:(response:Response)=>void=()=>{};
  const status={executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'running',funding:'cash',modelId:'cash',result:null,error:null};
  const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return json(snapshot);
    if(path.endsWith('/executions')&&options?.method==='POST')return json({execution:status,replayed:false});
    if(path.endsWith('/executions'))return new Promise<Response>(resolve=>{restore=resolve;});
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));controller.setDraft('点击时的原问题');
  const sending=controller.send({funding:'cash'});controller.setDraft('等待时写的新草稿');restore(json({execution:null}));await sending;
  const accepted=fetch.mock.calls.find(([,options])=>options?.method==='POST'&&options.body);
  expect(JSON.parse(String(accepted?.[1]?.body)).action.message).toBe('点击时的原问题');
  expect(controller.getSnapshot().draft).toBe('等待时写的新草稿');detach();
});
it('applies a fee update to its original receipt even when an older history response arrives later',async()=>{
  const executionId='55555555-5555-4555-8555-555555555555';
  const pending={status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null};
  const settled={status:'settled',cashMicros:2300,pointUnits:null,balanceMicros:5000};
  const receipt={executionId,conversationId,generationId:olderId,messageId:olderId,answer:'原回复',maps:[],usage:null,settlement:pending};
  let history:(response:Response)=>void=()=>{};
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    if(path.endsWith('/open'))return json(snapshot);
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/messages?'))return new Promise<Response>(resolve=>{history=resolve;});
    if(path.includes('/changes?'))return json(changes({changes:[{sequence:10001,type:'settlement',executionId,settlement:settled,usage:null}]}));
    throw new Error(`Unexpected ${path}`);
  }));
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));const reading=controller.loadOlder();await controller.sync();
  history(json({conversationId,bindingVersion:2,messages:[message(olderId,'原回复')],completions:[receipt],olderCursor:null}));await reading;
  expect(controller.getSnapshot().timeline?.completions[0].settlement).toEqual(settled);detach();
});
it('returns a confirmed rejected request to editing, preserves later edits, and requires an explicit new send after bounded refresh',async()=>{
  let rejectAcceptance:(response:Response)=>void=()=>{};let opens=0,accepts=0;
  let deliverOldChanges:(response:Response)=>void=()=>{};
  const active={executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'running',funding:'cash',modelId:'cash',result:null,error:null};
  const fetch=vi.fn(async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/open'))return json({...snapshot,graphRevision:++opens===1?4:5});
    if(path.endsWith('/executions')&&options?.method==='POST')return ++accepts===1?new Promise<Response>(resolve=>{rejectAcceptance=resolve;}):json({execution:active,replayed:false});
    if(path.endsWith('/executions'))return json({execution:null});
    if(path.includes('/changes?'))return new Promise<Response>(resolve=>{deliverOldChanges=resolve;});
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  try{
    await vi.waitFor(()=>expect(controller.getSnapshot().loading).toBe(false));controller.setDraft('被拒绝的原问题');const sending=controller.send({funding:'cash'});
    await vi.waitFor(()=>expect(accepts).toBe(1));controller.setDraft('等待期间继续写的新草稿');
    rejectAcceptance(new Response(JSON.stringify({error:{code:'global_assistant_revision_conflict'}}),{status:409}));
    expect(await sending).toBe(false);expect(controller.getSnapshot().draft).toBe('等待期间继续写的新草稿');
    const staleSync=controller.sync();
    expect(await controller.returnRejectedToEdit()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({draft:'等待期间继续写的新草稿\n被拒绝的原问题',timeline:{graphRevision:5},execution:{pendingGeneration:null}});
    expect(accepts).toBe(1);expect(await controller.returnRejectedToEdit()).toBe(false);
    expect(await controller.send({funding:'cash'})).toBe(true);
    const commands=fetch.mock.calls.filter(([,options])=>options?.method==='POST'&&options.body).map(([,options])=>JSON.parse(String(options?.body)));
    expect(commands[1]).toMatchObject({expectedRevision:5,bindingVersion:2,action:{type:'reply',message:'等待期间继续写的新草稿\n被拒绝的原问题'}});
    expect(commands[1].clientActionId).not.toBe(commands[0].clientActionId);
    controller.setDraft('第三条尚未发送的草稿');
    deliverOldChanges(json(changes({graphRevision:4,activeExecution:null})));await staleSync;
    expect(controller.getSnapshot()).toMatchObject({draft:'第三条尚未发送的草稿',execution:{executionId:active.executionId,state:'running',confirmedUnaccepted:false},timeline:{graphRevision:5}});
  }finally{detach();}
});
it('returns the separately saved rejected text after another device completes without assigning that text to its receipt',async()=>{
  const actionId=crypto.randomUUID(),rejectedText='尚未返回编辑的拒绝原文';
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversationId}`,JSON.stringify({executionId:null,
    command:{clientActionId:actionId,expectedRevision:4,bindingVersion:2,funding:'cash',action:{type:'reply',message:rejectedText}},unacceptedActionId:actionId}));
  const active={executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'running',funding:'cash',modelId:'other-device',result:null,error:null};
  const receipt={executionId:active.executionId,conversationId,generationId:olderId,messageId:nextId,answer:'别设备请求的回复',maps:[],usage:null,settlement:{status:'no_site_charge',cashMicros:null,pointUnits:null,balanceMicros:null}};
  let finished=false;
  const fetch=vi.fn(async(path:string,_options?:RequestInit)=>{
    if(path.endsWith('/open'))return json({...snapshot,activeExecution:finished?null:active,graphRevision:finished?6:5,completions:finished?[receipt]:[]});
    if(path.endsWith('/executions'))return json({execution:active});
    if(path.includes('/changes?'))return json(changes({activeExecution:finished?null:active}));
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    if(path.endsWith(`/agent-executions/${active.executionId}`)){finished=true;return json({...active,state:'succeeded',result:receipt});}
    throw new Error(`Unexpected ${path}`);
  });vi.stubGlobal('fetch',fetch);
  const controller=new GlobalAssistantController('owner','csrf');const detach=controller.subscribe(()=>{});
  try{
    await vi.waitFor(()=>expect(controller.getSnapshot().execution?.executionId).toBe(active.executionId));
    controller.setDraft('较新的输入不能覆盖');await controller.reconcile();
    expect(controller.getSnapshot().execution?.completedAction).toBeNull();
    expect(await controller.returnRejectedToEdit()).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({draft:`较新的输入不能覆盖\n${rejectedText}`,timeline:{graphRevision:6,completions:[receipt]},
      execution:{executionId:active.executionId,state:'succeeded',completion:receipt,completedAction:null,rejectedGeneration:null}});
    expect(fetch.mock.calls.filter(([,options])=>options?.method==='POST'&&options.body)).toHaveLength(0);
    expect(await controller.returnRejectedToEdit()).toBe(false);
  }finally{detach();}
});
