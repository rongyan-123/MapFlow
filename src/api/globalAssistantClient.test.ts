import {afterEach,expect,it,vi} from 'vitest';
import {openGlobalAssistant,fetchGlobalMessages,fetchGlobalChanges,fetchGlobalMessageBody,GlobalAssistantApiError} from './globalAssistantClient';

const conversationId='11111111-1111-4111-8111-111111111111';
const snapshot={conversationId,bindingVersion:2,graphRevision:10000,headMessageId:null,messages:[],completions:[],olderCursor:'older/40',syncCursor:'changes/10000',
  generationSettings:{temperature:0.8,maxOutputTokens:null,stopSequences:[]},generationSettingsVersion:1,activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true}};
afterEach(()=>vi.unstubAllGlobals());
it('opens a bounded snapshot with CSRF and reads scoped cursor pages without requesting full history',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(snapshot)))
    .mockResolvedValueOnce(new Response(JSON.stringify({conversationId,bindingVersion:2,messages:[],completions:[],olderCursor:null})))
    .mockResolvedValueOnce(new Response(JSON.stringify({conversationId,bindingVersion:2,graphRevision:10001,headMessageId:null,changes:[],nextCursor:'changes/10001',hasMore:false,activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true}})));
  vi.stubGlobal('fetch',fetch);
  expect(await openGlobalAssistant('csrf')).toEqual(snapshot);
  expect(await fetchGlobalMessages(snapshot,'older/40')).toMatchObject({olderCursor:null});
  expect(await fetchGlobalChanges(snapshot,'changes/10000')).toMatchObject({graphRevision:10001});
  expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/me/global-assistant/open','/api/me/global-assistant/messages?before=older%2F40&limit=40','/api/me/global-assistant/changes?after=changes%2F10000&limit=100']);
  expect(fetch.mock.calls[0][1]).toMatchObject({method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':'csrf'}});
});
it('explains terminal binding errors and never exposes provider diagnostic text',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'global_conversation_not_current',message:'private diagnostic'}}),{status:409}));
  vi.stubGlobal('fetch',fetch);
  await expect(openGlobalAssistant('csrf')).rejects.toThrow('当前助手对话已更新');
  expect(fetch).toHaveBeenCalledOnce();
});
it('preserves validated original execution summaries when migration blocks opening the assistant',async()=>{
  const blocker={executionId:'22222222-2222-4222-8222-222222222222',conversationId,state:'awaiting_reconciliation',funding:'byok',modelId:'original-model',result:null,
    error:{code:'credential_required',message:'private provider text',requestId:'33333333-3333-4333-8333-333333333333'}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'global_assistant_migration_pending',blockingExecutions:[blocker]}}),{status:409})));
  try{await openGlobalAssistant('csrf');throw new Error('Expected migration rejection');}
  catch(error){expect(error).toBeInstanceOf(GlobalAssistantApiError);expect((error as GlobalAssistantApiError).blockingExecutions).toEqual([{...blocker,error:{...blocker.error,message:'请打开配置并填写 API Key。'}}]);}
});
it('rejects an unbounded snapshot and cursor pages belonging to another binding',async()=>{
  const item={messageId:'22222222-2222-4222-8222-222222222222',parentMessageId:null,role:'user',origin:'user',characterId:null,content:'message'};
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...snapshot,messages:Array.from({length:41},()=>item)})))
    .mockResolvedValueOnce(new Response(JSON.stringify({conversationId,bindingVersion:3,messages:[],completions:[],olderCursor:null})));
  vi.stubGlobal('fetch',fetch);
  await expect(openGlobalAssistant('csrf')).rejects.toThrow('同步响应无效');
  await expect(fetchGlobalMessages(snapshot,'older')).rejects.toThrow('同步响应无效');
});
it('rejects an unbounded change page and a cursor that claims more without advancing',async()=>{
  const page={conversationId,bindingVersion:2,graphRevision:1,headMessageId:null,activeExecution:null,blockingExecutions:[],sendAvailability:{conversation:true,cash:true},nextCursor:'next',hasMore:false};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...page,changes:Array.from({length:101},(_,sequence)=>({type:'settlement',sequence:sequence+1}))})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...page,changes:[],hasMore:true,nextCursor:'same'}))));
  await expect(fetchGlobalChanges(snapshot,'cursor')).rejects.toThrow('同步响应无效');
  await expect(fetchGlobalChanges(snapshot,'same')).rejects.toThrow('同步响应无效');
});
it('reads body pages at exact Unicode scalar offsets and rejects a response for a different message',async()=>{
  const messageId='22222222-2222-4222-8222-222222222222';
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({conversationId,bindingVersion:2,messageId,content:'😀前',offset:8192,nextOffset:8194,totalChars:9000})))
    .mockResolvedValueOnce(new Response(JSON.stringify({conversationId,bindingVersion:2,messageId:'33333333-3333-4333-8333-333333333333',content:'wrong',offset:8194,nextOffset:null,totalChars:8199})));
  vi.stubGlobal('fetch',fetch);
  expect(await fetchGlobalMessageBody(snapshot,messageId,8192)).toMatchObject({content:'😀前',offset:8192,nextOffset:8194});
  expect(fetch.mock.calls[0][0]).toBe(`/api/me/global-assistant/messages/${messageId}/body?offset=8192&limit=8192`);
  await expect(fetchGlobalMessageBody(snapshot,messageId,8194)).rejects.toThrow('同步响应无效');
});
