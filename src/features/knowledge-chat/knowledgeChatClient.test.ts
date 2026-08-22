import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KnowledgeChatApiError,
  resetKnowledgeChat,
  sendKnowledgeChatMessage,
} from './knowledgeChatClient';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('knowledgeChatClient', () => {
  it('sends a personal-library scoped message and parses sandbox usage', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answer: '这是基于当前技能树的回答。',
        usage: {
          inputTokens: 120,
          outputTokens: 48,
          cacheHitInputTokens: 80,
          cacheMissInputTokens: 40,
        },
        chargedCredits: 0.2,
        sandboxRemainingUnits: 98,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendKnowledgeChatMessage(
        'entry/id',
        '请解释当前节点。',
        'turn-123',
        'csrf-secret',
      ),
    ).resolves.toEqual({
      answer: '这是基于当前技能树的回答。',
      usage: {
        inputTokens: 120,
        outputTokens: 48,
        cacheHitInputTokens: 80,
        cacheMissInputTokens: 40,
      },
      chargedCredits: 0.2,
      sandboxRemainingUnits: 98,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/messages',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-secret',
        },
        body: JSON.stringify({
          message: '请解释当前节点。',
          clientTurnId: 'turn-123',
        }),
      },
    );
  });

  it('resets only the selected personal-library chat session', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resetKnowledgeChat('entry/id', 'csrf-secret')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/reset',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': 'csrf-secret',
        },
      },
    );
  });

  it('preserves the safe error envelope and rejects malformed success responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'knowledge_chat_login_required',
            message: '请先登录后使用知识聊天。',
            traceId: 'trace-chat-1',
          },
        },
        401,
      ),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answer: '',
        usage: {},
        chargedCredits: 0.2,
        sandboxRemainingUnits: 98,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await sendKnowledgeChatMessage(
      'entry-id',
      '你好',
      'turn-1',
      'csrf-secret',
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(KnowledgeChatApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'knowledge_chat_login_required',
      message: '请先登录后使用知识聊天。',
      traceId: 'trace-chat-1',
    });

    await expect(
      sendKnowledgeChatMessage('entry-id', '你好', 'turn-2', 'csrf-secret'),
    ).rejects.toMatchObject({
      status: 502,
      code: 'knowledge_chat_invalid_response',
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
