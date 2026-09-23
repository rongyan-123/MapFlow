import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TreePublicationDialog from './TreePublicationDialog';

afterEach(() => vi.unstubAllGlobals());

describe('TreePublicationDialog', () => {
  it('shows the exact disclosure before publishing and executes with the token', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'request-1' });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ source_revision: 3, public_tree_id: null, is_public: false }))
      .mockResolvedValueOnce(json({
        action: 'publish', title: '事务树', publisher_display_name: 'alice', source_revision: 3,
        node_count: 12, edge_count: 11, block_count: 4,
        excludes: ['节点笔记', '学习进度'], expected_public_tree_id: null,
        confirmation_token: 'signed-token', expires_in_seconds: 600,
      }))
      .mockResolvedValueOnce(json({
        action: 'publish', publication_id: 'p1', public_tree_id: 't1',
        source_revision: 3, state: 'active',
      }));
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TreePublicationDialog libraryEntryId="e1" title="事务树" csrfToken="csrf" onClose={onClose} />
      </QueryClientProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: '预览公开内容' }));
    expect(await screen.findByText(/发布者：/)).toHaveTextContent('alice');
    expect(screen.getByText(/不会公开：/)).toHaveTextContent('节点笔记、学习进度');
    await userEvent.click(screen.getByRole('button', { name: '确认公开到公共池' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock.mock.calls[2][0]).toBe('/api/me/tree-library/e1/publication');
    expect(JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body))).toEqual({
      confirmationToken: 'signed-token',
    });
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
