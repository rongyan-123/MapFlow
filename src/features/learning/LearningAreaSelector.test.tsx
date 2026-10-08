import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LearningAreaSelector from './LearningAreaSelector';

const api = vi.hoisted(() => ({ fetchLearningAreas: vi.fn(), createLearningArea: vi.fn(), fetchPersonalLibrary: vi.fn() }));
vi.mock('../tavern/tavernClient', () => api);
vi.mock('../tree-library/treeLibraryClient', () => api);
const area = { areaId: 'map-1', libraryEntryId: 'map-1', title: 'Python 学习', available: true, createdAt: '2026-10-08T12:00:00Z' };
const callbacks = { onEnterArea: vi.fn(), onOpenMaps: vi.fn(), onOpenManager: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  api.fetchLearningAreas.mockResolvedValue([area]);
  api.fetchPersonalLibrary.mockResolvedValue({ entries: [
    { library_entry_id: 'map-1', tree: { title: 'Python 学习' } },
    { library_entry_id: 'map-2', tree: { title: 'Rust 学习' } },
  ] });
  api.createLearningArea.mockResolvedValue({ ...area, areaId: 'map-2', libraryEntryId: 'map-2', title: 'Rust 学习' });
});
afterEach(cleanup);
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <LearningAreaSelector accountId="account-1" csrfToken="csrf" {...callbacks} />
  </QueryClientProvider>);
}

it('shows a full selection page and opens an existing area without recreating it', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '进入 Python 学习' }));
  expect(callbacks.onEnterArea).toHaveBeenCalledWith(area);
  expect(api.createLearningArea).not.toHaveBeenCalled();
});

it('explicitly creates an area from an owned existing map and enters it without a model request', async () => {
  const user = userEvent.setup(); mount();
  await screen.findByRole('option', { name: 'Rust 学习' });
  await user.selectOptions(await screen.findByLabelText('选择个人地图'), 'map-2');
  await user.click(screen.getByRole('button', { name: '新建学习区' }));
  expect(api.createLearningArea).toHaveBeenCalledWith('map-2', 'csrf');
  expect(callbacks.onEnterArea).toHaveBeenCalledWith(expect.objectContaining({ areaId: 'map-2' }));
});

it('searches area titles without switching the active conversation or creating an area', async () => {
  const user = userEvent.setup(); mount();
  await screen.findByRole('button', { name: '进入 Python 学习' });
  await user.type(screen.getByRole('searchbox', { name: '搜索学习区' }), '不存在');
  expect(screen.queryByRole('button', { name: '进入 Python 学习' })).not.toBeInTheDocument();
  expect(callbacks.onEnterArea).not.toHaveBeenCalled();
  expect(api.createLearningArea).not.toHaveBeenCalled();
});

it('keeps unavailable areas as history entries and makes the unavailable map explicit', async () => {
  api.fetchLearningAreas.mockResolvedValue([{ ...area, available: false }]);
  const user = userEvent.setup(); mount();
  expect(await screen.findByText('地图不可用，仍可查看历史')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '查看 Python 学习 历史' }));
  expect(callbacks.onEnterArea).toHaveBeenCalledWith(expect.objectContaining({ available: false }));
});

it('keeps the user on the selection page when membership creation fails', async () => {
  api.createLearningArea.mockRejectedValue(new Error('请求暂时失败，请稍后重试。'));
  const user = userEvent.setup(); mount();
  await screen.findByRole('option', { name: 'Rust 学习' });
  await user.selectOptions(await screen.findByLabelText('选择个人地图'), 'map-2');
  await user.click(screen.getByRole('button', { name: '新建学习区' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('请求暂时失败');
  expect(callbacks.onEnterArea).not.toHaveBeenCalled();
  expect(screen.getByLabelText('选择个人地图')).toHaveValue('map-2');
});

it('guides an empty account to personal maps and exposes the management assistant separately', async () => {
  api.fetchLearningAreas.mockResolvedValue([]); api.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '前往我的地图' }));
  expect(callbacks.onOpenMaps).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '打开管理助手' }));
  expect(callbacks.onOpenManager).toHaveBeenCalledTimes(1);
  expect(api.createLearningArea).not.toHaveBeenCalled();
});
