import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LearningMapPanel from './LearningMapPanel';

const api = vi.hoisted(() => ({ fetchPersonalTree: vi.fn(), setNodeCompletion: vi.fn(), setNodeProgress: vi.fn(),
  fetchNodeNote: vi.fn(), saveNodeNote: vi.fn(), deleteNodeNote: vi.fn() }));
vi.mock('../tree-library/treeLibraryClient', async original => ({ ...await original<typeof import('../tree-library/treeLibraryClient')>(), ...api }));
vi.mock('../skill-tree/SkillTreeCanvas', () => ({ default: ({ onSelectNode }: { onSelectNode: (id: string) => void }) =>
  <button onClick={() => onSelectNode('node-1')}>查看节点 事务</button> }));

const node = { id: 'node-1', tree_id: 'tree-1', title: '事务', description: '理解事务边界', icon: 'box', category: 'foundation',
  difficulty: 1, estimated_minutes: 30, depth_level: 0, position_x: 0, position_y: 0, order_in_level: 0, learning_objectives: null,
  key_concepts: null, recommended_depth: 'Understand' as const, depth_rationale: '理解边界', observable_evidence: null };
const tree = { view_mode: 'personal', library_entry_id: 'map-1', graph: { tree: { id: 'tree-1', topic: '数据库', title: '数据库地图',
  description: '事务学习', difficulty_level: 'intermediate', total_nodes: 1 }, nodes: [node], edges: [] }, completed_node_ids: [], node_progress: [] };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); api.fetchPersonalTree.mockResolvedValue(tree);
  api.setNodeProgress.mockResolvedValue(undefined); api.setNodeCompletion.mockResolvedValue(undefined);
  api.fetchNodeNote.mockResolvedValue({ node_id: 'node-1', markdown: '', has_note: false, version: 0, updated_at: null });
  api.saveNodeNote.mockImplementation(async (_entry, _node, markdown) => ({ node_id: 'node-1', markdown, has_note: true, version: 1, updated_at: null }));
});
afterEach(cleanup);
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const close = vi.fn(); const reference = vi.fn();
  return { close, reference, client, ...render(<QueryClientProvider client={client}>
    <LearningMapPanel accountId="account-1" libraryEntryId="map-1" csrfToken="csrf" onClose={close} onReference={reference} />
  </QueryClientProvider>) };
}
it('stages a selected node explicitly and restores that selection after remount', async () => {
  const user = userEvent.setup(); const first = mount();
  await user.click(await screen.findByRole('button', { name: '查看节点 事务' }));
  await user.click(screen.getByRole('button', { name: '加入聊天参考' }));
  expect(first.reference).toHaveBeenCalledWith({ id: 'node-1', title: '事务' });
  first.unmount(); const reopened = mount(first.client);
  expect(await screen.findByRole('heading', { name: '事务' })).toBeInTheDocument();
  expect(reopened.reference).not.toHaveBeenCalled();
  expect(api.setNodeProgress).not.toHaveBeenCalled();
});
it('saves only the selected owned node progress and note through existing endpoints', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '查看节点 事务' }));
  await user.click(screen.getByRole('button', { name: '填写详细进度' }));
  const progress = screen.getByRole('spinbutton', { name: '节点完成百分比' });
  await user.clear(progress); await user.type(progress, '35'); await user.click(screen.getByRole('button', { name: '保存详细进度' }));
  await waitFor(() => expect(api.setNodeProgress).toHaveBeenCalledWith('map-1', 'node-1', 35, 'csrf'));
  await user.click(screen.getByRole('button', { name: '写下我的总结' }));
  await user.type(await screen.findByRole('textbox', { name: 'Markdown 笔记' }), '事务需要原子性');
  await user.click(screen.getByRole('button', { name: '保存笔记' }));
  await waitFor(() => expect(api.saveNodeNote).toHaveBeenCalledWith('map-1', 'node-1', '事务需要原子性', 0, 'csrf'));
});
