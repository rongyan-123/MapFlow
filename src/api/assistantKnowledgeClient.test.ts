import {afterEach,expect,it,vi} from 'vitest';
import {fetchKnowledgeArticles,saveKnowledgeArticle,publishKnowledgeRevision,fetchKnowledgeSource,
  fetchExecutionKnowledgeSources,deleteKnowledgeArticle,KnowledgeApiError} from './assistantKnowledgeClient';

const articleId='11111111-1111-4111-8111-111111111111';
const revisionId='22222222-2222-4222-8222-222222222222';
const fixture=()=>({articleId,title:'网站使用指南',markdown:'# 开始',aliases:['怎么使用'],keywords:['地图'],
  category:'使用指南',sourceNote:'根据当前界面审核',version:2,draftRevisionId:revisionId,publishedRevisionId:null,
  targetRevisionId:null,publicationGeneration:0,indexStatus:'draft',indexError:null,updatedAt:'2026-10-15T01:00:00Z'});
afterEach(()=>vi.unstubAllGlobals());
it('uses a bounded read and preserves immutable publication identities',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({items:[fixture()],total:1})));
  vi.stubGlobal('fetch',fetcher);
  const page=await fetchKnowledgeArticles(40);
  expect(page.items[0]).toMatchObject({version:2,draftRevisionId:revisionId,publishedRevisionId:null});
  expect(fetcher.mock.calls[0]?.[0]).toBe('/api/admin/assistant-knowledge/articles?limit=40&offset=40');
  expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
});
it('saves with CSRF and expected version; publishing binds the saved revision and operation',async()=>{
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(fixture()))));
  vi.stubGlobal('fetch',fetcher);
  await saveKnowledgeArticle(articleId,{title:'网站使用指南',markdown:'# 开始',aliases:[],keywords:[],category:'使用指南',sourceNote:'已核对',expectedVersion:2},'csrf');
  await publishKnowledgeRevision(articleId,{expectedVersion:2,revisionId,operationId:revisionId},'csrf');
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({method:'PUT',headers:{'X-CSRF-Token':'csrf'}});
  expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body)).toEqual({expectedVersion:2,revisionId,operationId:revisionId});
  expect(fetcher.mock.calls[1]?.[0]).toBe(`/api/admin/assistant-knowledge/articles/${articleId}/publish`);
});
it('keeps conflicts terminal and never shows raw server diagnostic text',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'assistant_knowledge.version_conflict',message:'password=SECRET database internal'}}),{status:409}));
  vi.stubGlobal('fetch',fetcher);
  await expect(saveKnowledgeArticle(articleId,{...fixture(),expectedVersion:2},'csrf')).rejects.toMatchObject({code:'assistant_knowledge.version_conflict',status:409,message:expect.stringContaining('其他位置')});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects malformed metadata instead of making an untrusted source clickable',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({sources:[{sourceId:'javascript:alert(1)',title:'资料'}]}))));
  await expect(fetchExecutionKnowledgeSources(revisionId)).rejects.toBeInstanceOf(KnowledgeApiError);
});
it('reads source pages and rejects pages that silently skip or fail to advance',async()=>{
  const body={sourceId:revisionId,articleId,revisionNumber:2,title:'指南',markdown:'第一段',offset:0,nextOffset:3,totalChars:5};
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(body))));
  vi.stubGlobal('fetch',fetcher);
  await expect(fetchKnowledgeSource(revisionId,0)).resolves.toMatchObject({nextOffset:3,totalChars:5});
  await expect(fetchKnowledgeSource(revisionId,3)).rejects.toBeInstanceOf(KnowledgeApiError);
});
it('deletes with a frozen operation identity rather than an unprotected write',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);
  await deleteKnowledgeArticle(articleId,2,revisionId,'csrf');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body)).toEqual({expectedVersion:2,operationId:revisionId});
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({method:'DELETE',headers:{'X-CSRF-Token':'csrf'}});
});
