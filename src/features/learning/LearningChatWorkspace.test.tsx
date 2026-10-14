import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LearningChatWorkspace from './LearningChatWorkspace';

const api = vi.hoisted(() => ({ fetchLearningAreas: vi.fn(), createLearningArea: vi.fn(), fetchPersonalLibrary: vi.fn(), fetchPersonalTree: vi.fn() }));
const referenceCallbacks = vi.hoisted(() => [] as Array<() => void>);
vi.mock('../identity/IdentityContext',()=>({useIdentity:()=>({session:{account:{playerId:'account-1'},csrfToken:'csrf'}})}));
it('opens actual learning chat through the shared native funding controls',async()=>{
  mount();await userEvent.setup().click(await screen.findByRole('button',{name:'进入 Python'}));
  expect(await screen.findByLabelText('资金通路')).toBeInTheDocument();
});
vi.mock('../../api/tavernClient', () => api);
vi.mock('../../api/treeLibraryClient', () => api);
vi.mock('../tavern/TavernPage', () => ({ default: ({ treeContext, management, onShowMap, onOpenCanvas, onNodeReferenceConsumed }: { treeContext?: { title: string; nodeId?: string }; management?: boolean; onShowMap?: () => void; onOpenCanvas?: () => void; onNodeReferenceConsumed?: () => void }) => {
  if (onNodeReferenceConsumed) referenceCallbacks.push(onNodeReferenceConsumed);
  return <section aria-label="当前学习对话"><p>{management ? '管理助手' : treeContext?.title} 对话</p>{treeContext?.nodeId && <p>待发送参考：{treeContext.nodeId}</p>}{onShowMap && <button onClick={onShowMap}>查看地图</button>}<button onClick={onOpenCanvas}>打开教学画布</button></section>;
} }));
vi.mock('../skill-tree/SkillTreeCanvas', () => ({ default: () => <div aria-label="学习地图画面" /> }));
const python = { areaId: 'map-1', libraryEntryId: 'map-1', title: 'Python', available: true, createdAt: '2026-10-08T00:00:00Z' };
const rust = { ...python, areaId: 'map-2', libraryEntryId: 'map-2', title: 'Rust' };
const callbacks = { onOpenMaps: vi.fn(), onOpenManager: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); referenceCallbacks.length = 0;
  api.fetchLearningAreas.mockResolvedValue([python, rust]);
  api.fetchPersonalLibrary.mockResolvedValue({ entries: [] });
  api.fetchPersonalTree.mockResolvedValue({ library_entry_id: 'map-1', graph: { tree: { id: 'tree-1', title: 'Python', revision: 1 }, nodes: [], edges: [] }, completed_node_ids: [] });
});
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });
function mount(requestedAreaId?: string | null, accountId = 'account-1') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <LearningChatWorkspace accountId={accountId} csrfToken="csrf" requestedAreaId={requestedAreaId} {...callbacks} />
  </QueryClientProvider>);
}

it('begins with the complete selection layer and enters without loading a map', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '进入 Python' }));
  expect(await screen.findByRole('region', { name: '当前学习对话' })).toHaveTextContent('Python 对话');
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
  expect(localStorage.getItem('mapflow.learning.area.v1.account-1')).toBe('map-1');
});

