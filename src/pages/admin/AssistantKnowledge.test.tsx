import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,waitFor,fireEvent,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import AssistantKnowledge from './AssistantKnowledge';
import {KnowledgeApiError} from '../../api/assistantKnowledgeClient';

const api=vi.hoisted(()=>({fetchKnowledgeArticles:vi.fn(),fetchKnowledgeArticle:vi.fn(),saveKnowledgeArticle:vi.fn(),
  publishKnowledgeRevision:vi.fn(),unpublishKnowledgeArticle:vi.fn(),fetchKnowledgeRevisions:vi.fn(),
  rollbackKnowledgeRevision:vi.fn(),deleteKnowledgeArticle:vi.fn()}));
vi.mock('../../api/assistantKnowledgeClient',async original=>({...await original<object>(),...api}));
const articleId='11111111-1111-4111-8111-111111111111',revisionId='22222222-2222-4222-8222-222222222222';
const fixture=()=>({articleId,title:'网站使用指南',markdown:'# 开始\n选择一个目标。',category:'使用指南',sourceNote:'审核稿',aliases:[],keywords:[],
  version:1,draftRevisionId:revisionId,publishedRevisionId:null,targetRevisionId:null,publicationGeneration:0,indexStatus:'draft',indexError:null,updatedAt:'2026-10-15T00:00:00Z'});
