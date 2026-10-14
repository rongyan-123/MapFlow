import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import AgentModelProfiles from './AgentModelProfiles';
import {configurationFixture} from './agentModelFixture';
const api=vi.hoisted(()=>({fetchAgentModelConfiguration:vi.fn(),saveAgentModelProfile:vi.fn(),activateAgentModelProfile:vi.fn()}));
vi.mock('../../api/agentModelClient',()=>api);
beforeEach(()=>{vi.clearAllMocks();api.fetchAgentModelConfiguration.mockResolvedValue(configurationFixture());});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><AgentModelProfiles csrfToken="csrf-fixture"/></QueryClientProvider>)}
it('keeps the persisted active model visible when a tested switch fails',async()=>{
  const user=userEvent.setup();api.activateAgentModelProfile.mockRejectedValue(new Error('连接测试失败，原配置仍在使用。'));open();
  await screen.findByText('模型配置');
  await user.click(screen.getByRole('button',{name:'启用 候选积分模型'}));
  await waitFor(()=>expect(api.activateAgentModelProfile).toHaveBeenCalledWith({funding:'points',profileId:'points-test',profileVersion:2,expectedEpoch:3},'csrf-fixture'));
  expect(await screen.findByRole('alert')).toHaveTextContent('原配置仍在使用');
  expect(screen.getByLabelText('当前积分模型')).toHaveTextContent('原积分模型');
  expect(screen.getByLabelText('当前现金模型')).toHaveTextContent('尚未配置');
});
it('saves a fresh immutable version, clears the key, and does not automatically activate it',async()=>{
  const user=userEvent.setup();api.saveAgentModelProfile.mockResolvedValue(configurationFixture());open();
  await screen.findByText('模型配置');
  await user.click(screen.getByRole('button',{name:'新增模型配置'}));
  await user.type(screen.getByLabelText('配置标识'),'new-points');
  await user.type(screen.getByLabelText('显示名称'),'中文助教');
  await user.type(screen.getByLabelText('API Key'),'private-admin-fixture');
  await user.click(screen.getByRole('button',{name:'保存配置版本'}));
  await waitFor(()=>expect(api.saveAgentModelProfile).toHaveBeenCalled());
  expect(api.saveAgentModelProfile.mock.calls[0]![0]).toMatchObject({apiKey:'private-admin-fixture',profile:{
    funding:'points',displayName:'中文助教',snapshot:{profileId:'new-points',profileVersion:1,modelId:'Qwen/Qwen3-8B',
      maxOutputTokens:null,billingPolicy:'points:new-points:1'},pointsPolicy:{inputUnitsPerMillion:1000000}}});
  expect(screen.getByLabelText('API Key')).toHaveValue('');
  expect(api.activateAgentModelProfile).not.toHaveBeenCalled();
});
