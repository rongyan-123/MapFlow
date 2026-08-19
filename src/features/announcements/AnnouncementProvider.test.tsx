import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdentitySession } from '../identity/types';
import { AnnouncementProvider } from './AnnouncementProvider';
import type { Announcement } from './announcementsClient';

const identityMock = vi.hoisted(() => ({
  session: null as IdentitySession | null,
}));

vi.mock('../identity/IdentityContext', () => ({
  useIdentity: () => ({ session: identityMock.session }),
}));

const firstAccount: IdentitySession = {
  account: {
    playerId: 'p1',
    username: 'firstuser',
    status: 'active',
    isAdmin: false,
  },
  csrfToken: 'csrf',
};

const secondAccount: IdentitySession = {
  account: {
    playerId: 'p2',
    username: 'seconduser',
    status: 'active',
    isAdmin: false,
  },
  csrfToken: 'csrf-2',
};

const twoUnread: Announcement[] = [
  {
    announcementId: 'ann-1',
    title: '第一条公告',
    content: '内容一',
    createdAt: '2026-08-19T00:00:00Z',
    isRead: false,
  },
  {
    announcementId: 'ann-2',
    title: '第二条公告',
    content: '内容二',
    createdAt: '2026-08-19T00:00:00Z',
    isRead: false,
  },
];

let unreadIds: string[] = [];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 模拟服务端：GET 返回当前未读列表，POST 标记已读后从未读列表移除。 */
function stubAnnouncementsApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const readMatch = url.match(/^\/api\/announcements\/([^/]+)\/read$/);
      if (init?.method === 'POST' && readMatch) {
        unreadIds = unreadIds.filter((id) => id !== readMatch[1]);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === '/api/announcements') {
        return Promise.resolve(jsonResponse(200, { items: twoUnread, unreadIds }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

beforeEach(() => {
  identityMock.session = null;
  unreadIds = twoUnread.map((item) => item.announcementId);
  stubAnnouncementsApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnnouncementProvider', () => {
  it('逐条「知道了」标记已读，全部读完自动关闭', async () => {
    const user = userEvent.setup();
    identityMock.session = firstAccount;
    renderProvider();

    expect(await screen.findByText('第一条公告')).toBeInTheDocument();
    expect(screen.getByText('公告 · 剩余 2 条未读')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '知道了' }));
    await waitFor(() => {
      const post = vi
        .mocked(fetch)
        .mock.calls.find(([, init]) => init?.method === 'POST');
      expect(post?.[0]).toBe('/api/announcements/ann-1/read');
      expect(post?.[1]).toMatchObject({
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }),
      });
    });

    expect(await screen.findByText('第二条公告')).toBeInTheDocument();
    expect(screen.getByText('公告 · 剩余 1 条未读')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '知道了' }));
    await waitFor(() => {
      const posts = vi
        .mocked(fetch)
        .mock.calls.filter(([, init]) => init?.method === 'POST');
      expect(posts).toHaveLength(2);
      expect(posts[1]?.[0]).toBe('/api/announcements/ann-2/read');
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('手动关闭（点遮罩）后同会话不再自动弹出', async () => {
    identityMock.session = firstAccount;
    const { rerender } = renderProvider();

    expect(await screen.findByText('第一条公告')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // 同会话内的后续渲染（如路由切换）也不会再次弹出，也不会发起标记已读。
    rerender();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
  });

  it('没有未读公告时不渲染弹窗', async () => {
    identityMock.session = firstAccount;
    unreadIds = [];
    renderProvider();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('会话切换（换账号）后重置手动关闭状态并重新弹出', async () => {
    identityMock.session = null;
    const { rerender } = renderProvider();

    // 未登录：查询禁用，不弹窗也不请求。
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    // 账号 A 登录：弹出未读，手动关闭。
    identityMock.session = firstAccount;
    rerender();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(await screen.findByText('第一条公告')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // 切换账号 B：手动关闭标记被重置，未读公告再次弹出。
    identityMock.session = secondAccount;
    rerender();
    expect(await screen.findByText('第一条公告')).toBeInTheDocument();
    expect(screen.getByText('公告 · 剩余 2 条未读')).toBeInTheDocument();
  });
});

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // 每次调用必须创建新的元素树：传同一元素引用时 React 会因 props 未变
  // bail out 跳过重新渲染，rerender 将拿不到最新的 identityMock.session。
  const createUi = () => (
    <QueryClientProvider client={queryClient}>
      <AnnouncementProvider>
        <div>app content</div>
      </AnnouncementProvider>
    </QueryClientProvider>
  );
  const utils = render(createUi());
  return { ...utils, rerender: () => utils.rerender(createUi()) };
}