it('keeps navigation reachable on the mobile selection layer while the main header is hidden', async () => {
  const originalWidth = window.innerWidth;
  window.innerWidth = 390;
  try {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LearningChatWorkspace accountId="account-1" csrfToken="csrf" {...callbacks}
        mobileHeaderActions={<><button>公共书库</button><button>我的额度</button><button>退出登录</button></>} />
    </QueryClientProvider>);
    await screen.findByRole('region', { name: '学习区选择' });
    await user.click(screen.getByRole('button', { name: '操作' }));
    expect(screen.getByRole('button', { name: '公共书库' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的额度' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(api.fetchPersonalTree).not.toHaveBeenCalled();
  } finally { window.innerWidth = originalWidth; }
});

it('restores only an owned remembered area and gives an explicit target priority', async () => {
  localStorage.setItem('mapflow.learning.area.v1.account-1', 'map-1');
  mount('map-2');
  expect(await screen.findByRole('region', { name: '当前学习对话' })).toHaveTextContent('Rust 对话');
  expect(screen.queryByText('Python 对话')).not.toBeInTheDocument();
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
});

it('returns invalid remembered membership to the selection layer instead of reading another map', async () => {
  localStorage.setItem('mapflow.learning.area.v1.account-1', 'foreign-area');
  mount();
  await screen.findByRole('region', { name: '学习区选择' });
  expect(screen.queryByRole('region', { name: '当前学习对话' })).not.toBeInTheDocument();
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
  await waitFor(() => expect(localStorage.getItem('mapflow.learning.area.v1.account-1')).toBeNull());
});

it('opens the map on the right only on demand and offers a return to selection', async () => {
  const user = userEvent.setup(); mount('map-1');
  await user.click(await screen.findByRole('button', { name: '查看地图' }));
  expect(await screen.findByLabelText('学习地图画面')).toBeInTheDocument();
  expect(api.fetchPersonalTree).toHaveBeenCalledWith('map-1');
  const workspace = screen.getByRole('region', { name: '学习区' });
  expect(workspace.children[0]).toHaveAttribute('data-learning-chat', 'true');
  expect(workspace.lastElementChild).toHaveAttribute('data-learning-map', 'true');
  await user.click(screen.getByRole('button', { name: '返回学习区列表' }));
  expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
});

it('explains an unavailable map at selection and preserves a deliberate history entry', async () => {
  api.fetchLearningAreas.mockResolvedValue([{ ...python, available: false }]);
  const user = userEvent.setup();
  mount('map-1');
  expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent('地图暂不可用');
  expect(screen.queryByRole('region', { name: '当前学习对话' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '查看 Python 历史' }));
  expect(await screen.findByRole('region', { name: '当前学习对话' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '查看地图' })).not.toBeInTheDocument();
  expect(await screen.findByText('地图不可用，当前仅查看历史。')).toBeInTheDocument();
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
});

it('shows the current area label and manages areas from the switcher without loading a map', async () => {
  const user = userEvent.setup(); mount('map-1');
  const switcher = await screen.findByRole('combobox', { name: '切换学习区' });
  expect(screen.getByText('学习区：')).toBeInTheDocument();
  await user.selectOptions(switcher, 'manage');
  expect(await screen.findByRole('region', { name: '学习区选择' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '打开管理助手' }));
  expect(callbacks.onOpenManager).toHaveBeenCalledOnce();
  expect(screen.queryByRole('region', { name: '学习区管理助手' })).not.toBeInTheDocument();
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
});

it('opens the global assistant from selection without loading a map', async () => {
  const user = userEvent.setup(); mount();
  await user.click(await screen.findByRole('button', { name: '打开管理助手' }));
  expect(callbacks.onOpenManager).toHaveBeenCalledOnce();
  expect(screen.queryByRole('region', { name: '学习区管理助手' })).not.toBeInTheDocument();
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
});

it('preserves the embedded manager for callers without the global navigation callback', async () => {
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <LearningChatWorkspace accountId="account-1" csrfToken="csrf" onOpenMaps={callbacks.onOpenMaps} />
  </QueryClientProvider>);
  await user.click(await screen.findByRole('button', { name: '打开管理助手' }));
  expect(await screen.findByRole('region', { name: '学习区管理助手' })).toHaveTextContent('管理助手 对话');
  expect(api.fetchPersonalTree).not.toHaveBeenCalled();
});

it('releases the heavy map renderer when the user opens the teaching canvas', async () => {
  const user = userEvent.setup(); mount('map-1');
  await user.click(await screen.findByRole('button', { name: '查看地图' }));
  await screen.findByLabelText('学习地图画面');
  await user.click(screen.getByRole('button', { name: '打开教学画布' }));
  expect(screen.queryByLabelText('学习地图画面')).not.toBeInTheDocument();
});

it('does not consume another area reference when an earlier background reply finishes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (area: string, node: string) => <QueryClientProvider client={client}><LearningChatWorkspace accountId="account-1" csrfToken="csrf"
    requestedAreaId={area} requestedNode={{ id: node, title: node }} {...callbacks} /></QueryClientProvider>;
  window.history.replaceState({}, '', '/learning?area=map-1&node=node-1&title=node-1');
  const mounted = render(view('map-1', 'node-1'));
  await screen.findByText('待发送参考：node-1');
  const finishOriginalReference = referenceCallbacks[referenceCallbacks.length - 1];
  window.history.replaceState({}, '', '/learning?area=map-2&node=node-2&title=node-2');
  mounted.rerender(view('map-2', 'node-2'));
  await screen.findByText('待发送参考：node-2');
  act(() => finishOriginalReference());
  expect(screen.getByText('待发送参考：node-2')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('node')).toBe('node-2');
});
