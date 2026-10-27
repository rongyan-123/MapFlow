import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AgentCompletion, AgentPayload, AgentStatus } from '../api/agentExecutionClient';
import type { ConversationDetail, GenerationAction } from '../domains/conversations/types';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import { character, conversation, detail } from '../test/conversations';
import SceneWorkspace from './SceneWorkspace';

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div aria-label="绘图编辑器" />,
  restoreElements: (elements: unknown[]) => elements,
  convertToExcalidrawElements: (elements: unknown[]) => elements,
}));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const accountId = 'chat-interaction-owner';
const conversationId = '22222222-2222-4222-8222-222222222222';
const areaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const executionId = '44444444-4444-4444-8444-444444444444';
const profile = { profileId: '33333333-3333-4333-8333-333333333333', profileVersion: 1, modelId: 'test-model', displayName: '所选模型', contextWindow: 128000, maxOutputTokens: 8000 };
const receipt: AgentCompletion = {
  executionId, conversationId, generationId: '55555555-5555-4555-8555-555555555555',
  messageId: '66666666-6666-4666-8666-666666666666', answer: '先画出请求与回复的关系。', maps: [], usage: null,
  settlement: { status: 'settled', cashMicros: 20000, pointUnits: null, balanceMicros: 980000 },
};
function mount({ scene = 'learning', fresh = true, width = 1440, restored, loseAcceptance = false, historyDelivery = true }:
  { scene?: 'learning' | 'tavern'; fresh?: boolean; width?: number; restored?: GenerationAction; loseAcceptance?: boolean; historyDelivery?: boolean } = {}) {
  vi.stubGlobal('innerWidth', width);
  const story = { ...conversation, conversationId, scene, libraryEntryId: scene === 'learning' ? areaId : null, learningAreaId: scene === 'learning' ? areaId : null };
  let saved: ConversationDetail = { ...detail, conversation: story, canvas: { enabled: true, revision: 0, elements: [] },
    ...(fresh ? { turns: [], generations: [], graph: { ...detail.graph, activePath: ['message-opening'], messages: [detail.graph.messages[0]], branches: [{ ...detail.graph.branches[0], leafMessageId: 'message-opening' }] } } : {}) };
  const running: AgentStatus = { executionId, conversationId, state: 'running', funding: 'cash', modelId: 'test-model', result: null, error: null };
  const requests: Array<{ path: string; options?: RequestInit }> = [];
  const commands: Array<{ clientActionId: string; action: GenerationAction }> = [];
  const encoder = new TextEncoder();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  let sequence = 0;
  let finished = false;
  if (restored) sessionStorage.setItem(`mapflow.agent.execution.v1.${accountId}.${conversationId}`, JSON.stringify({ executionId, command: { funding: 'cash', clientActionId: '77777777-7777-4777-8777-777777777777', expectedRevision: 1, action: restored } }));
  vi.stubGlobal('fetch', async (path: string, options?: RequestInit) => {
    requests.push({ path, options });
    if (path === '/api/me/agent-models') return new Response(JSON.stringify({ cash: [profile], defaultCash: profile, points: null }));
    if (path.endsWith('/characters')) return new Response(JSON.stringify({ characters: [character] }));
    if (path.endsWith('/executions')) {
      if (options?.method === 'POST') {
        commands.push(JSON.parse(String(options.body)));
        if (loseAcceptance) throw new TypeError('acceptance response lost');
        return new Response(JSON.stringify({ execution: running, replayed: false }));
      }
      return new Response(JSON.stringify({ execution: restored ? running : null }));
    }
    if (path.includes(`/agent-executions/${executionId}/events?`)) return new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } }), { headers: { 'Content-Type': 'text/event-stream' } });
    if (path.endsWith(`/agent-executions/${executionId}`)) return new Response(JSON.stringify(finished ? { ...running, state: 'succeeded', result: receipt } : running));
    if (path.endsWith('/canvas')) return new Response(JSON.stringify(saved.canvas));
    if (path.endsWith('/' + conversationId)) return finished && !historyDelivery ? new Response('{}', { status: 503 }) : new Response(JSON.stringify(saved));
    if (path.endsWith('/conversations')) return new Response(JSON.stringify({ conversations: [story], bootstrapState: 'has_active' }));
    return new Response('{}', { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: accountId, username: '小明', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  const element = <QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId={accountId}><ModelSelectionProvider accountId={accountId}><SceneWorkspace owner={{ accountId, csrfToken: 'csrf', userName: '小明', scene, ...(scene === 'learning' ? { areaId, available: true } : {}) }} navigate={vi.fn()} /></ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>;
  const view = render(element);
  function publish(payload: AgentPayload, state: AgentStatus['state'] = 'running') {
    sequence++;
    stream!.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({ events: [{ executionId, eventId: crypto.randomUUID(), sequence, payload }], nextSequence: sequence, state })}\n\n`));
  }
  function finish() {
    const action = commands[0]?.action ?? restored;
    const question = action?.type === 'reply' ? action.message : '';
    const parentMessageId = saved.graph.activePath[saved.graph.activePath.length - 1];
    const user = { ...detail.graph.messages[1], messageId: 'new-user-message', parentMessageId, content: question };
    const answer = { ...detail.graph.messages[2], messageId: receipt.messageId, parentMessageId: user.messageId, content: receipt.answer };
    saved = { ...saved, generations: [...saved.generations, { ...detail.generations[0], generationId: receipt.generationId, clientActionId: commands[0]?.clientActionId ?? '77777777-7777-4777-8777-777777777777', intent: 'reply', inputMessageId: user.messageId, outputMessageId: answer.messageId }], graph: { ...saved.graph, revision: 2, messages: [...saved.graph.messages, user, answer], activePath: [...saved.graph.activePath, user.messageId, answer.messageId] } };
    finished = true;
    publish({ type: 'completed', result: receipt }, 'succeeded');
    stream!.close();
  }
  return { ...view, element, client, requests, commands, publish, finish };
}
async function sendQuestion(text = '请用画布介绍这个知识点') {
  await screen.findByText('消息操作');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
}

it('collapses the whole desktop history without replacing the draft or drawing editor', async () => {
  mount();
  await screen.findByText('消息操作');
  fireEvent.click(screen.getByRole('button', { name: '教学画布' }));
  const canvas = await screen.findByRole('region', { name: '教学画布' });
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '还没发送的问题' } });
  const toggle = screen.getByRole('button', { name: '收起会话历史' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByRole('separator', { name: '调整会话历史宽度' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '教学画布' })).toBe(canvas);
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('还没发送的问题');
  fireEvent.click(screen.getByRole('button', { name: '展开会话历史' }));
  expect(screen.getByRole('complementary')).toBeVisible();
});

it('keeps a mobile history button outside the overflow menu and opens a drawer', async () => {
  mount({ width: 390 });
  await screen.findByText('消息操作');
  const toggle = screen.getByRole('button', { name: '会话历史' });
  expect(toggle).not.toHaveClass('mf-chat-secondary');
  fireEvent.click(toggle);
  expect(screen.getByRole('dialog', { name: '会话历史' })).toBeVisible();
  expect(screen.getByRole('button', { name: '会话历史' })).toHaveAttribute('aria-expanded', 'true');
});

it.each(['learning', 'tavern'] as const)('opens model selection directly from the %s composer and preserves its draft', async scene => {
  mount({ scene });
  await screen.findByText('消息操作');
  fireEvent.change(screen.getByRole('textbox', { name: '消息' }), { target: { value: '保留这个草稿' } });
  // Select the visible composer chip, without relying on a new label to reproduce the existing route.
  fireEvent.click(screen.getByRole('button', { name: /所选模型 · 现金额度/ }));
  const settings = within(screen.getByRole('dialog', { name: '配置' }));
  expect(settings.getByRole('button', { name: '模型接入' })).toHaveAttribute('aria-selected', 'true');
  expect(settings.getByRole('combobox', { name: '模型' })).toBeVisible();
  fireEvent.click(settings.getByRole('button', { name: '关闭' }));
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('保留这个草稿');
});

it('shows the outgoing question before streamed tool progress and assistant text', async () => {
  const view = mount();
  await sendQuestion();
  await waitFor(() => expect(view.requests.some(request => request.path.includes('/events?'))).toBe(true));
  await act(async () => view.publish({ type: 'text_delta', text: '正在组织图示' }));
  const log = screen.getByRole('log', { name: '对话消息' });
  expect(within(log).getByText('请用画布介绍这个知识点')).toBeVisible();
  expect(log.querySelector('.mf-message--user')).toHaveTextContent('请用画布介绍这个知识点');
  expect(screen.queryByRole('heading', { name: '从一个知识点，开始理解。' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('');
  view.unmount();
});

it.each([true, false])('keeps one outgoing question after completion, including when history delivery succeeds=%s', async historyDelivery => {
  const view = mount({ historyDelivery });
  await sendQuestion();
  await waitFor(() => expect(view.requests.some(request => request.path.includes('/events?'))).toBe(true));
  await act(async () => view.finish());
  const log = within(screen.getByRole('log', { name: '对话消息' }));
  await log.findByText(receipt.answer);
  expect(log.getAllByText('请用画布介绍这个知识点')).toHaveLength(1);
  if (historyDelivery) await waitFor(() => expect(view.client.getQueryData<ConversationDetail>(['me', accountId, 'tavern', 'conversation', conversationId])?.graph.revision).toBe(2));
  expect(log.getAllByText('请用画布介绍这个知识点')).toHaveLength(1);
});

it('recovers the saved outgoing question without resending the command', async () => {
  const view = mount({ restored: { type: 'reply', message: '刷新前发送的问题' } });
  await waitFor(() => expect(view.requests.some(request => request.path.includes('/events?'))).toBe(true));
  expect(within(screen.getByRole('log', { name: '对话消息' })).getByText('刷新前发送的问题')).toBeVisible();
  expect(view.commands).toHaveLength(0);
  view.unmount();
});

it('keeps an uncertain outgoing question visible until the user returns it to editing', async () => {
  const view = mount({ loseAcceptance: true });
  await sendQuestion();
  await screen.findByRole('button', { name: '返回编辑' });
  expect(within(screen.getByRole('log', { name: '对话消息' })).getByText('请用画布介绍这个知识点')).toBeVisible();
  expect(screen.getByText('发送状态待确认')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '返回编辑' }));
  expect(within(screen.getByRole('log', { name: '对话消息' })).queryByText('请用画布介绍这个知识点')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '消息' })).toHaveValue('请用画布介绍这个知识点');
  expect(view.commands).toHaveLength(1);
});

it('does not hide a new outgoing question just because an earlier question has the same text', async () => {
  const view = mount({ fresh: false });
  await sendQuestion('来杯茶');
  await waitFor(() => expect(view.commands).toHaveLength(1));
  expect(within(screen.getByRole('log', { name: '对话消息' })).getAllByText('来杯茶')).toHaveLength(2);
  view.unmount();
});

it.each(['重新生成', '继续'])('does not invent another user question when invoking %s', async label => {
  const view = mount({ fresh: false });
  await screen.findByText('请用茶。');
  fireEvent.click(screen.getByText('消息操作'));
  fireEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(view.commands).toHaveLength(1));
  expect(screen.getByRole('log', { name: '对话消息' }).querySelectorAll('.mf-message--user')).toHaveLength(1);
  view.unmount();
});
