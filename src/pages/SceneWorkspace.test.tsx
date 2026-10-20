import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor,within } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { IdentityProvider,SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character,conversation,detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});
const account='player-1';const managementStory={...conversation,conversationId:'22222222-2222-4222-8222-222222222222',scene:'management' as const,learningAreaId:null,libraryEntryId:null};
const profile={profileId:'33333333-3333-4333-8333-333333333333',profileVersion:1,modelId:'live-model',displayName:'真实模型',contextWindow:128000,maxOutputTokens:8000};
function mount(active=false,fresh=false,scene:'management'|'tavern'='management'){
  const story={...managementStory,scene};
  const requests:Array<[string,RequestInit|undefined]>=[];
  const createdStories:typeof story[]=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{requests.push([path,options]);
    if(path.endsWith('/management-conversations')&&options?.method==='POST'){const created={...story,conversationId:`22222222-2222-4222-8222-22222222222${createdStories.length+1}`};createdStories.push(created);return new Response(JSON.stringify({...detail,conversation:created}));}
    if(path==='/api/me/agent-models')return new Response(JSON.stringify({cash:[profile],defaultCash:profile,points:null}));
    if(path.endsWith('/characters'))return new Response(JSON.stringify({characters:[character]}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:null}));
    if(path==='/api/me/tree-library')return new Response(JSON.stringify({entries:[]}));
    if(path==='https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json')return new Response(JSON.stringify([{type:'character',id:'guide.png',name:'官方示例向导',description:'官方目录中的角色卡',highlight:false,url:'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/assets/character/guide.png'}]));
    if(path.endsWith('/'+story.conversationId))return new Response(JSON.stringify({...detail,conversation:story,...(fresh?{turns:[],generations:[],graph:{...detail.graph,activePath:['message-opening'],messages:[detail.graph.messages[0]],branches:[{...detail.graph.branches[0],leafMessageId:'message-opening'}]}}:{})}));
    if(path.includes('/conversations'))return new Response(JSON.stringify({conversations:active?[story]:[],bootstrapState:active?'has_active':'cleared'}));
    return new Response('{}',{status:503});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:account,username:'小明',status:'active',isAdmin:false},csrfToken:'csrf'});
  render(<QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId={account}><ModelSelectionProvider accountId={account}><SceneWorkspace owner={{accountId:account,csrfToken:'csrf',userName:'小明',scene}} navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>);
  return requests;
}
it('keeps a cleared scene editable without implicitly opening or generating a conversation',async()=>{
  const requests=mount();await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('还没有会话，先新建一段对话。'));
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
it('opens the role library from history without replacing the draft or stacking dialogs',async()=>{
  const requests=mount(true,false,'tavern');await screen.findByText('请用茶。');
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'尚未发送的草稿'}});
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button',{name:'打开角色库'}));
  expect(screen.getByRole('dialog',{name:'角色库'})).toBeVisible();
  expect(within(screen.getByRole('dialog',{name:'角色库'})).getByRole('button',{name:'导入角色卡'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('尚未发送的草稿');
  fireEvent.click(screen.getByRole('button',{name:'配置'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'配置'})).getByRole('button',{name:'会话历史'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'会话历史'})).getByRole('button',{name:'打开角色库'}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog',{name:'角色库'})).toBeVisible();
  expect(requests.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
it('exposes communities and opens the official catalog directly from the role library',async()=>{
  const requests=mount(true,false,'tavern');await screen.findByText('请用茶。');
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button',{name:'打开角色库'}));
  const library=screen.getByRole('dialog',{name:'角色库'});
  expect(within(library).getByText('点击此处浏览角色卡社区')).toBeVisible();
  for(const name of ['类脑 · 中文酒馆社区','废墟之下的藏书室','Chub','AI Character Cards']){
    expect(within(library).getByRole('link',{name})).toBeVisible();
  }
  fireEvent.click(within(library).getByRole('button',{name:'浏览官方角色卡'}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  await screen.findByRole('button',{name:/官方示例向导/});
  expect(requests.some(([path])=>path.endsWith('/index.json'))).toBe(true);
  expect(requests.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'我的角色'}));
  expect(screen.getByRole('dialog',{name:'角色库'})).toBeVisible();
});
it('keeps the global assistant fixed without a role library or role selector',async()=>{
  mount(true);await screen.findByText('请用茶。');
  expect(screen.queryByRole('button',{name:'打开角色库'})).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox',{name:'筛选历史角色'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'配置'}));
  expect(screen.queryByRole('button',{name:'打开角色库'})).not.toBeInTheDocument();
  expect(screen.getByText(/平台统一提供/)).toBeVisible();
});
it('does not present a private role as the global assistant after history was cleared',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('还没有会话'));
  fireEvent.click(screen.getByRole('button',{name:'配置'}));
  const configuration=within(screen.getByRole('dialog',{name:'配置'}));
  expect(configuration.queryByRole('heading',{name:character.card.name})).not.toBeInTheDocument();
  expect(configuration.queryByText('导入或创建角色，开始一段对话。')).not.toBeInTheDocument();
  expect(configuration.getByText('开始新对话后，将自动使用平台全局助手。')).toBeVisible();
});
it('replaces the history drawer with a single deletion confirmation dialog',async()=>{
  mount(true);await screen.findByText('请用茶。');fireEvent.click(screen.getByRole('button',{name:'配置'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'配置'})).getByRole('button',{name:'会话历史'}));
  fireEvent.click(within(screen.getByRole('dialog',{name:'会话历史'})).getByRole('button',{name:/删除会话/}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(screen.getByRole('dialog',{name:'删除会话'})).toBeVisible();
});
it('uses an entry-screen draft once and does not copy it into later conversations',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('还没有会话'));
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'第一段会话的目标'}});fireEvent.click(screen.getAllByRole('button',{name:'新建会话'})[0]);
  await screen.findByText('请用茶。');expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('第一段会话的目标');
  fireEvent.click(screen.getByRole('button',{name:'新建会话'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue(''));
});
it('keeps a fresh guide screen at the top instead of scrolling to the empty message log',async()=>{
  const original=HTMLElement.prototype.scrollIntoView;const scroll=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll});
  try{mount(true,true);await screen.findByText('消息操作');expect(scroll).not.toHaveBeenCalled();}finally{Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:original});}
});
