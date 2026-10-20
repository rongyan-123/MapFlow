import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { renderHook,waitFor,act } from '@testing-library/react';
import { startTransition } from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { useConversationHistory } from './useConversationHistory';
import { conversation,character,detail,completion } from '../../test/conversations';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
const owner={accountId:'player-1',csrfToken:'csrf',userName:'小明',scene:'management' as const};
const story={...conversation,scene:'management' as const,learningAreaId:null,libraryEntryId:null};
function setup(scene:'management'|'tavern'='management'){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...renderHook(()=>useConversationHistory({...owner,scene}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>})};}
it('keeps an explicitly cleared history empty across a fresh controller',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);return new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:{conversations:[],bootstrapState:'cleared'}));});
  const view=setup();await waitFor(()=>expect(view.result.current.history.isSuccess).toBe(true));
  expect(view.result.current.conversationId).toBeNull();view.unmount();const second=setup();await waitFor(()=>expect(second.result.current.history.isSuccess).toBe(true));
  expect(paths).not.toContain('/api/me/tavern/management-conversations');
});
it('applies a trusted completed turn and keeps generation settings from an explicit receipt',async()=>{
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:path.endsWith('/'+story.conversationId)?{...detail,conversation:story}:{conversations:[story],bootstrapState:'has_active'})));
  const view=setup();await waitFor(()=>expect(view.result.current.detail).toBeDefined());
  act(()=>view.result.current.completed(completion));
  expect(view.result.current.detail?.graph.revision).toBe(completion.graph.revision);
  act(()=>view.result.current.patchSettings({generationSettings:{maxOutputTokens:4096,stopSequences:[]},generationSettingsVersion:2}));
  await waitFor(()=>expect(view.result.current.detail?.conversation.generationSettingsVersion).toBe(2));
  expect(view.result.current.detail?.conversation.generationSettings.maxOutputTokens).toBe(4096);
});
it('creates the default only on first entry and remembers the saved conversation',async()=>{
  const writes:string[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){writes.push(path);return new Response(JSON.stringify({...detail,conversation:story}));}
    if(path.includes('/characters'))return new Response(JSON.stringify({characters:[character]}));
    if(path.endsWith('/'+story.conversationId))return new Response(JSON.stringify({...detail,conversation:story}));
    return new Response(JSON.stringify({conversations:[],bootstrapState:'never_created'}));
  });
  const view=setup();await waitFor(()=>expect(view.result.current.detail?.conversation.conversationId).toBe(story.conversationId));
  expect(writes).toEqual(['/api/me/tavern/management-conversations']);
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1.management')).toBe(story.conversationId);
});
it('keeps the new conversation detail and preference selected through a React transition',async()=>{
  const initial={...story,scene:'tavern' as const};
  const created={...initial,conversationId:'new-conversation',title:'刚刚新建的会话'};
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:path.endsWith('/'+created.conversationId)?{...detail,conversation:created}:path.endsWith('/'+initial.conversationId)?{...detail,conversation:initial}:{conversations:[initial],bootstrapState:'has_active'})));
  const view=setup('tavern');await waitFor(()=>expect(view.result.current.detail).toBeDefined());
  act(()=>startTransition(()=>view.result.current.created(created)));
  await waitFor(()=>expect(view.result.current.detail?.conversation.conversationId).toBe(created.conversationId));
  expect(view.result.current.conversationId).toBe(created.conversationId);
  expect(localStorage.getItem('mapflow.tavern.selection.v1.player-1')).toBe(created.conversationId);
});
it('removes a deleted conversation and its cached default without reopening it',async()=>{
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.includes('/characters')?{characters:[character]}:path.endsWith('/'+story.conversationId)?{...detail,conversation:story}:{conversations:[story],bootstrapState:'has_active'})));
  const view=setup();await waitFor(()=>expect(view.result.current.detail).toBeDefined());
  const defaultKey=['me','player-1','management','default-conversation'];view.client.setQueryData(defaultKey,{...detail,conversation:story});
  await act(async()=>view.result.current.removeDeleted(story.conversationId));
  expect(view.result.current.conversations).toEqual([]);expect(view.result.current.conversationId).toBeNull();
  expect(view.client.getQueryData(defaultKey)).toBeUndefined();
});
