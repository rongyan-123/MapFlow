import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AgentModelProvider} from '../../domains/models/AgentModelContext';
import {ModelSelectionProvider} from '../../domains/models/ModelSelectionContext';
import StudyPlanDialog from './StudyPlanDialog';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('restores the original pending conditions after a reload so the retry is submittable',async()=>{
  localStorage.setItem('mapflow.pending-plan.v1.a.entry',JSON.stringify({clientActionId:'original-request',conditions:{deadline:'2090-01-02',startDate:'2090-01-01',dailyMinutes:45,timezone:'Asia/Shanghai',expectedVersion:0},funding:'points'}));
  const requests:unknown[]=[];
  vi.stubGlobal('fetch',async(path:string,init?:RequestInit)=>{
    if(path.endsWith('/study-plan')&&init?.method==='POST'){requests.push(JSON.parse(String(init.body)));return Response.json({executionId:'original-task'});}
    if(path.includes('agent-models'))return Response.json({cash:[],defaultCash:null,points:{profileId:'points',profileVersion:1,modelId:'test',displayName:'测试积分模型',contextWindow:64000,maxOutputTokens:4096}});
    return Response.json({});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><AgentModelProvider accountId="a"><ModelSelectionProvider accountId="a"><StudyPlanDialog accountId="a" entryId="entry" csrfToken="csrf" title="恢复计划" total={10} remaining={8} state={{version:0,plan:null,task:null}} onClose={vi.fn()} onChanged={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></QueryClientProvider>);
  expect(screen.getByLabelText('截止日期（必填）')).toHaveValue('2090-01-02');
  await waitFor(()=>expect(screen.getByRole('button',{name:'重试原请求'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'重试原请求'}));
  await waitFor(()=>expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({clientActionId:'original-request',conditions:{deadline:'2090-01-02',dailyMinutes:45}});
});
it('retains date inputs through model settings and submits one real request while pending',async()=>{
  const requests:unknown[]=[];let finish!:(value:Response)=>void;
  vi.stubGlobal('fetch',async(path:string,init?:RequestInit)=>{if(path.endsWith('/study-plan')&&init?.method==='POST'){requests.push(JSON.parse(String(init.body)));return new Promise<Response>(resolve=>{finish=resolve;});}if(path.includes('agent-models'))return Response.json({cash:[],defaultCash:null,points:{profileId:'points',profileVersion:1,modelId:'test',displayName:'测试积分模型',contextWindow:64000,maxOutputTokens:4096}});return Response.json({});});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><AgentModelProvider accountId="a"><ModelSelectionProvider accountId="a"><StudyPlanDialog accountId="a" entryId="entry" csrfToken="csrf" title="真实范围" total={10} remaining={8} state={{version:0,plan:null,task:null}} onClose={vi.fn()} onChanged={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></QueryClientProvider>);
  await screen.findByRole('button',{name:/测试积分模型/});
  fireEvent.change(screen.getByLabelText('截止日期（必填）'),{target:{value:'2090-01-02'}});
  fireEvent.click(screen.getByRole('button',{name:/测试积分模型/}));
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.getByLabelText('截止日期（必填）')).toHaveValue('2090-01-02');
  const generate=screen.getByRole('button',{name:'生成计划'});fireEvent.click(generate);fireEvent.click(generate);
  await waitFor(()=>expect(requests).toHaveLength(1));
  expect(requests[0]).toMatchObject({conditions:{deadline:'2090-01-02',startDate:null,dailyMinutes:null,expectedVersion:0}});
  finish(Response.json({executionId:'task-1',allComplete:false}));
});
