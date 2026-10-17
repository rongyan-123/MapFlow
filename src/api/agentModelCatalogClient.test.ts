import {afterEach,expect,it,vi} from 'vitest';
import {fetchModelCatalog,createModelVerificationBatch} from './agentModelCatalogClient';
import {fetchAgentModelCatalogue} from './agentExecutionClient';
afterEach(()=>vi.unstubAllGlobals());
it('an old server returns an upgrade message without activating or probing any fallback',async()=>{
  const fetcher=vi.fn(async()=>new Response('{}',{status:404}));vi.stubGlobal('fetch',fetcher);
  await expect(fetchModelCatalog()).rejects.toThrow('服务端尚未升级');expect(fetcher).toHaveBeenCalledOnce();
});
it('the existing strict user parser still accepts multiple supplier models without admin fields',async()=>{
  const model=(id:string)=>({profileId:id,profileVersion:1,modelId:id,displayName:id,contextWindow:32768,maxOutputTokens:null});
  vi.stubGlobal('fetch',async()=>Response.json({cash:[model('claude-test'),model('gpt-test'),model('gemini-test')],defaultCash:null,points:null}));
  expect((await fetchAgentModelCatalogue()).cash.map(model=>model.modelId)).toEqual(['claude-test','gpt-test','gemini-test']);
});
it('an explicit batch uses its original browser action identity and CSRF token',async()=>{
  let sent:RequestInit|undefined;
  vi.stubGlobal('fetch',async(_path:string,init:RequestInit)=>{sent=init;return Response.json({batchId:'batch',clientActionId:'stable-action',cancelRequested:false,attempts:[]},{status:202});});
  await createModelVerificationBatch('stable-action',['claude-test'],'csrf');
  expect(JSON.parse(String(sent?.body))).toEqual({clientActionId:'stable-action',profileIds:['claude-test']});
  expect(new Headers(sent?.headers).get('X-CSRF-Token')).toBe('csrf');
});
