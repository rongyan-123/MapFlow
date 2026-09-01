import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchKnowledgeChatHistory,
  KnowledgeChatApiError,
  resetKnowledgeChat,
  resolveKnowledgeChatApproval,
  sendKnowledgeChatMessage,
  sendKnowledgeChatMessageStream,
} from './knowledgeChatClient';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('knowledgeChatClient', () => {
  it('sends a long multiline user message without a client character cap', async () => {
    const message = `开头说明\n${'这是用户的长篇学习背景。\n'.repeat(1_001)}结尾问题`;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answer: '已收到长篇背景。',
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          cacheHitInputTokens: 0,
          cacheMissInputTokens: 10,
        },
        chargedCredits: 0.01,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendKnowledgeChatMessage('entry/id', message, 'turn-long-message', 'csrf-secret'),
    ).resolves.toMatchObject({ answer: '已收到长篇背景。' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/messages',
      expect.objectContaining({
        body: JSON.stringify({ message, clientTurnId: 'turn-long-message' }),
      }),
    );
  });

  it('loads the complete persisted history for one personal tree', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        messages: [
          { id: 'turn-1-user', role: 'user', content: '什么是所有权？' },
          { id: 'turn-1-assistant', role: 'assistant', content: '所有权决定资源由谁负责。' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKnowledgeChatHistory('entry/id')).resolves.toEqual({
      messages: [
        { id: 'turn-1-user', role: 'user', content: '什么是所有权？' },
        { id: 'turn-1-assistant', role: 'assistant', content: '所有权决定资源由谁负责。' },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/history',
      {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('parses fragmented SSE chat deltas and uses the final complete event as authority', async () => {
    const chunks = [
      'event: started\ndata: {}\n\nevent: del',
      'ta\ndata: {"delta":"**前"}\n\nevent: status\ndata: {"message":"正在搜索"}\n\n',
      'event: delta\ndata: {"delta":"置**。"}\n\nevent: complete\ndata: ',
      JSON.stringify({
        answer: '**前置**。',
        usage: {
          inputTokens: 20,
          outputTokens: 8,
          cacheHitInputTokens: 12,
          cacheMissInputTokens: 8,
        },
        chargedCredits: 0.2,
      }) + '\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    await expect(
      sendKnowledgeChatMessageStream(
        'entry/id',
        '请解释前置节点。',
        'turn-stream',
        'csrf-secret',
        delta => deltas.push(delta),
      ),
    ).resolves.toEqual({
      answer: '**前置**。',
      usage: {
        inputTokens: 20,
        outputTokens: 8,
        cacheHitInputTokens: 12,
        cacheMissInputTokens: 8,
      },
      chargedCredits: 0.2,
    });

    expect(deltas).toEqual(['**前', '置**。']);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/messages/stream',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-secret',
        },
        body: JSON.stringify({
          message: '请解释前置节点。',
          clientTurnId: 'turn-stream',
        }),
      },
    );
  });

  it('preserves the status and diagnostic fields from a streamed error event', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        'event: error\ndata: ' + JSON.stringify({
          httpStatus: 429,
          code: 'knowledge_chat.rate_limited',
          message: '知识聊天请求过于频繁，请稍后再试。',
          traceId: 'trace-rate-limit',
        }) + '\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendKnowledgeChatMessageStream(
        'entry/id',
        '触发限流',
        'turn-rate-limit',
        'csrf-secret',
        () => undefined,
      ),
    ).rejects.toMatchObject({
      status: 429,
      code: 'knowledge_chat.rate_limited',
      traceId: 'trace-rate-limit',
    });
  });

  it('pauses on a safe approval summary and posts the explicit decision', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'event: approval_required\ndata: ' + JSON.stringify({
            approvalRequestId: 'approval-1',
            toolName: 'personal_tree_mutation',
            action: '修改节点',
            target: '当前个人树',
            destructive: false,
          }) + '\n\n',
        ));
        controller.enqueue(new TextEncoder().encode(
          'event: complete\ndata: ' + JSON.stringify({
            answer: '已完成。',
            usage: { inputTokens: 2, outputTokens: 2, cacheHitInputTokens: 0, cacheMissInputTokens: 2 },
            chargedCredits: 0.01,
          }) + '\n\n',
        ));
        controller.close();
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(stream, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const approvals: string[] = [];
    await expect(sendKnowledgeChatMessageStream(
      'entry/id',
      '修改节点',
      'turn-approval',
      'csrf-secret',
      () => undefined,
      async (approval) => {
        approvals.push(approval.action);
        await resolveKnowledgeChatApproval(
          'entry/id',
          approval.approvalRequestId,
          'allowed-once',
          false,
          'csrf-secret',
        );
      },
    )).resolves.toMatchObject({ answer: '已完成。' });

    expect(approvals).toEqual(['修改节点']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/me/tree-library/entry%2Fid/knowledge-chat/approvals/approval-1',
      expect.objectContaining({
        body: JSON.stringify({ outcome: 'allowed-once', confirmDestructive: false }),
      }),
    );
  });

  it('sends a personal-library scoped message and parses formal credit usage', async () => {
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