beforeEach(()=>{vi.clearAllMocks();api.fetchKnowledgeArticles.mockResolvedValue({items:[fixture()],total:1});api.fetchKnowledgeArticle.mockResolvedValue(fixture());api.fetchKnowledgeRevisions.mockResolvedValue([]);});
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});render(<QueryClientProvider client={client}><AssistantKnowledge accountId="admin" csrfToken="csrf" /></QueryClientProvider>);return client;}
it('saves a reviewable draft first and only publishes its saved immutable revision',async()=>{
  const user=userEvent.setup();api.saveKnowledgeArticle.mockResolvedValue({...fixture(),version:2});api.publishKnowledgeRevision.mockResolvedValue({...fixture(),version:3,indexStatus:'queued',targetRevisionId:revisionId});
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  const title=await screen.findByLabelText('标题');await user.clear(title);await user.type(title,'新版使用指南');
  expect(screen.getByRole('button',{name:'发布已保存版本'})).toBeDisabled();
  await user.click(screen.getByRole('button',{name:'保存草稿'}));
  await waitFor(()=>expect(api.saveKnowledgeArticle).toHaveBeenCalledWith(articleId,expect.objectContaining({title:'新版使用指南',expectedVersion:1}),'csrf'));
  await user.click(screen.getByRole('button',{name:'发布已保存版本'}));
  const dialog=screen.getByRole('dialog',{name:'发布知识库文章'});expect(within(dialog).getByText(/普通用户/)).toBeVisible();
  await user.click(within(dialog).getByRole('button',{name:'确认发布'}));
  await waitFor(()=>expect(api.publishKnowledgeRevision).toHaveBeenCalledWith(articleId,{expectedVersion:2,revisionId,operationId:expect.any(String)},'csrf'));
});
it('keeps unsaved text after a version conflict and never publishes it',async()=>{
  const user=userEvent.setup();api.saveKnowledgeArticle.mockRejectedValue(new KnowledgeApiError('assistant_knowledge.version_conflict',409,'内容已在其他位置更新。'));
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  fireEvent.change(await screen.findByLabelText('正文（Markdown）'),{target:{value:'保留我的修改'}});
  await user.click(screen.getByRole('button',{name:'保存草稿'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('其他位置');
  expect(screen.getByLabelText('正文（Markdown）')).toHaveValue('保留我的修改');
  expect(screen.getByRole('button',{name:'发布已保存版本'})).toBeDisabled();expect(api.publishKnowledgeRevision).not.toHaveBeenCalled();
});
it('requires confirmation to unpublish, retaining revision history',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeArticle.mockResolvedValue({...fixture(),publishedRevisionId:revisionId,indexStatus:'ready'});
  api.unpublishKnowledgeArticle.mockResolvedValue({...fixture(),version:2,indexStatus:'unpublished'});
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  await user.click(await screen.findByRole('button',{name:'下架'}));expect(api.unpublishKnowledgeArticle).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog',{name:'下架知识库文章'})).getByRole('button',{name:'确认下架'}));
  await waitFor(()=>expect(api.unpublishKnowledgeArticle).toHaveBeenCalledWith(articleId,1,expect.any(String),'csrf'));
});
it('asks before abandoning unsaved changes while switching to a new draft',async()=>{
  const user=userEvent.setup();open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  fireEvent.change(await screen.findByLabelText('正文（Markdown）'),{target:{value:'尚未保存的正文'}});
  await user.click(screen.getByRole('button',{name:'新建文章'}));
  const dialog=screen.getByRole('dialog',{name:'保留当前修改'});
  await user.click(within(dialog).getByRole('button',{name:'继续编辑'}));
  expect(screen.getByLabelText('正文（Markdown）')).toHaveValue('尚未保存的正文');
});
it('retries a lost publication response with the original operation and version despite a background refresh',async()=>{
  const user=userEvent.setup();api.publishKnowledgeRevision.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({...fixture(),version:3,indexStatus:'queued'});
  const client=open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  await user.click(await screen.findByRole('button',{name:'发布已保存版本'}));
  await user.click(screen.getByRole('button',{name:'确认发布'}));
  await waitFor(()=>expect(api.publishKnowledgeRevision).toHaveBeenCalledTimes(1));
  client.setQueryData(['admin','assistant-knowledge','admin','article',articleId],{...fixture(),version:9});
  await waitFor(()=>expect(screen.getByRole('button',{name:'确认发布'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'确认发布'}));
  await waitFor(()=>expect(api.publishKnowledgeRevision).toHaveBeenCalledTimes(2));
  expect(api.publishKnowledgeRevision.mock.calls[1]).toEqual(api.publishKnowledgeRevision.mock.calls[0]);
});
it('can inspect older revisions beyond the first page',async()=>{
  const user=userEvent.setup();const revision=(number:number)=>({...fixture(),revisionId:`22222222-2222-4222-8222-${String(number).padStart(12,'0')}`,revisionNumber:number,contentDigest:'digest',createdAt:'2026-10-15T00:00:00Z'});
  api.fetchKnowledgeRevisions.mockImplementation((_id:string,offset=0)=>Promise.resolve(offset?[revision(40)]:Array.from({length:40},(_,index)=>revision(80-index))));
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  await user.click(await screen.findByRole('button',{name:'修订记录'}));
  await user.click(await screen.findByRole('button',{name:'较早修订'}));
  await screen.findByRole('button',{name:'查看版本 40'});
  expect(api.fetchKnowledgeRevisions).toHaveBeenLastCalledWith(articleId,40);
});
it('offers rollback only for previously published revisions and can publish older drafts explicitly',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeRevisions.mockResolvedValue([
    {...fixture(),revisionId,revisionNumber:1,contentDigest:'digest',createdAt:'2026-10-15T00:00:00Z',publishedBefore:false},
    {...fixture(),revisionId:articleId,revisionNumber:2,contentDigest:'digest',createdAt:'2026-10-15T00:00:00Z',publishedBefore:true}]);
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));await user.click(await screen.findByRole('button',{name:'修订记录'}));
  expect(await screen.findByRole('button',{name:'发布版本 1'})).toBeEnabled();
  expect(screen.getByRole('button',{name:'回滚到版本 2'})).toBeEnabled();
  expect(screen.queryByRole('button',{name:'回滚到版本 1'})).not.toBeInTheDocument();
});
it('removes empty alias and keyword lines when saving while allowing normal multiline editing',async()=>{
  const user=userEvent.setup();api.saveKnowledgeArticle.mockResolvedValue({...fixture(),version:2});open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  fireEvent.change(await screen.findByLabelText('别名（每行一个）'),{target:{value:' API Key \n\n模型\n'}});
  fireEvent.change(screen.getByLabelText('关键词（每行一个）'),{target:{value:'\n  \n'}});
  await user.click(screen.getByRole('button',{name:'保存草稿'}));
  await waitFor(()=>expect(api.saveKnowledgeArticle).toHaveBeenCalledWith(articleId,expect.objectContaining({aliases:['API Key','模型'],keywords:[]}),'csrf'));
});
it('unpublishes the public version without deleting an unsaved draft in the editor',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeArticle.mockResolvedValue({...fixture(),publishedRevisionId:revisionId,indexStatus:'published'});
  api.unpublishKnowledgeArticle.mockResolvedValue({...fixture(),version:2,indexStatus:'unpublished'});
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));
  fireEvent.change(await screen.findByLabelText('正文（Markdown）'),{target:{value:'我的未保存新稿'}});
  await user.click(screen.getByRole('button',{name:'下架'}));await user.click(screen.getByRole('button',{name:'确认下架'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByLabelText('正文（Markdown）')).toHaveValue('我的未保存新稿');
  expect(screen.getByRole('button',{name:'保存草稿'})).toBeEnabled();
});
it('keeps a previous-page escape when the last article on page two is deleted',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeArticles.mockResolvedValueOnce({items:[fixture()],total:41}).mockResolvedValueOnce({items:[],total:40});
  open();await user.click(await screen.findByRole('button',{name:'下一页'}));
  await waitFor(()=>expect(api.fetchKnowledgeArticles).toHaveBeenLastCalledWith(40));
  await waitFor(()=>expect(screen.getByRole('button',{name:'上一页'})).toBeEnabled());
});
it('shows one revision dialog at a time and returns to history when a preview closes',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeRevisions.mockResolvedValue([{...fixture(),revisionId,revisionNumber:1,contentDigest:'digest',createdAt:'2026-10-15T00:00:00Z',publishedBefore:false}]);
  open();await user.click(await screen.findByRole('button',{name:'网站使用指南'}));await user.click(await screen.findByRole('button',{name:'修订记录'}));
  await user.click(await screen.findByRole('button',{name:'查看版本 1'}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  await user.click(screen.getByRole('button',{name:'关闭'}));
  expect(await screen.findByRole('dialog',{name:'修订记录'})).toBeVisible();
});
