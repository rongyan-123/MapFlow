import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import ModelCatalogPanel from './ModelCatalogPanel';
const api=vi.hoisted(()=>({fetchModelCatalog:vi.fn(),syncModelCatalog:vi.fn(),createModelVerificationBatch:vi.fn(),fetchModelVerificationBatch:vi.fn(),setModelAvailability:vi.fn(),setDefaultCashModel:vi.fn(),cancelModelVerificationBatch:vi.fn(),recheckModelVerificationBatch:vi.fn()}));
vi.mock('../../api/agentModelCatalogClient',()=>api);
const candidate={modelId:'claude-test',displayName:'Claude 测试',profileId:'claude-profile',profileVersion:2,status:'active',reason:null,sourceGeneration:2,
  publicationGeneration:4,adminEnabled:true,selectable:false,verificationStandard:2,verifiedAt:null,latestAttempt:null};
beforeEach(()=>{vi.clearAllMocks();api.fetchModelCatalog.mockResolvedValue({schemaVersion:1,source:{generation:2},lastSync:null,candidates:[candidate],recentBatches:[]});});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ModelCatalogPanel csrfToken="csrf" sources={[{id:'source',name:'已保存接入'}]} defaultEpoch={1} onDefaultChanged={()=>{}} /></QueryClientProvider>);}
it('opening the admin catalogue is read-only; verification and setting a default are separate operations',async()=>{
  const user=userEvent.setup();api.createModelVerificationBatch.mockResolvedValue({batchId:'batch',clientActionId:'action',cancelRequested:false,attempts:[]});
  api.fetchModelVerificationBatch.mockResolvedValue({batchId:'batch',clientActionId:'action',cancelRequested:false,attempts:[]});open();
  await screen.findByText('Claude 测试');expect(api.createModelVerificationBatch).not.toHaveBeenCalled();expect(api.syncModelCatalog).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'验证 Claude 测试'}));
  await waitFor(()=>expect(api.createModelVerificationBatch).toHaveBeenCalledOnce());
  expect(api.createModelVerificationBatch.mock.calls[0][1]).toEqual(['claude-profile']);
  expect(api.setDefaultCashModel).not.toHaveBeenCalled();
});
it('shows unknown outcome as waiting for evidence and offers no normal retry',async()=>{
  api.fetchModelCatalog.mockResolvedValue({schemaVersion:1,source:{generation:2},lastSync:null,recentBatches:[],candidates:[{...candidate,latestAttempt:{batchId:'saved',attemptId:'attempt',state:'outcome_unknown',reason:'连接中断'}}]});
  open();await screen.findByText(/结果待确认/);expect(screen.queryByRole('button',{name:'验证 Claude 测试'})).not.toBeInTheDocument();
  expect(api.createModelVerificationBatch).not.toHaveBeenCalled();
});
it('rechecks original uncertain evidence without starting another model verification',async()=>{
  const user=userEvent.setup();
  const saved={batchId:'saved',clientActionId:'original',cancelRequested:false,attempts:[{attemptId:'attempt',executionId:'execution',profileId:'claude-profile',profileVersion:2,state:'outcome_unknown',reason:'结果待确认',cancelRequested:false}]};
  api.fetchModelCatalog.mockResolvedValue({schemaVersion:1,source:{generation:2},lastSync:null,recentBatches:['saved'],candidates:[{...candidate,latestAttempt:{batchId:'saved',attemptId:'attempt',state:'outcome_unknown',reason:null}}]});
  api.fetchModelVerificationBatch.mockResolvedValue(saved);api.recheckModelVerificationBatch.mockResolvedValue(saved);
  open();await user.click(await screen.findByRole('button',{name:'核对原验证记录（不调用模型）'}));
  await waitFor(()=>expect(api.recheckModelVerificationBatch).toHaveBeenCalledWith('saved','csrf'));
  expect(api.createModelVerificationBatch).not.toHaveBeenCalled();
});
it.each(['completed','failed'])('refreshes publication actions when the original polled batch becomes %s',async(state)=>{
  const saved={batchId:'saved',clientActionId:'original',cancelRequested:false,attempts:[{attemptId:'attempt',executionId:'execution',profileId:'claude-profile',profileVersion:2,state:'queued',reason:null,cancelRequested:false}]};
  const initial={schemaVersion:1,source:{generation:2},lastSync:null,recentBatches:['saved'],candidates:[{...candidate,latestAttempt:{batchId:'saved',attemptId:'attempt',state:'queued',reason:null}}]};
  api.fetchModelCatalog.mockResolvedValueOnce(initial).mockResolvedValue({...initial,candidates:[{...candidate,selectable:state==='completed',latestAttempt:{batchId:'saved',attemptId:'attempt',state,reason:null}}]});
  api.fetchModelVerificationBatch.mockResolvedValueOnce(saved).mockResolvedValue({...saved,attempts:[{...saved.attempts[0],state}]});
  open();
  await waitFor(()=>expect(screen.getByRole('button',{name:state==='completed'?'设为现金默认':'验证 Claude 测试'})).toBeVisible(),{timeout:4500});
  expect(api.fetchModelCatalog.mock.calls.length).toBeGreaterThan(1);expect(api.createModelVerificationBatch).not.toHaveBeenCalled();
});
it('allows an interrupted sync to be reread and explicitly restarted without dispatching a probe',async()=>{
  const user=userEvent.setup();const catalog={schemaVersion:1,source:{generation:2},recentBatches:[],candidates:[]};
  api.fetchModelCatalog.mockResolvedValueOnce({...catalog,lastSync:{state:'fetching'}}).mockResolvedValue({...catalog,lastSync:{state:'failed',reason:'同步已中断，请重新同步'}});
  open();expect(await screen.findByRole('button',{name:'正在同步目录…'})).toBeDisabled();
  await user.click(screen.getByRole('button',{name:'重新读取目录'}));
  expect(await screen.findByRole('button',{name:'同步上游目录'})).toBeEnabled();expect(api.syncModelCatalog).not.toHaveBeenCalled();expect(api.createModelVerificationBatch).not.toHaveBeenCalled();
});
