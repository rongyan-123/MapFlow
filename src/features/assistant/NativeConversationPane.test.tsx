import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ConversationPane from '../tavern/ConversationPane';
import {detail} from '../../test/conversations';
const api=vi.hoisted(()=>({fetchActiveAgentExecution:vi.fn(),fetchAgentExecution:vi.fn(),acceptAgentExecution:vi.fn(),attachAgentExecution:vi.fn(),stopAgentExecution:vi.fn(),resolveAgentToolApproval:vi.fn()}));
const canvas=vi.hoisted(()=>({flush:vi.fn(),setPreview:vi.fn(),setOpen:vi.fn(),show:vi.fn()}));
vi.mock('../../api/agentExecutionClient',async original=>({...await original<typeof import('../../api/agentExecutionClient')>(),...api}));
vi.mock('../../domains/canvas/useTeachingCanvas',()=>({useTeachingCanvas:()=>({...canvas,document:null,open:false,saving:false,error:null})}));
const conversation='11111111-1111-4111-8111-111111111111',execution='22222222-2222-4222-8222-222222222222';
const status={executionId:execution,conversationId:conversation,state:'running',funding:'cash',modelId:'fixture',result:null,error:null};
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();api.fetchActiveAgentExecution.mockResolvedValue(null);api.fetchAgentExecution.mockResolvedValue(status);canvas.flush.mockResolvedValue(undefined);
 api.acceptAgentExecution.mockResolvedValue({execution:status,replayed:false});api.attachAgentExecution.mockImplementation((_id,_conversation,_after,_onEvent,signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));});
afterEach(()=>{cleanup();window.innerWidth=1024;});
function mount(reference?:{id:string;title:string},consumed?:()=>void,extra:Record<string,unknown>={}){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ConversationPane
 detail={{...detail,...extra,conversation:{...detail.conversation,conversationId:conversation}}} accountId="owner" csrfToken="fresh-csrf"
 modelSelection={{provider:'custom',baseUrl:'',apiKey:'',model:'',historyBytes:32768,settings:{}}} agentOptions={{funding:'cash',modelLabel:'Tutor'}}
 onCompleted={()=>{}} onRecovered={()=>{}} onGraphChanged={()=>{}} configurationOpen={false} onCloseConfiguration={()=>{}} configuration={[]}
 onOpenModelConfiguration={()=>{}} nodeReference={reference} onNodeReferenceConsumed={consumed} /></QueryClientProvider>);}
const historicalResult={executionId:execution,conversationId:conversation,generationId:execution,messageId:'message-assistant-1',answer:'请用茶。',
 maps:[{treeId:conversation,libraryEntryId:execution,title:'已保存的学习地图'}],usage:null,
 settlement:{status:'pending_evidence',cashMicros:null,pointUnits:null,balanceMicros:null}};
