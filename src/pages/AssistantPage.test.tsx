import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IdentityProvider,SESSION_QUERY_KEY} from '../domains/identity/IdentityContext';
import {AgentModelProvider} from '../domains/models/AgentModelContext';
import {ModelSelectionProvider} from '../domains/models/ModelSelectionContext';
import AssistantPage from './AssistantPage';

const conversationId='11111111-1111-4111-8111-111111111111';
const snapshot={conversationId,bindingVersion:1,graphRevision:4,headMessageId:'22222222-2222-4222-8222-222222222222',
  messages:[{messageId:'22222222-2222-4222-8222-222222222222',parentMessageId:null,role:'assistant',origin:'model',characterId:null,content:'这是已经保存的回复。'}],completions:[],olderCursor:null,syncCursor:'sync-4',
  generationSettings:{maxOutputTokens:null,stopSequences:[]},generationSettingsVersion:1,activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true}};
const executionId='55555555-5555-4555-8555-555555555555';
const running={executionId,conversationId,state:'running',funding:'cash',modelId:'original-model',result:null,error:null};
const profile={profileId:'33333333-3333-4333-8333-333333333333',profileVersion:1,modelId:'cash-model',displayName:'现金模型',contextWindow:128000,maxOutputTokens:8000};
function mount(handle?:(path:string,options?:RequestInit)=>Response|Promise<Response>|undefined){
  const requests:Array<[string,RequestInit|undefined]>=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string,options?:RequestInit)=>{
    requests.push([path,options]);
    const handled=handle?.(path,options);if(handled)return handled;
    if(path==='/api/me/global-assistant/open')return new Response(JSON.stringify(snapshot));
    if(path==='/api/me/agent-models')return new Response(JSON.stringify({cash:[],defaultCash:null,points:null}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:null}));
    if(path.includes('/global-assistant/changes?'))return new Response(JSON.stringify({...snapshot,changes:[],nextCursor:'sync-4',hasMore:false}));
    return new Response('{}',{status:503});
  }));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:'owner',username:'小明',status:'active',isAdmin:false},csrfToken:'csrf'});
  const view=render(<QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId="owner"><ModelSelectionProvider accountId="owner"><AssistantPage navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>);
  return {...view,requests,client};
}
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});

