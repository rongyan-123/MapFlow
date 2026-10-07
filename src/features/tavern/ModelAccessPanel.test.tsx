import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ModelAccessPanel from './ModelAccessPanel';
import type { TavernModelSelection } from './types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const selection: TavernModelSelection = { provider: 'custom', apiKey: '', baseUrl: '', model: '', settings: {}, historyBytes: 32768 };
function setup(value = selection, respond = async (_url: string) => new Response('{}')) {
  const saved = vi.fn();
  vi.stubGlobal('fetch', vi.fn(respond));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ModelAccessPanel accountId="player" csrfToken="csrf" modelSelection={value} onModelSelectionChange={saved} />
  </QueryClientProvider>);
  return saved;
}
it('tests the draft without saving or generating and lets the user select a returned model', async () => {
  const saved = setup({ ...selection, apiKey: 'own-key', baseUrl: 'https://gateway.example.com/v1', model: 'old-model' });
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, models: ['new-model'], message: '连接与 Key 验证成功' })));
  fireEvent.click(screen.getByRole('button', { name: '测试连接 / 获取模型' }));
  expect(await screen.findByText('连接与 Key 验证成功')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/me/tavern/model-access/test', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }),
    body: JSON.stringify({ apiKey: 'own-key', baseUrl: 'https://gateway.example.com/v1' }),
  }));
  fireEvent.change(screen.getByLabelText('已获取模型'), { target: { value: 'new-model' } });
  expect(screen.getByLabelText('上游模型')).toHaveValue('new-model');
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存并使用' }));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ model: 'new-model' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('discards late connection results after changing the endpoint and shows failed verification clearly', async () => {
  setup({ ...selection, apiKey: 'own-key', baseUrl: 'https://gateway.example.com/v1', model: 'old-model' });
  let resolve!: (result: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  fireEvent.click(screen.getByRole('button', { name: '测试连接 / 获取模型' }));
  fireEvent.change(screen.getByLabelText('API URL'), { target: { value: 'https://other.example.com/v1' } });
  await act(async () => resolve(new Response(JSON.stringify({ ok: true, models: ['late-model'], message: 'old result' }))));
  expect(screen.queryByText('old result')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('已获取模型')).not.toBeInTheDocument();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, models: [], message: 'Key 无效或权限不足' })));
  fireEvent.click(screen.getByRole('button', { name: '测试连接 / 获取模型' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Key 无效或权限不足');
});
it('does not apply an incomplete custom configuration', () => {
  const saved = setup();
  fireEvent.click(screen.getByRole('button', { name: '保存并使用' }));
  expect(screen.getByRole('alert')).toHaveTextContent('尚未填写 API Key');
  expect(saved).not.toHaveBeenCalled();
});
it('keeps unsaved key edits when changing custom history size', () => {
  const saved = setup();
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'draft-key' } });
  fireEvent.click(screen.getByRole('button', { name: '最近 8 KiB' }));
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByLabelText('API Key')).toHaveValue('draft-key');
  expect(screen.getByRole('button', { name: '最近 8 KiB' })).toHaveAttribute('aria-pressed', 'true');
});
it('shows an unavailable price instead of inventing a price when pricing fails', async () => {
  setup({ ...selection, provider: 'platform' }, async url => new Response(JSON.stringify(
    url === '/api/me/tavern/platform-models' ? { enabled: true, billingMode: 'wallet', policyVersion: 'cash-v1-actual-x2', models: [{ id: 'missing-price', provider: 'AnyAI', contextWindow: 32768 }] }
      : { balanceMicros: 800000, currency: 'CNY', supportContact: '', channels: [], topups: [], ledger: [] }
  )));
  expect(await screen.findByText('价格暂时无法获取')).toBeVisible();
  expect(screen.queryByText(/输入 ¥/u)).not.toBeInTheDocument();
});
it('shows the already calculated site price range using only available channels', async () => {
  setup({ ...selection, provider: 'platform' }, async url => new Response(JSON.stringify(
    url === '/api/me/tavern/platform-models' ? { enabled: true, billingMode: 'wallet', policyVersion: 'cash-v1-actual-x2', models: [{ id: 'priced-model', provider: 'AnyAI', contextWindow: 32768 }] }
    : url === '/api/model-catalog/pricing' ? { multiplierLabel: '', currency: 'CNY', updatedAt: '2026-10-07T00:00:00Z', models: [{
      id: 'priced-model', provider: 'AnyAI', contextWindow: 32768, vendorCodes: ['A', 'B'], settings: [], availability: 'wallet',
      pricing: { basis: 'upstream_actual_x2', updatedAt: '2026-10-07T00:00:00Z', maxInputMicrosPerMillion: 800000, maxOutputMicrosPerMillion: 1600000,
        channels: [{ vendor: 'A', lane: 1, enabled: true, inputMicrosPerMillion: 400000, outputMicrosPerMillion: 1200000, statsSource: 'unknown', successRate24h: null, avgResponseSeconds: null },
          { vendor: 'B', lane: 2, enabled: true, inputMicrosPerMillion: 800000, outputMicrosPerMillion: 1600000, statsSource: 'unknown', successRate24h: null, avgResponseSeconds: null },
          { vendor: 'C', lane: 3, enabled: false, inputMicrosPerMillion: 100000, outputMicrosPerMillion: 9000000, statsSource: 'unknown', successRate24h: null, avgResponseSeconds: null }] },
    }] } : { balanceMicros: 800000, currency: 'CNY', supportContact: '', channels: [], topups: [], ledger: [] }
  )));
  expect(await screen.findByText('输入 ¥0.4–0.8 · 输出 ¥1.2–1.6 / 百万 Token')).toBeVisible();
  expect(screen.queryByText(/上游.*×/u)).not.toBeInTheDocument();
});
it('only applies a validated draft after saving and clears the key when changing provider presets', () => {
  const saved = setup();
  fireEvent.click(screen.getByRole('button', { name: 'DeepSeek' }));
  expect(screen.getByLabelText('API URL')).toHaveValue('https://api.deepseek.com/v1');
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-for-deepseek' } });
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存并使用' }));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'secret-for-deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' }));
  expect(screen.getByRole('status')).toHaveTextContent('已保存');
  fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }));
  expect(screen.getByLabelText('API Key')).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('未保存');
  expect(saved).toHaveBeenCalledTimes(1);
});
