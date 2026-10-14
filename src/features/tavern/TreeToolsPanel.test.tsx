import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TreeToolsPanel from './TreeToolsPanel';
import { detail } from '../../test/conversations';
import type { ConversationDetail } from '../../domains/conversations/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('toggles only the current learning map and can revoke tools without deleting messages', async () => {
  const updated = vi.fn();
  const requests: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/me/tree-library') return new Response(JSON.stringify({ entries: [
      { library_entry_id: 'entry-1', tree: { id: 'tree-1', topic: 'Python', difficulty_level: 'beginner', title: 'Python 学习', description: '', total_nodes: 2 }, completed_nodes: 0, progress_percent: 0 },
    ] }));
    const body = JSON.parse(init?.body as string); requests.push(body);
    return new Response(JSON.stringify({ ...detail, conversation: { ...detail.conversation, scene: 'learning', learningAreaId: 'entry-1', libraryEntryId: body.libraryEntryId, treeToolsEnabled: body.toolsEnabled }, graph: { ...detail.graph, revision: body.expectedRevision + 1 } }));
  }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function ConnectedStory() {
    const [current,setCurrent]=useState<ConversationDetail>({ ...detail, conversation: { ...detail.conversation,
      scene: 'learning', learningAreaId: 'entry-1', libraryEntryId: 'entry-1', treeToolsEnabled: false } });
    return <TreeToolsPanel key={current.graph.revision} detail={current} csrfToken="csrf" accountId="account-1"
      onUpdated={saved=>{updated(saved);setCurrent(saved);}} onConflict={vi.fn()} />;
  }
  render(<QueryClientProvider client={queryClient}><ConnectedStory /></QueryClientProvider>);
  const user = userEvent.setup();
  expect(screen.queryByLabelText('关联技能树')).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: '允许使用技能树工具' }));
  await user.click(screen.getByRole('button', { name: '保存工具设置' }));
  await waitFor(() => expect(updated).toHaveBeenCalled());
  expect(requests).toEqual([{ expectedRevision: detail.graph.revision, libraryEntryId: 'entry-1', toolsEnabled: true }]);
  expect(updated.mock.calls[0][0].graph.messages).toEqual(detail.graph.messages);
  await user.click(screen.getByRole('checkbox', { name: '允许使用技能树工具' }));
  await user.click(screen.getByRole('button', { name: '保存工具设置' }));
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(2));
  expect(requests[1]).toEqual({expectedRevision:detail.graph.revision+1,libraryEntryId:'entry-1',toolsEnabled:false});
  expect(updated.mock.calls[1][0].graph.messages).toEqual(detail.graph.messages);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/me/tree-library')).toBe(false);
});

it('does not offer personal map tools or read the personal library in an independent story', () => {
  vi.stubGlobal('fetch', vi.fn());
  render(<QueryClientProvider client={new QueryClient()}><TreeToolsPanel detail={detail} accountId="account-1" csrfToken="csrf"
    onUpdated={vi.fn()} onConflict={vi.fn()} /></QueryClientProvider>);
  expect(screen.queryByRole('checkbox', { name: '允许使用技能树工具' })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
