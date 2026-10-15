import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import KnowledgeSources from './KnowledgeSources';
import {KnowledgeApiError} from '../../api/assistantKnowledgeClient';
const api=vi.hoisted(()=>({fetchExecutionKnowledgeSources:vi.fn(),fetchKnowledgeSource:vi.fn()}));
vi.mock('../../api/assistantKnowledgeClient',async original=>({...await original<object>(),...api}));
const sourceId='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{vi.clearAllMocks();api.fetchExecutionKnowledgeSources.mockResolvedValue([{sourceId,articleId:sourceId,revisionId:sourceId,revisionNumber:2,title:'MapFlow 使用指南',sectionPath:['地图'],excerpt:'查找地图',ordinal:0}]);});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><KnowledgeSources executionId="exec" accountId="owner"/></QueryClientProvider>);}
it('opens trusted source metadata and appends every source page',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeSource.mockImplementation((_id:string,offset:number)=>Promise.resolve({sourceId,articleId:sourceId,revisionNumber:2,title:'MapFlow 使用指南',markdown:offset?'后半段。':'# 地图\n前半段。',offset,nextOffset:offset?null:10,totalChars:15}));
  open();await user.click(await screen.findByRole('button',{name:'MapFlow 使用指南 · 版本 2'}));
  await screen.findByText('前半段。');await user.click(screen.getByRole('button',{name:'继续读取原文'}));
  await screen.findByText('前半段。后半段。');expect(api.fetchKnowledgeSource).toHaveBeenLastCalledWith(sourceId,10);
});
it('rechecks visibility when reading and shows unavailability without falling back to excerpts as full truth',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeSource.mockRejectedValue(new KnowledgeApiError('assistant_knowledge.source_unavailable',404,'这份资料已下架或暂时无法查看。'));
  open();await user.click(await screen.findByRole('button',{name:'MapFlow 使用指南 · 版本 2'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('已下架'));expect(screen.queryByText('查找地图')).not.toBeInTheDocument();
});
it('does not flash cached source text on a new open before publication visibility is rechecked',async()=>{
  const user=userEvent.setup();api.fetchKnowledgeSource.mockResolvedValueOnce({sourceId,articleId:sourceId,revisionNumber:2,title:'MapFlow 使用指南',markdown:'旧版公开正文',offset:0,nextOffset:null,totalChars:6});
  open();await user.click(await screen.findByRole('button',{name:'MapFlow 使用指南 · 版本 2'}));await screen.findByText('旧版公开正文');
  await user.click(screen.getByRole('button',{name:'关闭'}));
  api.fetchKnowledgeSource.mockImplementation(()=>new Promise(()=>{}));
  await user.click(screen.getByRole('button',{name:'MapFlow 使用指南 · 版本 2'}));
  expect(screen.queryByText('旧版公开正文')).not.toBeInTheDocument();
});
