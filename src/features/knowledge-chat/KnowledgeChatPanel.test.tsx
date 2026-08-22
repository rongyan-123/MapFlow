import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KnowledgeChatPanel from './KnowledgeChatPanel';

const chatApi = vi.hoisted(() => ({
  sendKnowledgeChatMessage: vi.fn(),
  resetKnowledgeChat: vi.fn(),
}));

vi.mock('./knowledgeChatClient', () => chatApi);

beforeEach(() => {
  chatApi.sendKnowledgeChatMessage.mockReset();
  chatApi.resetKnowledgeChat.mockReset();
  chatApi.resetKnowledgeChat.mockResolvedValue(undefined);
});

describe('KnowledgeChatPanel', () => {
  it('shows the user turn, disables duplicate sends, and renders a charged answer', async () => {
    const user = userEvent.setup();
    let resolveTurn!: (value: unknown) => void;
    chatApi.sendKnowledgeChatMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveTurn = resolve;
      }),
    );
    renderPanel();

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
      chargedCredits: 0.2,
      sandboxRemainingUnits: 98,
    });

    expect(
      await screen.findByText('建议先掌握基础模块，再进入实践节点。'),
    ).toBeInTheDocument();
    expect(screen.getByText('本次测试消耗 0.2 积分')).toBeInTheDocument();
    expect(screen.getByText('沙箱剩余 9.8 积分')).toBeInTheDocument();
  });

  it('does not send blank input, shows safe errors, and can reset the local conversation', async () => {
    const user = userEvent.setup();
    chatApi.sendKnowledgeChatMessage.mockRejectedValueOnce(
      new Error('知识聊天服务暂时不可用。'),
    );
    renderPanel();

    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(chatApi.sendKnowledgeChatMessage).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '网络错误测试');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('知识聊天服务暂时不可用。');

    chatApi.sendKnowledgeChatMessage.mockResolvedValueOnce({
      answer: '重新建立一轮对话。',
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 1,
      },
      chargedCredits: 0.2,
      sandboxRemainingUnits: 96,
    });
    await user.clear(screen.getByRole('textbox', { name: '输入问题' }));
    await user.type(screen.getByRole('textbox', { name: '输入问题' }), '再问一次');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByText('重新建立一轮对话。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重置对话' }));
    await waitFor(() => expect(chatApi.resetKnowledgeChat).toHaveBeenCalledWith('entry-1', 'csrf-secret'));
    expect(screen.queryByText('再问一次')).not.toBeInTheDocument();
    expect(screen.queryByText('重新建立一轮对话。')).not.toBeInTheDocument();
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
