import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KnowledgeChatPanel from './KnowledgeChatPanel';
import { KnowledgeChatApiError } from './types';

const chatApi = vi.hoisted(() => ({
  fetchKnowledgeChatHistory: vi.fn(),
  sendKnowledgeChatMessageStream: vi.fn(),
}));

vi.mock('./knowledgeChatClient', () => chatApi);

beforeEach(() => {
  chatApi.fetchKnowledgeChatHistory.mockReset();
  chatApi.fetchKnowledgeChatHistory.mockResolvedValue({ messages: [] });
  chatApi.sendKnowledgeChatMessageStream.mockReset();
});

describe('KnowledgeChatPanel', () => {
  it('restores persisted messages when a personal tree chat opens', async () => {
    chatApi.fetchKnowledgeChatHistory.mockResolvedValueOnce({
      messages: [
        { id: 'history-user', role: 'user', content: '之前的问题' },
        { id: 'history-assistant', role: 'assistant', content: '之前的回答' },
      ],
    });

    renderPanel();

    expect(await screen.findByText('之前的问题')).toBeInTheDocument();
    expect(screen.getByText('之前的回答')).toBeInTheDocument();
    expect(chatApi.fetchKnowledgeChatHistory).toHaveBeenCalledWith('entry-1');
  });

  it('opens a chat with a long history scrolled to the latest message', async () => {
    chatApi.fetchKnowledgeChatHistory.mockResolvedValueOnce({
      messages: [
        { id: 'history-user', role: 'user', content: '很早之前的问题' },
        { id: 'history-assistant', role: 'assistant', content: '很早之前的回答' },
        { id: 'latest-user', role: 'user', content: '最新的问题' },
        { id: 'latest-assistant', role: 'assistant', content: '最新的回答' },
      ],
    });

    renderPanel();
    const messagesContainer = screen.getByTestId('knowledge-chat-messages');
    Object.defineProperty(messagesContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    });

    expect(await screen.findByText('最新的回答')).toBeInTheDocument();
    await waitFor(() => expect(messagesContainer.scrollTop).toBe(1200));
  });

  it('waits for a hidden chat to become visible before scrolling to the latest message', async () => {
    chatApi.fetchKnowledgeChatHistory.mockResolvedValueOnce({
      messages: [
        { id: 'history-user', role: 'user', content: '隐藏时加载的问题' },
        { id: 'history-assistant', role: 'assistant', content: '隐藏时加载的回答' },
        { id: 'latest-user', role: 'user', content: '打开后的最新问题' },
        { id: 'latest-assistant', role: 'assistant', content: '打开后的最新回答' },
      ],
    });

    let isVisible = false;
    const { rerender } = render(
      <div hidden={!isVisible}>
        <KnowledgeChatPanel
          treeTitle="NestJS 学习树"
          libraryEntryId="entry-1"
          csrfToken="csrf-secret"
          onClose={vi.fn()}
          isVisible={isVisible}
        />
      </div>,
    );
    const messagesContainer = screen.getByTestId('knowledge-chat-messages');
    Object.defineProperty(messagesContainer, 'scrollHeight', {
      configurable: true,
      get: () => (isVisible ? 1200 : 0),
    });

    expect(await screen.findByText('打开后的最新回答')).toBeInTheDocument();
    expect(messagesContainer.scrollTop).toBe(0);

    isVisible = true;
    rerender(
      <div hidden={!isVisible}>
        <KnowledgeChatPanel
          treeTitle="NestJS 学习树"
          libraryEntryId="entry-1"
          csrfToken="csrf-secret"
          onClose={vi.fn()}
          isVisible={isVisible}
        />
      </div>,
    );

    await waitFor(() => expect(messagesContainer.scrollTop).toBe(1200));
  });

  it('refreshes the formal credit query after a successful answer', async () => {
    const user = userEvent.setup();
    const onCreditChanged = vi.fn();
    chatApi.sendKnowledgeChatMessageStream.mockResolvedValueOnce({
      answer: '已完成回答。',
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 1,
      },
      chargedCredits: 0.000003,
      creditBalance: 4.999997,
    });

    renderPanel({ onCreditChanged });
    await waitForHistoryReady();
    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '刷新积分');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('已完成回答。')).toBeInTheDocument();
    expect(onCreditChanged).toHaveBeenCalledOnce();
  });

  it('shows the user turn, disables duplicate sends, and renders a production-safe charge notice', async () => {
    const user = userEvent.setup();
    let resolveTurn!: (value: unknown) => void;
    chatApi.sendKnowledgeChatMessageStream.mockReturnValue(
      new Promise((resolve) => {
        resolveTurn = resolve;
      }),
    );
    renderPanel();
    await waitForHistoryReady();

    const input = screen.getByRole('textbox', { name: '输入问题' });
    await user.type(input, '请解释这棵树的学习顺序。');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(screen.getByText('请解释这棵树的学习顺序。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();

    resolveTurn({
      answer: '建议先掌握基础模块，再进入实践节点。',
      usage: {
        inputTokens: 20,
        outputTokens: 12,
        cacheHitInputTokens: 10,
        cacheMissInputTokens: 10,
      },
      chargedCredits: 0.000036,
    });

    expect(
      await screen.findByText('建议先掌握基础模块，再进入实践节点。'),
    ).toBeInTheDocument();
    expect(screen.getByText('本次对话消耗 0.000036 积分')).toBeInTheDocument();
    expect(screen.queryByText(/本次测试消耗/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/沙箱剩余/u)).not.toBeInTheDocument();
  });

  it('renders text deltas before the stream completes and replaces them with the final answer', async () => {
    const user = userEvent.setup();
    let resolveTurn!: (value: unknown) => void;
    let emitDelta!: (delta: string) => void;
    chatApi.sendKnowledgeChatMessageStream.mockImplementation(
      (
        _libraryEntryId: string,
        _message: string,
        _clientTurnId: string,
        _csrfToken: string,
        onDelta: (delta: string) => void,
      ) => {
        emitDelta = onDelta;
        return new Promise((resolve) => {
          resolveTurn = resolve;
        });
      },
    );
    renderPanel();
    await waitForHistoryReady();

    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '先显示增量');
    await user.click(screen.getByRole('button', { name: '发送' }));
    emitDelta('流式片段');

    expect(await screen.findByText('流式片段')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();

    resolveTurn({
      answer: '最终完整答案。',
      usage: {
        inputTokens: 10,
        outputTokens: 8,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 10,
      },
      chargedCredits: 0.000026,
    });

    expect(await screen.findByText('最终完整答案。')).toBeInTheDocument();
    expect(screen.queryByText('流式片段')).not.toBeInTheDocument();
  });

  it('renders common Markdown in an assistant answer without executing raw HTML', async () => {
    const user = userEvent.setup();
    chatApi.sendKnowledgeChatMessageStream.mockResolvedValueOnce({
      answer: [
        '先完成 **前置节点**。',
        '',
        '- `local-node-agent` 已完成',
        '- 查阅 [官方文档](https://example.com/docs)',
        '',
        '```ts',
        'const ready = true;',
        '```',
        '',
        '<span data-testid="injected">不可执行</span>',
      ].join('\n'),
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 10,
      },
      chargedCredits: 0.00005,
    });
    renderPanel();
    await waitForHistoryReady();

    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '怎么开始？');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('前置节点', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('local-node-agent', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '官方文档' })).toHaveAttribute(
      'href',
      'https://example.com/docs',
    );
    expect(screen.getByText('const ready = true;', { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByTestId('injected')).not.toBeInTheDocument();
  });

  it('does not send blank input and shows safe errors without a destructive reset action', async () => {
    const user = userEvent.setup();
    chatApi.sendKnowledgeChatMessageStream.mockRejectedValueOnce(
      new Error('知识聊天服务暂时不可用。'),
    );
    renderPanel();
    await waitForHistoryReady();

    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(chatApi.sendKnowledgeChatMessageStream).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '网络错误测试');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('知识聊天服务暂时不可用。');

    expect(screen.queryByRole('button', { name: '重置对话' })).not.toBeInTheDocument();
  });

  it('shows the actionable error code and trace id for a server failure', async () => {
    const user = userEvent.setup();
    chatApi.sendKnowledgeChatMessageStream.mockRejectedValueOnce(
      new KnowledgeChatApiError(
        400,
        'knowledge_chat.message_invalid_characters',
        '消息包含无法处理的控制字符，请删除后重试。',
        'trace-chat-2',
      ),
    );
    renderPanel();
    await waitForHistoryReady();

    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '错误详情测试');
    await user.click(screen.getByRole('button', { name: '发送' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('消息包含无法处理的控制字符，请删除后重试。');
    expect(alert).toHaveTextContent('错误代码：knowledge_chat.message_invalid_characters');
    expect(alert).toHaveTextContent('诊断编号：trace-chat-2');
  });

  it('exposes a mobile-safe message area and a close action', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    expect(screen.getByTestId('knowledge-chat-messages')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('knowledge-chat-composer')).toHaveClass('pb-[env(safe-area-inset-bottom)]');
    await userEvent.setup().click(screen.getByRole('button', { name: '返回节点详情' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof KnowledgeChatPanel>> = {}) {
  return render(
    <KnowledgeChatPanel
      treeTitle="NestJS 学习树"
      libraryEntryId="entry-1"
      csrfToken="csrf-secret"
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

async function waitForHistoryReady(): Promise<void> {
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '输入问题' })).not.toBeDisabled(),
  );
}
