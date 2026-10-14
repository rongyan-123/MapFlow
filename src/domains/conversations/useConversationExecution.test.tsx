import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { detail } from '../../test/conversations';
import { useConversationExecution } from './useConversationExecution';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const conversationId='22222222-2222-4222-8222-222222222222';
const saved={...detail,conversation:{...detail.conversation,conversationId}};
function setup(funding:'cash'|'byok'='cash',initialDraft=''){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const recovered=vi.fn();
  return {recovered,...renderHook(()=>useConversationExecution({detail:saved,accountId:'a',csrfToken:'csrf-a',initialDraft,modelSelection:{provider:'custom',apiKey:'',baseUrl:'',model:'',settings:{},historyBytes:32768},agentOptions:{funding,contextWindow:32000,profileId:'33333333-3333-4333-8333-333333333333',profileVersion:2},onRecovered:recovered,onCompleted:vi.fn(),onGraphChanged:vi.fn()}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})};
}
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
