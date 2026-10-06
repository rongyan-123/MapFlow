import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ModelPricingPage from './ModelPricingPage';

const catalog = { multiplierLabel: '0.2倍率', currency: 'CNY', updatedAt: '2026-09-30', models: [
  { id: 'model-a', provider: 'AnyAI', contextWindow: 1048576, settings: [{ name: 'thinking', kind: 'switch', options: [] }], vendorCodes: ['vendor-a'], availability: 'byok', pricing: null },
  { id: 'model-b', provider: 'OpenAI', contextWindow: 128000, settings: [{ name: 'reasoning_effort', kind: 'select', options: ['low', 'high'] }], vendorCodes: ['vendor-b', 'vendor-c'], availability: 'byok', pricing: null },
] };
afterEach(() => vi.unstubAllGlobals());
it('shows actual per-channel prices and distinguishes live and estimated statistics',async()=>{
  const live={vendor:'VST',lane:1,enabled:true,inputMicrosPerMillion:1_600_000,outputMicrosPerMillion:3_200_000,successRate24h:99.1,avgResponseSeconds:2.5,statsSource:'live'};
  const paid={...catalog,multiplierLabel:'上游实扣 × 2',models:[{...catalog.models[0],availability:'wallet',vendorCodes:['VST','EST'],pricing:{channels:[live,{...live,vendor:'EST',lane:2,enabled:false,statsSource:'estimated',successRate24h:93,avgResponseSeconds:6}],maxInputMicrosPerMillion:1_600_000,maxOutputMicrosPerMillion:3_200_000,updatedAt:'2026-10-07T00:00:00Z',basis:'upstream_actual_x2'}}]};
  vi.stubGlobal('fetch',vi.fn<typeof fetch>().mockImplementation(async path=>new Response(JSON.stringify(String(path).includes('/wallet')?{balanceMicros:100_000,currency:'CNY',supportContact:'',channels:[],topups:[],ledger:[]}:paid))));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><ModelPricingPage accountId="player-a" onNavigateWallet={()=>{}} onBack={()=>{}} onNavigateTavern={()=>{}}/></QueryClientProvider>);
  await screen.findByRole('button',{name:'选择模型 model-a'});
  expect(screen.getByText(/99.1%/)).toBeVisible();
  expect(screen.getByText(/2.5 秒/)).toBeVisible();
  expect(screen.getByText('真实监控')).toBeVisible();
  expect(screen.getByText('估算数据')).toBeVisible();
  expect(screen.getAllByText(/输入 ¥1.6.*输出 ¥3.2/)[0]).toBeVisible();
  expect(screen.queryByText(/额度调用尚未开放/)).not.toBeInTheDocument();
  expect(screen.queryByText(/上游.*(2|倍)|倍率/)).not.toBeInTheDocument();
  client.clear();
});
it('searches and selects a model with context, settings and honest channel monitoring', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async path => new Response(JSON.stringify(String(path).includes('/wallet') ? { balanceMicros: 3_100_000, currency: 'CNY', supportContact: '', channels: [], topups: [], ledger: [] } : catalog))));
  const navigate = vi.fn();
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><ModelPricingPage accountId="player-a" onNavigateWallet={navigate} onBack={() => {}} onNavigateTavern={() => {}} /></QueryClientProvider>);
  await screen.findByRole('button', { name: '选择模型 model-a' });
  const details = screen.getByRole('region', { name: '模型详情' });
  expect(within(details).getByRole('heading', { name: 'model-a' })).toBeInTheDocument();
  expect(within(details).getByText('vendor-a')).toBeInTheDocument();
  expect(within(details).getByText('暂无监测数据')).toBeInTheDocument();
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  expect(screen.getByText('单价待配置')).toBeInTheDocument();
  expect(screen.getByText(/目前使用自填 Key/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '选择模型 model-b' }));
  expect(within(details).getByRole('heading', { name: 'model-b' })).toBeInTheDocument();
  expect(within(details).getByText('128,000')).toBeInTheDocument();
  expect(within(details).getByText('reasoning_effort')).toBeInTheDocument();
  expect(within(details).getByText('vendor-b')).toBeInTheDocument();
  expect(within(details).getAllByText('暂无监测数据')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('搜索模型'), { target: { value: 'OpenAI' } });
  expect(screen.queryByRole('button', { name: '选择模型 model-a' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '选择模型 model-b' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('搜索模型'), { target: { value: 'missing-model' } });
  expect(screen.getByText('没有找到匹配的模型')).toBeInTheDocument();
  expect(within(details).queryByRole('heading', { name: 'model-b' })).not.toBeInTheDocument();
  expect(screen.queryByText(/倍率/)).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: '现金额度 3.1，前往充值' }));
  expect(navigate).toHaveBeenCalledTimes(1);
  client.clear();
});
