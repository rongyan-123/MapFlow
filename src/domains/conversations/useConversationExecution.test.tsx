import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { detail } from '../../test/conversations';
import { useConversationExecution } from './useConversationExecution';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const conversationId='22222222-2222-4222-8222-222222222222';
const saved={...detail,conversation:{...detail.conversation,conversationId}};
function setup(funding:'cash'|'byok'='cash',initialDraft='',available=true){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const recovered=vi.fn();
  return {recovered,...renderHook(()=>useConversationExecution({detail:saved,accountId:'a',csrfToken:'csrf-a',initialDraft,modelSelection:{provider:'custom',apiKey:'',baseUrl:'',model:'',settings:{},historyBytes:32768},agentOptions:{funding,contextWindow:32000,...(available?{profileId:'33333333-3333-4333-8333-333333333333',profileVersion:2}:{})},onRecovered:recovered,onCompleted:vi.fn(),onGraphChanged:vi.fn()}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})};
}
it('a removed cash choice preserves the composer without silently sending the platform default',async()=>{
  const commands:RequestInit[]=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{if(options?.method==='POST')commands.push(options);return Response.json({execution:null});});
  const view=setup('cash','保留这个问题',false);await act(async()=>view.result.current.runGeneration({type:'reply',message:'保留这个问题'}));
  expect(commands).toEqual([]);expect(view.result.current.message).toBe('保留这个问题');expect(view.result.current.error).toBeTruthy();view.unmount();
});
it('takes an unsent entry-screen draft into the newly opened conversation without sending it',async()=>{
  const requests:RequestInit[]=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{if(options)requests.push(options);return new Response(JSON.stringify({execution:null}));});
  const view=setup('cash','帮我创建地图，我想学 C');await waitFor(()=>expect(view.result.current.nativeSnapshot?.error).toBeNull());
  expect(view.result.current.message).toBe('帮我创建地图，我想学 C');expect(requests.every(request=>request.method!=='POST')).toBe(true);view.unmount();
});
it('keeps the message editable after an invalid BYOK preflight and sends no command',async()=>{
  const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({execution:null})));vi.stubGlobal('fetch',fetchMock);const view=setup('byok');
  act(()=>view.result.current.setMessage('我的问题'));await act(async()=>view.result.current.runGeneration({type:'reply',message:'我的问题'}));
  expect(view.result.current.message).toBe('我的问题');expect(view.result.current.error).toBeTruthy();
  expect(fetchMock.mock.calls.every(call=>(call[1] as RequestInit|undefined)?.method!=='POST')).toBe(true);
});
it('reads a saved legacy request before admitting new Agent commands after an upgrade',async()=>{
  const actionId='44444444-4444-4444-8444-444444444444';const storageKey=`mapflow.tavern.pending.v1.a.${conversationId}`;
  sessionStorage.setItem(storageKey,JSON.stringify({clientActionId:actionId,expectedRevision:1,action:{type:'reply',message:'旧请求'}}));
  const requests:Array<RequestInit|undefined>=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{requests.push(options);return new Response(JSON.stringify(path.endsWith('/executions')?{execution:null}:{...saved,generations:[{...saved.generations[0],clientActionId:actionId}]}));});
  const view=setup();await waitFor(()=>expect(view.recovered).toHaveBeenCalled());
  expect(sessionStorage.getItem(storageKey)).toBeNull();expect(requests.every(request=>request?.method!=='POST')).toBe(true);view.unmount();
});
it('persists one command identity before a lost response and does not automatically resend it',async()=>{
  const commands:RequestInit[]=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{if(options?.method==='POST'){commands.push(options);throw new TypeError('response lost');}return new Response(JSON.stringify({execution:null}));});
  const view=setup();await waitFor(()=>expect(view.result.current.nativeSnapshot?.error).toBeNull());
  await act(async()=>view.result.current.runGeneration({type:'reply',message:'想学 CSV'}));
  expect(commands).toHaveLength(1);const sent=JSON.parse(String(commands[0].body));
  expect(sent).toMatchObject({expectedRevision:1,profileId:'33333333-3333-4333-8333-333333333333',profileVersion:2,funding:'cash',action:{type:'reply',message:'想学 CSV'}});
  expect(commands[0].headers).toMatchObject({'X-CSRF-Token':'csrf-a'});
  const recovery=sessionStorage.getItem(`mapflow.agent.execution.v1.a.${conversationId}`);expect(recovery).toContain(sent.clientActionId);
  await act(async()=>{await Promise.resolve();});expect(commands).toHaveLength(1);view.unmount();
});
it('keeps a cash-rejected question editable and sends it with BYOK after the user switches funding',async()=>{
  const commands:Array<Record<string,unknown>>=[];
  vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){
      const command=JSON.parse(String(options.body));commands.push(command);
      if(command.funding==='cash')return new Response(JSON.stringify({error:{code:'cash_non_positive',message:'Insufficient site balance'}}),{status:402});
      return new Response(JSON.stringify({execution:{executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'stopped',funding:'byok',modelId:'user-model',result:null,error:null},replayed:false}));
    }
    return new Response(JSON.stringify({execution:null}));
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const view=renderHook(({funding}:{funding:'cash'|'byok'})=>useConversationExecution({detail:saved,accountId:'negative-site-balance',csrfToken:'csrf-a',initialDraft:'保留这个问题',
    modelSelection:{provider:'custom',apiKey:'synthetic-user-key',baseUrl:'https://models.example/v1',model:'user-model',settings:{},historyBytes:32768},
    agentOptions:{funding,contextWindow:32000,...(funding==='cash'?{profileId:'selected-cash',profileVersion:1}:{})},onRecovered:vi.fn(),onCompleted:vi.fn(),onGraphChanged:vi.fn()}),
    {initialProps:{funding:'cash' as 'cash'|'byok'},wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
  await act(async()=>view.result.current.runGeneration({type:'reply',message:view.result.current.message}));
  expect(view.result.current.message).toBe('保留这个问题');expect(view.result.current.pendingGeneration).toBeNull();
  view.rerender({funding:'byok'});
  await act(async()=>view.result.current.runGeneration({type:'reply',message:view.result.current.message}));
  expect(commands).toHaveLength(2);expect(commands[1]).toMatchObject({funding:'byok',action:{type:'reply',message:'保留这个问题'},modelAccess:{model:'user-model',apiKey:'synthetic-user-key'}});
  expect(commands[1].clientActionId).not.toBe(commands[0].clientActionId);
  expect(sessionStorage.getItem(`mapflow.agent.execution.v1.negative-site-balance.${conversationId}`)).not.toContain('synthetic-user-key');view.unmount();
});
it('restores the question from a previously stranded cash retry after a confirmed rejection',async()=>{
  sessionStorage.setItem(`mapflow.agent.execution.v1.a.${conversationId}`,JSON.stringify({executionId:null,
    command:{clientActionId:'44444444-4444-4444-8444-444444444444',expectedRevision:1,funding:'cash',action:{type:'reply',message:'升级前卡住的原问题'}}}));
  vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>options?.method==='POST'
    ?new Response(JSON.stringify({error:{code:'cash_non_positive'}}),{status:402}):new Response(JSON.stringify({execution:null})));
  const view=setup('byok');
  await waitFor(()=>expect(view.result.current.pendingGeneration).not.toBeNull());
  await act(async()=>view.result.current.runGeneration(view.result.current.pendingGeneration!.action,view.result.current.pendingGeneration!));
  expect(view.result.current.pendingGeneration).toBeNull();expect(view.result.current.message).toBe('升级前卡住的原问题');view.unmount();
});
it.each(['accepted','response lost'] as const)('preserves a newer unsent draft after a delayed %s response',async(outcome)=>{
  let resolveResponse!:(response:Response)=>void;let rejectResponse!:(failure:Error)=>void;
  const response=new Promise<Response>((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject;});
  const commands:RequestInit[]=[];
  vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{if(options?.method==='POST'){commands.push(options);return response;}return new Response(JSON.stringify({execution:null}));});
  const view=setup('cash','first question');let sending!:Promise<void>;
  act(()=>{sending=view.result.current.runGeneration({type:'reply',message:view.result.current.message});});
  await waitFor(()=>expect(commands).toHaveLength(1));
  act(()=>view.result.current.setMessage('new unsent draft'));
  await act(async()=>{if(outcome==='response lost')rejectResponse(new TypeError('response lost'));else resolveResponse(new Response(JSON.stringify({execution:{executionId:'55555555-5555-4555-8555-555555555555',conversationId,state:'stopped',funding:'cash',modelId:'fixture-model',result:null,error:null},replayed:false})));await sending;});
  expect(view.result.current.message).toBe('new unsent draft');
  expect(commands).toHaveLength(1);expect(JSON.parse(String(commands[0].body)).action.message).toBe('first question');view.unmount();
});