it('mobile composer starts in one line and keeps IME and Shift+Enter from sending',async()=>{
 window.innerWidth=390;mount();
 const input=screen.getByRole('textbox',{name:'消息'});
 expect(input).toHaveAttribute('rows','1');
 fireEvent.change(input,{target:{value:'正在输入中文'}});
 fireEvent.keyDown(input,{key:'Enter',keyCode:229,isComposing:true});
 fireEvent.keyDown(input,{key:'Enter',shiftKey:true});
 expect(api.acceptAgentExecution).not.toHaveBeenCalled();
 fireEvent.keyDown(input,{key:'Enter'});
 await waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());
 expect(screen.getByRole('button',{name:'停止生成'})).toBeInTheDocument();
});
it('mobile reply actions stay in their own expandable menu',()=>{
 window.innerWidth=390;mount();
 expect(screen.getByRole('button',{name:'编辑当前消息'})).not.toBeVisible();
 fireEvent.click(screen.getByText('消息操作'));
 // JSDOM does not implement the browser summary toggle default action.
 const menu=screen.getByText('消息操作').closest('details')!;menu.open=true;
 expect(screen.getByRole('button',{name:'编辑当前消息'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'重新生成'})).toBeInTheDocument();
});
it('mobile usage can expand without hiding the actual fee or pending status',async()=>{
 window.innerWidth=390;
 api.fetchActiveAgentExecution.mockResolvedValue({...status,state:'succeeded',result:{...historicalResult,maps:[],
  usage:{inputTokens:2000,outputTokens:800,cacheHitInputTokens:333,cacheMissInputTokens:1667},
  settlement:{status:'settled',cashMicros:2400,pointUnits:null,balanceMicros:2997600}}});
 mount();
 const summary=await screen.findByLabelText('费用与用量');
 expect(summary).toHaveTextContent(/本次费用 ¥0.0024/u);
 const usage=screen.getByText(/缓存命中 333/u);
 expect(usage).not.toBeVisible();
 const menu=summary.closest('details')!;menu.open=true;
 expect(usage).toBeVisible();
 expect(menu).toHaveTextContent(/输入 2000 · 输出 800 Token/u);
 expect(menu).toHaveTextContent(/现金余额 ¥2.9976/u);
});
it('restores saved map cards and pending fees from server history without a browser execution attachment',async()=>{
 mount(undefined,undefined,{agentResults:[historicalResult]});
 expect(await screen.findByRole('button',{name:'查看 已保存的学习地图'})).toBeVisible();
 expect(screen.getByText(/结果已保存，费用待核对。/u)).toBeVisible();
 expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('keeps an earlier saved map card when the next native message starts',async()=>{
 mount(undefined,undefined,{agentResults:[historicalResult]});
 fireEvent.change(screen.getByLabelText('消息'),{target:{value:'A later question'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
 await waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());
 expect(screen.getAllByRole('button',{name:'查看 已保存的学习地图'})).toHaveLength(1);
});
it('consumes a node reference after its native reply is saved, rather than injecting it on every later reply',async()=>{
 let deliver:(event:any)=>void=()=>{};
 api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{deliver=onEvent;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 const consumed=vi.fn();mount({id:'node-session',title:'Session'},consumed);
 fireEvent.change(screen.getByLabelText('消息'),{target:{value:'Explain this'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
 await waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());
 expect(api.acceptAgentExecution.mock.calls[0][1].action.message).toContain('节点 ID：node-session');
 expect(consumed).not.toHaveBeenCalled();
 await waitFor(()=>expect(api.attachAgentExecution).toHaveBeenCalled());
 deliver({executionId:execution,eventId:crypto.randomUUID(),sequence:1,payload:{type:'completed',result:{executionId:execution,conversationId:conversation,generationId:execution,messageId:conversation,answer:'Saved',maps:[],usage:null,settlement:{status:'no_site_charge',cashMicros:null,pointUnits:null,balanceMicros:null}}}});
 await waitFor(()=>expect(consumed).toHaveBeenCalledOnce());
});
it('displays fractional points in the same units as the account balance',async()=>{
 api.fetchActiveAgentExecution.mockResolvedValue({...status,state:'succeeded',funding:'points',result:{
  executionId:execution,conversationId:conversation,generationId:execution,messageId:conversation,answer:'Saved',maps:[],usage:null,
  settlement:{status:'settled',cashMicros:null,pointUnits:5190,balanceMicros:null}}});
 mount();
 expect(await screen.findByText(/本次消耗/u)).toHaveTextContent('本次消耗 0.00519 积分');
 expect(screen.queryByText(/本次消耗 5190 积分/u)).not.toBeInTheDocument();
});
it('keeps draft text if restoration failed and offers a read-only recovery action',async()=>{
 api.fetchActiveAgentExecution.mockRejectedValueOnce(new Error('network lost'));mount();
 await screen.findByText('连接暂时中断。请核对已保存结果后继续。');
 fireEvent.change(screen.getByLabelText('消息'),{target:{value:'Do not lose this message'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
 await waitFor(()=>expect(screen.getByLabelText('消息')).toHaveValue('Do not lose this message'));
 api.fetchActiveAgentExecution.mockResolvedValue(null);fireEvent.click(screen.getByRole('button',{name:'重新加载'}));
 await waitFor(()=>expect(api.fetchActiveAgentExecution).toHaveBeenCalledTimes(2));expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('continues unrelated chat when the pending manual canvas save fails',async()=>{
 canvas.flush.mockRejectedValueOnce(new Error('canvas write failed'));mount();
 fireEvent.change(screen.getByLabelText('消息'),{target:{value:'Explain the node'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
 await waitFor(()=>expect(api.acceptAgentExecution).toHaveBeenCalledOnce());
});
it('retries an original persisted stop with the current session rather than starting another generation',async()=>{
 sessionStorage.setItem(`mapflow.agent.execution.v1.owner.${conversation}`,JSON.stringify({executionId:execution,stopRequested:true,stopTarget:execution,stopActionId:'33333333-3333-4333-8333-333333333333'}));
 api.stopAgentExecution.mockResolvedValue({...status,state:'stopped'});mount();
 await waitFor(()=>expect(api.stopAgentExecution).toHaveBeenCalledWith(execution,conversation,'33333333-3333-4333-8333-333333333333','fresh-csrf'));
 expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
it('shows a persisted map-change confirmation and acknowledges it without another model request',async()=>{
 api.fetchActiveAgentExecution.mockResolvedValue(status);
 api.attachAgentExecution.mockImplementation((_id,_conversation,_after,onEvent,signal:AbortSignal)=>{
  onEvent({executionId:execution,eventId:crypto.randomUUID(),sequence:1,payload:{type:'approval_required',callId:'edit',libraryEntryId:conversation,
   approval:{approvalRequestId:conversation,toolName:'personal_tree_mutation',action:'修改树信息',target:'当前个人树',destructive:false,proposal:{revision:1,patch:{title:'New title'}},mapTitle:'Owned map'}}});
  return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 });
 api.resolveAgentToolApproval.mockResolvedValue(undefined);mount();
 fireEvent.click(await screen.findByRole('button',{name:'确认修改'}));
 await waitFor(()=>expect(api.resolveAgentToolApproval).toHaveBeenCalledWith(execution,conversation,true,false,'fresh-csrf'));
 expect(api.acceptAgentExecution).not.toHaveBeenCalled();
});
