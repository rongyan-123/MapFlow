import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { IdentityProvider,SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character,conversation,detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});
const account='player-1';const story={...conversation,conversationId:'22222222-2222-4222-8222-222222222222',scene:'management' as const,learningAreaId:null,libraryEntryId:null};
const profile={profileId:'33333333-3333-4333-8333-333333333333',profileVersion:1,modelId:'live-model',displayName:'真实模型',contextWindow:128000,maxOutputTokens:8000};
function mount(active=false){
  const requests:Array<[string,RequestInit|undefined]>=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{requests.push([path,options]);
    if(path==='/api/me/agent-models')return new Response(JSON.stringify({cash:[profile],defaultCash:profile,points:null}));
    if(path.endsWith('/characters'))return new Response(JSON.stringify({characters:[character]}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:null}));
    if(path==='/api/me/tree-library')return new Response(JSON.stringify({entries:[]}));
    if(path.endsWith('/'+story.conversationId))return new Response(JSON.stringify({...detail,conversation:story}));
    if(path.includes('/conversations'))return new Response(JSON.stringify({conversations:active?[story]:[],bootstrapState:active?'has_active':'cleared'}));
    return new Response('{}',{status:503});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:account,username:'小明',status:'active',isAdmin:false},csrfToken:'csrf'});
  render(<QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId={account}><ModelSelectionProvider accountId={account}><SceneWorkspace owner={{accountId:account,csrfToken:'csrf',userName:'小明',scene:'management'}} navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>);
  return requests;
}
it('keeps a cleared scene editable without implicitly opening or generating a conversation',async()=>{
  const requests=mount();await screen.findByText('还没有会话，先新建一段对话。');
  fireEvent.click(screen.getByRole('button',{name:'创建一张学习地图'}));expect(screen.getByRole('textbox',{name:'消息'})).toBeEnabled();
  expect(screen.getByRole('button',{name:'发送'})).toBeDisabled();expect(requests.every(([,options])=>options?.method!=='POST')).toBe(true);
});
it('keeps a real conversation draft through the five-section configuration dialog',async()=>{
  mount(true);await screen.findByText('请用茶。');
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'我的下一条问题'}});fireEvent.click(screen.getByRole('button',{name:'配置'}));
  expect(screen.getByRole('button',{name:'角色与会话'})).toBeVisible();expect(screen.getByRole('button',{name:'历史与分支'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'技能树与工具'}));fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('我的下一条问题'));
});
