import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentModelProvider } from '../../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../../domains/models/ModelSelectionContext';
import { SceneModelsProvider } from '../../domains/models/SceneModelContext';
import { modelPurposes, readLegacyScenePreference } from '../../domains/models/scenePreferences';
import ModelSettings from './ModelSettings';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('reports pending saves to its card and saves only the current purpose', async () => {
  const settings = { ...readLegacyScenePreference('owner'), funding: 'cash', profileId: 'cash-profile' };
  const profile = { profileId: 'cash-profile', profileVersion: 1, modelId: 'model', displayName: '实际模型', contextWindow: 128000, maxOutputTokens: 8000 };
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const writes: string[] = [];
  vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') { writes.push(path); return pending; }
    if (path === '/api/me/scene-models') return Response.json(Object.fromEntries(modelPurposes.map(purpose => [purpose, { version: 1, settings }])));
    if (path === '/api/me/agent-models') return Response.json({ cash: [profile], defaultCash: profile, points: { ...profile, profileId:'points-profile', modelId: 'point-model', displayName: '积分模型', contextWindow: 16000, maxOutputTokens: 4000 } });
    if (path === '/api/credit/me') return Response.json({ balance: 123, signedInToday: false, freeRemaining: 0, pricePerTree: 1 });
    return Response.json({}, { status: 503 });
  });
  const busy = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SceneModelsProvider accountId="owner" csrfToken="csrf"><AgentModelProvider accountId="owner"><ModelSelectionProvider accountId="owner"><ModelSettings accountId="owner" csrfToken="csrf" initialPurpose="learning" onWallet={() => {}} onBusyChange={busy} /></ModelSelectionProvider></AgentModelProvider></SceneModelsProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('radio', { name: /使用积分/ }));
  expect(await screen.findByText('可用积分：123')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '保存学习聊天配置' }));
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(true));
  expect(screen.getByRole('button', { name: '取消修改' })).toBeDisabled();
  expect(writes).toEqual(['/api/me/scene-models/learning']);
  await act(async () => finish(Response.json({ version: 2, settings: { ...settings, funding: 'points' } })));
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
  expect(screen.getByRole('status')).toHaveTextContent('已保存学习聊天配置');
});
