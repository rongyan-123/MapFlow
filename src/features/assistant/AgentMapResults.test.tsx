import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AgentMapResults from './AgentMapResults';
import type {AgentCompletion} from '../../api/agentExecutionClient';

const join=vi.hoisted(()=>vi.fn());
vi.mock('../../api/tavernClient',()=>({createLearningArea:join}));
const entry='11111111-1111-4111-8111-111111111111';
const area='22222222-2222-4222-8222-222222222222';
const result:AgentCompletion={executionId:'33333333-3333-4333-8333-333333333333',conversationId:'44444444-4444-4444-8444-444444444444',
  generationId:'55555555-5555-4555-8555-555555555555',messageId:'66666666-6666-4666-8666-666666666666',answer:'Map saved',
  maps:[{treeId:'77777777-7777-4777-8777-777777777777',libraryEntryId:entry,title:'Rust 学习地图'}],usage:null,
  settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
function mount(completion=result){const navigate=vi.fn();render(<QueryClientProvider client={new QueryClient()}>
  <AgentMapResults completion={completion} accountId="owner" csrfToken="csrf" onNavigate={navigate} />
</QueryClientProvider>);return navigate;}
beforeEach(()=>{join.mockReset().mockResolvedValue({areaId:area,libraryEntryId:entry,title:'Rust',available:true,createdAt:'2026-10-12T00:00:00Z'});});
afterEach(cleanup);
it('opens exactly the saved personal map without requesting a model or joining an area',()=>{
  const navigate=mount();fireEvent.click(screen.getByRole('button',{name:'查看 Rust 学习地图'}));
  expect(navigate).toHaveBeenCalledWith(`/maps?entry=${entry}`);expect(join).not.toHaveBeenCalled();
});
it('joins the owned map once and opens the authoritative returned learning area',async()=>{
  const navigate=mount();fireEvent.click(screen.getByRole('button',{name:'学习 Rust 学习地图'}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith(`/learning?area=${area}`));
  expect(join).toHaveBeenCalledOnce();expect(join).toHaveBeenCalledWith(entry,'csrf');
});
it('keeps the completed map and chat reachable when joining fails, with an explicit retry',async()=>{
  join.mockRejectedValueOnce(new Error('private storage failure'));const navigate=mount();
  fireEvent.click(screen.getByRole('button',{name:'学习 Rust 学习地图'}));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private storage failure');
  expect(navigate).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'查看 Rust 学习地图'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'学习 Rust 学习地图'}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith(`/learning?area=${area}`));
});
it('ignores model-written success claims without a server-owned saved map',()=>{
  mount({...result,answer:'地图已生成！<a href="/maps?entry=foreign">点此查看</a>',maps:[]});
  expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(join).not.toHaveBeenCalled();
});
it('does not navigate to another map returned by an inconsistent join result',async()=>{
  join.mockResolvedValue({areaId:area,libraryEntryId:'88888888-8888-4888-8888-888888888888',available:true});
  const navigate=mount();fireEvent.click(screen.getByRole('button',{name:'学习 Rust 学习地图'}));
  await screen.findByRole('alert');expect(navigate).not.toHaveBeenCalled();
});
it('does not redirect a newer conversation result when an earlier join finishes',async()=>{
  let finish!:(value:unknown)=>void;join.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const navigate=vi.fn(),client=new QueryClient();
  const view=(completion:AgentCompletion)=><QueryClientProvider client={client}><AgentMapResults completion={completion} accountId="owner" csrfToken="csrf" onNavigate={navigate} /></QueryClientProvider>;
  const page=render(view(result));fireEvent.click(screen.getByRole('button',{name:'学习 Rust 学习地图'}));
  page.rerender(view({...result,executionId:'99999999-9999-4999-8999-999999999999'}));
  finish({areaId:area,libraryEntryId:entry,available:true});
  await waitFor(()=>expect(screen.getByRole('button',{name:'学习 Rust 学习地图'})).toBeEnabled());
  expect(navigate).not.toHaveBeenCalled();
});
it('keeps an area join idempotent under repeated clicks',async()=>{
  let finish!:(value:unknown)=>void;join.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const navigate=mount();const button=screen.getByRole('button',{name:'学习 Rust 学习地图'});
  fireEvent.click(button);fireEvent.click(button);expect(join).toHaveBeenCalledOnce();
  finish({areaId:area,libraryEntryId:entry,available:true});
  await waitFor(()=>expect(navigate).toHaveBeenCalledOnce());
});