it('opens one continuous assistant with model-only settings and three questions after saved messages',async()=>{
  const {requests}=mount();
  expect(await screen.findByText('这是已经保存的回复。')).toBeVisible();
  for(const name of ['会话历史','新建会话','配置','教学画布','打开角色库'])expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
  const questions=screen.getByRole('region',{name:'问一问'});
  expect(within(questions).getAllByRole('button')).toHaveLength(3);
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'我自己的草稿'}});
  const question=within(questions).getAllByRole('button')[0].textContent!;
  fireEvent.click(within(questions).getAllByRole('button')[0]);
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue(`我自己的草稿\n${question}`);
  fireEvent.click(within(questions).getAllByRole('button')[0]);
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue(`我自己的草稿\n${question}`);
  expect(requests.filter(([,options])=>options?.method==='POST').map(([path])=>path)).toEqual(['/api/me/global-assistant/open']);
  fireEvent.click(screen.getByRole('button',{name:'模型设置'}));
  const dialog=within(screen.getByRole('dialog',{name:'模型设置'}));
  expect(dialog.getByLabelText('资金通路')).toBeVisible();
  expect(dialog.getByLabelText('API Key')).toBeVisible();
  fireEvent.click(dialog.getByText('生成参数'));
  expect(dialog.getByText('最大输出 Token')).toBeVisible();
  for(const label of ['角色与会话','历史与分支','会话设定','技能树与工具'])expect(dialog.queryByRole('button',{name:label})).not.toBeInTheDocument();
});
it('keeps the question set stable while visiting and hides it only after an explicit send',async()=>{
  const view=mount((path,options)=>{
    if(path==='/api/me/agent-models')return new Response(JSON.stringify({cash:[profile],defaultCash:profile,points:null}));
    if(path.endsWith('/executions')&&options?.method==='POST')return new Response(JSON.stringify({execution:running,replayed:false}));
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  await screen.findByText('这是已经保存的回复。');
  const questions=within(screen.getByRole('region',{name:'问一问'})).getAllByRole('button').map(button=>button.textContent);
  fireEvent.click(screen.getByRole('button',{name:'模型设置'}));fireEvent.click(screen.getByRole('button',{name:'关闭'}));
  fireEvent(window,new Event('focus'));fireEvent(window,new Event('resize'));
  expect(within(screen.getByRole('region',{name:'问一问'})).getAllByRole('button').map(button=>button.textContent)).toEqual(questions);
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'我的学习目标'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'发送'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(screen.queryByRole('region',{name:'问一问'})).not.toBeInTheDocument());
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('');
  expect(view.requests.filter(([,options])=>options?.method==='POST'&&options.body)).toHaveLength(1);
  view.unmount();mount();await screen.findByText('这是已经保存的回复。');
  const next=within(screen.getByRole('region',{name:'问一问'})).getAllByRole('button').map(button=>button.textContent);
  expect(next.every(question=>!questions.includes(question))).toBe(true);
});
it('defers visit questions during an existing execution and exposes original-request recovery',async()=>{
  mount(path=>{
    if(path.endsWith('/open'))return new Response(JSON.stringify({...snapshot,activeExecution:{...running,state:'awaiting_reconciliation',funding:'byok'},blockingExecutions:[{...running,state:'awaiting_reconciliation',funding:'byok'}],sendAvailability:{conversation:false,cash:true}}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:{...running,state:'awaiting_reconciliation',funding:'byok'}}));
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  await screen.findByText('这是已经保存的回复。');
  expect(screen.queryByRole('region',{name:'问一问'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'核对原请求'})).toBeVisible();
  expect(screen.getByRole('button',{name:'停止原请求后继续'})).toBeVisible();
  expect(screen.getByRole('button',{name:'补充 API Key'})).toBeVisible();
  expect(screen.getByText('original-model')).toBeVisible();
  expect(screen.getByRole('button',{name:'发送'})).toBeDisabled();
});
it('keeps the mounted message window bounded while allowing every loaded history page to be read',async()=>{
  let pages=0;
  mount(path=>{
    if(path.endsWith('/open'))return new Response(JSON.stringify({...snapshot,olderCursor:'page-0'}));
    if(path.includes('/messages?')){
      const page=pages++;
      return new Response(JSON.stringify({conversationId,bindingVersion:1,messages:Array.from({length:40},(_,index)=>({messageId:`${String(10000000+page*40+index)}-1111-4111-8111-111111111111`,parentMessageId:null,role:'assistant',origin:'model',characterId:null,content:`历史 ${page*40+index}`})),completions:[],olderCursor:pages<4?`page-${pages}`:null}));
    }
  });
  await screen.findByText('这是已经保存的回复。');
  for(let index=0;index<4;index++){
    fireEvent.click(screen.getByRole('button',{name:'读取更早消息'}));
    await screen.findByText(`历史 ${index*40}`);
  }
  expect(within(screen.getByRole('log',{name:'对话消息'})).getAllByRole('article').length).toBeLessThanOrEqual(120);
  fireEvent.click(screen.getByRole('button',{name:'返回最新消息'}));
  expect(screen.getByText('这是已经保存的回复。')).toBeVisible();
});
it('preserves this visit and its draft when a refreshed identity supplies a new CSRF token',async()=>{
  const view=mount();await screen.findByText('这是已经保存的回复。');
  const questions=within(screen.getByRole('region',{name:'问一问'})).getAllByRole('button').map(button=>button.textContent);
  fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'不要丢失的草稿'}});
  act(()=>view.client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:'owner',username:'小明',status:'active',isAdmin:false},csrfToken:'refreshed-csrf'}));
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('不要丢失的草稿'));
  expect(within(screen.getByRole('region',{name:'问一问'})).getAllByRole('button').map(button=>button.textContent)).toEqual(questions);
});
it('shows a model preflight error for the next send after a saved successful request',async()=>{
  const receipt={executionId,conversationId,generationId:'33333333-3333-4333-8333-333333333333',messageId:snapshot.headMessageId,answer:'这是已经保存的回复。',maps:[],usage:null,settlement:{status:'no_site_charge',cashMicros:null,pointUnits:null,balanceMicros:null}};
  mount(path=>{
    if(path.endsWith('/open'))return new Response(JSON.stringify({...snapshot,completions:[receipt]}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:{...running,state:'succeeded',result:receipt}}));
  });
  await screen.findByText('这是已经保存的回复。');fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'下一条草稿'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'发送'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'发送'}));
  expect(await screen.findByText('请在模型设置中填写 API Key、模型、HTTPS 接口和实际上下文窗口。')).toBeVisible();
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('下一条草稿');
});
it('offers explicit return-to-edit only for a confirmed unaccepted revision conflict and keeps the draft',async()=>{
  let opens=0,accepts=0;
  const view=mount((path,options)=>{
    if(path==='/api/me/agent-models')return new Response(JSON.stringify({cash:[profile],defaultCash:profile,points:null}));
    if(path.endsWith('/open'))return new Response(JSON.stringify({...snapshot,graphRevision:++opens===1?4:5}));
    if(path.endsWith('/executions')&&options?.method==='POST'){
      accepts++;
      return new Response(JSON.stringify({error:{code:'global_assistant_revision_conflict'}}),{status:409});
    }
  });
  await screen.findByText('这是已经保存的回复。');fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'被拒绝后继续编辑的问题'}});
  fireEvent.click(screen.getByRole('button',{name:'发送'}));
  fireEvent.click(await screen.findByRole('button',{name:'返回编辑'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'发送'})).toBeEnabled());
  expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue('被拒绝后继续编辑的问题');
  expect(screen.queryByRole('button',{name:'查回原操作'})).not.toBeInTheDocument();
  expect(accepts).toBe(1);expect(opens).toBe(2);
  expect(view.requests.filter(([,options])=>options?.method==='POST'&&options.body)).toHaveLength(1);
});
it('keeps a rejected draft separate from another device request and offers explicit editing after its stop',async()=>{
  const actionId=crypto.randomUUID(),rejectedText='被明确拒绝、尚未返回编辑的旧问题';
  sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversationId}`,JSON.stringify({executionId:null,
    command:{clientActionId:actionId,expectedRevision:3,bindingVersion:1,funding:'cash',action:{type:'reply',message:rejectedText}},unacceptedActionId:actionId}));
  let stopped=false;
  const view=mount(path=>{
    if(path.endsWith('/open'))return new Response(JSON.stringify({...snapshot,activeExecution:stopped?null:running,sendAvailability:{conversation:stopped,cash:true}}));
    if(path.endsWith('/executions'))return new Response(JSON.stringify({execution:running}));
    if(path.endsWith('/stop')){stopped=true;return new Response(JSON.stringify({...running,state:'stopped'}));}
    if(path.includes('/events?'))return new Response(new ReadableStream({start(sink){sink.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'Content-Type':'text/event-stream'}});
    if(path.includes('/changes?'))return new Response(JSON.stringify({...snapshot,activeExecution:stopped?null:running,sendAvailability:{conversation:stopped,cash:true},changes:[],nextCursor:'sync-5',hasMore:false}));
  });
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
  try{
    await screen.findByText('original-model');
    expect(screen.queryByRole('button',{name:'返回编辑'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox',{name:'消息'}),{target:{value:'处理别设备请求时写的新草稿'}});
    fireEvent.click(screen.getByRole('button',{name:'停止原请求后继续'}));
    fireEvent.click(await screen.findByRole('button',{name:'返回编辑'}));
    await waitFor(()=>expect(screen.getByRole('textbox',{name:'消息'})).toHaveValue(`处理别设备请求时写的新草稿\n${rejectedText}`));
    expect(screen.getByText('原请求已停止')).toBeVisible();
    expect(view.requests.filter(([path,options])=>path.endsWith('/executions')&&options?.method==='POST')).toHaveLength(0);
  }finally{confirm.mockRestore();view.unmount();view.client.clear();}
});
