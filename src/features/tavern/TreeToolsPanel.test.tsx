import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TreeToolsPanel from './TreeToolsPanel';
import { detail } from './testFixtures';
import type { ConversationDetail } from './types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('connects an existing story to the chosen tree and can revoke tools without deleting messages', async () => {
  const updated = vi.fn();
  const requests: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/me/tree-library') return new Response(JSON.stringify({ entries: [
      { library_entry_id: 'entry-1', tree: { id: 'tree-1', topic: 'Python', difficulty_level: 'beginner', title: 'Python 学习', description: '', total_nodes: 2 }, completed_nodes: 0, progress_percent: 0 },
    ] }));
    const body = JSON.parse(init?.body as string); requests.push(body);
    return new Response(JSON.stringify({ ...detail, conversation: { ...detail.conversation, libraryEntryId: body.libraryEntryId, treeToolsEnabled: body.toolsEnabled }, graph: { ...detail.graph, revision: body.expectedRevision + 1 } }));
  }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function ConnectedStory() {
    const [current,setCurrent]=useState<ConversationDetail>(detail);
    return <TreeToolsPanel key={current.graph.revision} detail={current} csrfToken="csrf" accountId="account-1"
      onUpdated={saved=>{updated(saved);setCurrent(saved);}} onConflict={vi.fn()} />;
  }
  render(<QueryClientProvider client={queryClient}><ConnectedStory /></QueryClientProvider>);
  const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Python 学习' });
  await user.selectOptions(await screen.findByLabelText('关联技能树'), 'entry-1');
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
});
