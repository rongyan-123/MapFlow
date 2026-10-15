import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { character,conversation,detail } from '../../test/conversations';
import { useConversationHistory } from './useConversationHistory';
import { useConversationActions } from './useConversationActions';
import { conversationRun } from './legacyRun';
import { teachingCanvasPersistence } from '../canvas/persistence';
import { agentConversationRun } from './agentRun';
import {creationStorageKey,persistPendingCreation} from './pendingCreation';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});
const owner={accountId:'player-1',csrfToken:'csrf',userName:'小明',scene:'management' as const};
const story={...conversation,conversationId:'22222222-2222-4222-8222-222222222222',scene:'management' as const,libraryEntryId:null,learningAreaId:null};
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...renderHook(()=>{const history=useConversationHistory(owner);return {history,actions:useConversationActions(history,false)};},{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})};}
function reads(path:string){return new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:path.endsWith('/'+story.conversationId)?{...detail,conversation:story}:{conversations:[story],bootstrapState:'has_active'}));}
it('blocks deletion when an Agent acceptance response is unknown',async()=>{
  const deletes:string[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:null}));
    if(options?.method==='DELETE')deletes.push(path);return reads(path);
  });
  const view=setup();await waitFor(()=>expect(view.result.current.history.detail).toBeDefined());
  sessionStorage.setItem(`mapflow.agent.execution.v1.player-1.${story.conversationId}`,JSON.stringify({executionId:null,command:{clientActionId:'11111111-1111-4111-8111-111111111111',funding:'cash',expectedRevision:1,action:{type:'reply',message:'待核对的请求'}}}));
  await act(async()=>agentConversationRun(view.client,'player-1',story.conversationId).restore());
  await act(async()=>view.result.current.actions.remove(story));expect(deletes).toEqual([]);expect(view.result.current.actions.error).toBeDefined();
});
it('does not offer another creation while the first default conversation is still opening',async()=>{
  let finishDefault:(response:Response)=>void=()=>{};
  vi.stubGlobal('fetch',async(path:string)=>{
    if(path==='/api/me/tavern/management-conversations')return await new Promise<Response>(resolve=>{finishDefault=resolve;});
    return new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:{conversations:[],bootstrapState:'never_created'}));
  });
  const view=setup();await waitFor(()=>expect(view.result.current.history.defaultQuery.isFetching).toBe(true));
  expect(view.result.current.actions.canCreate).toBe(false);
  await act(async()=>finishDefault(new Response(JSON.stringify({...detail,conversation:story}))));
});
it('allows explicit creation after clearing and discards a deleted replay request before the next attempt',async()=>{
  const requestIds:string[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){requestIds.push(JSON.parse(String(options.body)).clientRequestId);return requestIds.length===1?new Response(JSON.stringify({error:{code:'tavern.creation_target_deleted',message:'deleted'}}),{status:410}):new Response(JSON.stringify({...detail,conversation:{...story,conversationId:'new-story'}}));}
    return new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:{conversations:[],bootstrapState:'cleared'}));
  });
  const view=setup();await waitFor(()=>expect(view.result.current.actions.canCreate).toBe(true));
  await act(async()=>view.result.current.actions.create());await waitFor(()=>expect(view.result.current.actions.error).toBeDefined());
  await act(async()=>view.result.current.actions.create());expect(requestIds).toHaveLength(2);expect(requestIds[1]).not.toBe(requestIds[0]);
  expect(view.result.current.history.conversationId).toBe('new-story');
});
it('creates a fixed global assistant even when its role is absent from the personal library',async()=>{
  const payloads:Record<string,unknown>[]=[];
  const platform={...character,characterId:'platform-role'};
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){payloads.push(JSON.parse(String(options.body)));return new Response(JSON.stringify({...detail,character:platform,conversation:{...story,characterId:platform.characterId}}));}
    return new Response(JSON.stringify(path.endsWith('/characters')?{characters:[]}:path.endsWith('/'+story.conversationId)?{...detail,character:platform,conversation:{...story,characterId:platform.characterId}}:{conversations:[{...story,characterId:platform.characterId}],bootstrapState:'has_active'}));
  });
  const view=setup();await waitFor(()=>expect(view.result.current.history.detail).toBeDefined());
  expect(view.result.current.actions.canCreate).toBe(true);
  await act(async()=>view.result.current.actions.create());
  expect(payloads).toHaveLength(1);expect(payloads[0]).not.toHaveProperty('characterId');
});
it('ends a rejected legacy role-selection retry and uses a new fixed-assistant creation request',async()=>{
  const legacy={clientRequestId:'11111111-1111-4111-8111-111111111111',characterId:'private-role',userName:'小明'};
  const key=creationStorageKey(owner.accountId,undefined,true);persistPendingCreation(key,legacy);
  const payloads:Record<string,unknown>[]=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){payloads.push(JSON.parse(String(options.body)));return payloads.length===1?new Response(JSON.stringify({error:{code:'tavern.character_not_found',message:'unavailable'}}),{status:404}):new Response(JSON.stringify({...detail,conversation:story}));}
    return new Response(JSON.stringify(path.endsWith('/characters')?{characters:[character]}:{conversations:[],bootstrapState:'cleared'}));
  });
  const view=setup();await waitFor(()=>expect(view.result.current.actions.canCreate).toBe(true));
  await act(async()=>view.result.current.actions.create());expect(payloads[0]).toMatchObject(legacy);
  expect(localStorage.getItem(key)).toBeNull();
  await act(async()=>view.result.current.actions.create());
  expect(payloads[1].clientRequestId).not.toBe(legacy.clientRequestId);expect(payloads[1]).not.toHaveProperty('characterId');
});
it('blocks deletion while a previous generation is still active',async()=>{
  const deletes:string[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(options?.method==='DELETE')deletes.push(path);return reads(path);});
  const view=setup();await waitFor(()=>expect(view.result.current.history.detail).toBeDefined());
  const run=conversationRun(view.client,{accountId:'player-1',conversationId:story.conversationId,scene:'management',areaId:null},()=>null);run.set({busy:true});
  await act(async()=>view.result.current.actions.remove(story));expect(deletes).toEqual([]);expect(view.result.current.actions.error).toBeDefined();run.set({busy:false});
});
it('retains a failed canvas save and does not send the conversation delete',async()=>{
  const writes:string[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(options?.method==='PATCH'||options?.method==='DELETE'){writes.push(path);return new Response('{}',{status:503});}return reads(path);});
  const view=setup();await waitFor(()=>expect(view.result.current.history.detail).toBeDefined());
  const canvas=teachingCanvasPersistence(story.conversationId,'csrf',{enabled:false,elements:[{id:'previous',type:'rectangle',x:0,y:0,width:10,height:10}],revision:1},view.client,'player-1');
  canvas.queue([{id:'manual',type:'rectangle',x:0,y:0,width:100,height:100}]);
  await act(async()=>view.result.current.actions.remove(story));
  expect(writes).not.toContain('/api/me/tavern/conversations/'+story.conversationId);
  expect(writes.some(path=>path.endsWith('/canvas'))).toBe(true);
  expect(canvas.getSnapshot().error).toBeTruthy();canvas.markDeleted();
});
