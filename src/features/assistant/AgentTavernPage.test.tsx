import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AgentTavernPage from './AgentTavernPage';
const catalogue=vi.hoisted(()=>vi.fn());
const props=vi.hoisted(()=>vi.fn());
vi.mock('../identity/IdentityContext',()=>({useIdentity:()=>({session:{account:{playerId:'owner'},csrfToken:'csrf'}})}));
vi.mock('../../api/agentExecutionClient',async original=>({...await original<typeof import('../../api/agentExecutionClient')>(),fetchAgentModelCatalogue:catalogue}));
vi.mock('../tavern/TavernPage',()=>({default:(value:unknown)=>{props(value);return <div>Shared conversation</div>;}}));
const cash={profileId:'cash-model',profileVersion:1,modelId:'cash-model',displayName:'现金导师',contextWindow:131072,maxOutputTokens:null};
const points={...cash,profileId:'points-model',modelId:'Qwen/Qwen3-8B',displayName:'积分导师'};
beforeEach(()=>{props.mockReset();localStorage.clear();catalogue.mockReset().mockResolvedValue({cash:[cash],defaultCash:cash,points});});
afterEach(cleanup);
function mount(extra:Partial<React.ComponentProps<typeof AgentTavernPage>>={}){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AgentTavernPage onNavigateConsole={()=>{}} {...extra} /></QueryClientProvider>);}
it('starts standalone chat with the same native execution options as the global assistant',async()=>{
  mount();await waitFor(()=>expect(props.mock.lastCall?.[0].agentOptions).toMatchObject({funding:'cash',profileId:'cash-model',profileVersion:1}));
});
it('preserves the learning context, tools and callbacks while switching the funding path',async()=>{
  const onTreeChanged=vi.fn();const treeContext={libraryEntryId:'area',title:'Rust',onTreeChanged};
  mount({treeContext,onTreeChanged});await screen.findByText('现金导师');fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'points'}});
  expect(props.mock.lastCall?.[0]).toMatchObject({treeContext,onTreeChanged,agentOptions:{funding:'points',modelLabel:'积分导师'}});
});
it('keeps the same remembered funding selection when moving between standalone and learning chat',async()=>{
  const first=mount();await screen.findByText('现金导师');fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'points'}});first.unmount();
  mount({treeContext:{libraryEntryId:'area',title:'Rust'}});await waitFor(()=>expect(screen.getByLabelText('资金通路')).toHaveValue('points'));
});
it('provides the funding controls inside model configuration and retains the custom model window',async()=>{
  mount();await screen.findByText('现金导师');fireEvent.change(screen.getByLabelText('资金通路'),{target:{value:'byok'}});
  fireEvent.change(screen.getByLabelText('自填模型上下文窗口'),{target:{value:'1048576'}});
  expect(props.mock.lastCall?.[0].agentOptions).toMatchObject({funding:'byok',contextWindow:1048576});
  expect(props.mock.lastCall?.[0].agentConfigurationControls).toBeTruthy();
});
