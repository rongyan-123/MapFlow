import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import GlobalAssistantPage from './GlobalAssistantPage';
const catalogue=vi.hoisted(()=>vi.fn());
const user=vi.hoisted(()=>({playerId:'owner',username:'owner',status:'active',isAdmin:false}));
vi.mock('../identity/IdentityContext',()=>({useIdentity:()=>({session:{account:user,csrfToken:'csrf'}})}));
vi.mock('../../api/agentExecutionClient',async original=>({...await original<typeof import('../../api/agentExecutionClient')>(),fetchAgentModelCatalogue:catalogue}));
vi.mock('../tavern/TavernPage',()=>({default:(props:{management:boolean;agentOptions:{funding:string;profileId?:string;profileVersion?:number}})=><div aria-label="共享角色会话">{props.management?'Management':''}<output>{JSON.stringify(props.agentOptions)}</output></div>}));
const cash={profileId:'cash-model',profileVersion:1,modelId:'cash-model',displayName:'现金导师',contextWindow:131072,maxOutputTokens:null};
const points={...cash,profileId:'points-model',modelId:'Qwen/Qwen3-8B',displayName:'积分导师'};
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><GlobalAssistantPage onNavigateLearning={()=>{}} /></QueryClientProvider>);}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();user.playerId='owner';catalogue.mockReset().mockResolvedValue({cash:[cash],defaultCash:cash,points});});
afterEach(cleanup);
it('reuses management role/history with explicit independent cash and points choices',async()=>{
  mount();expect(await screen.findByRole('heading',{name:'全局助手'})).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByLabelText('共享角色会话')).toHaveTextContent('cash-model'));
  fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'points'}});
  expect(screen.getByLabelText('共享角色会话')).toHaveTextContent('points');expect(screen.getByText('积分导师')).toBeInTheDocument();
});
it('remembers a funding choice per account without persisting credentials',async()=>{
  const page=mount();await screen.findByText('现金导师');fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'points'}});page.unmount();
  mount();await waitFor(()=>expect(screen.getByLabelText('资金通路')).toHaveValue('points'));
  cleanup();user.playerId='another-owner';mount();await waitFor(()=>expect(screen.getByLabelText('资金通路')).toHaveValue('cash'));
});
it('makes original map and learning interfaces reachable without starting a model request',async()=>{
  const navigate=vi.fn();render(<QueryClientProvider client={new QueryClient()}><GlobalAssistantPage onNavigateLearning={navigate} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'打开学习聊天'}));expect(navigate).toHaveBeenCalledOnce();expect(catalogue).toHaveBeenCalledOnce();
});
it('requires an explicit real context window for a user-defined model instead of inventing a universal cap',async()=>{
  mount();await screen.findByText('现金导师');fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'byok'}});
  expect(screen.getByLabelText('自填模型上下文窗口')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('自填模型上下文窗口'),{target:{value:'1048576'}});
  expect(screen.getByLabelText('共享角色会话')).toHaveTextContent('1048576');
});
