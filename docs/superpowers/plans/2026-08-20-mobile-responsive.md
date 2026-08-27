# 手机端适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 MapFlow 教学系统在手机浏览器（<1024px）以「单栏视图栈 + 左上角抽屉」形态可用全部功能，PC（≥1024px）形态零变化。

**Architecture:** 一套代码两种形态。以 Tailwind `lg`（1024px）断点分支：PC 完全保持现有三栏布局（只加 `lg:` 前缀类，不改结构）；手机端新增 App 级状态 `mobileView: 'list' | 'graph' | 'detail'` 驱动单栏视图栈（列表页 → 图页 → 详情页，带返回），header 左侧按钮在 ☰（开抽屉）与 ←（返回）间切换，左上角抽屉收纳 PC header 的功能入口（视图切换/公告/意见反馈/账号操作），积分胶囊保留在手机 header 右侧。Dialog 宽度用 `min()` 自适应手机视口。jsdom 无法测断点，布局交互以 className 字符串断言 + 浏览器移动模拟验收。

**Tech Stack:** React 18 + Vite + Tailwind 3（默认断点，`max-lg:` 可用）+ @xyflow/react 12（触摸平移缩放原生支持）+ vitest/jsdom。不引入任何新依赖。

**Spec:** [docs/superpowers/specs/2026-08-20-mobile-responsive-design.md](../specs/2026-08-20-mobile-responsive-design.md)

## Global Constraints

1. **断点 lg（1024px）**：PC（≥1024px）形态与行为零变化。任何移动端 class 都必须配 `lg:` 前缀类还原 PC 形态。
2. **功能不减**：功能入口只能「移动」（手机隐藏后在抽屉/dialog 中找到），不得删除任何功能。
3. **不引入新依赖**：不用路由库、不用 CSS 框架外组件，全部手写 Tailwind class。
4. **触摸目标 ≥44px**：只在 `@media (max-width: 1023px)` 生效（index.css 追加），PC 不受影响。
5. **新增 App.test.tsx 测试必须复用既有 hoisted mock 基础设施**（identityApi/treeApi/generationApi/adminApi/legacyApi/mock XYFlow/mock TreeGenerationDialog + `renderApp()`），不得新建重复 mock。App.test.tsx 新测试引用 `authenticated`/`adminAccount`/`nestjsTree`/`agentTree`/`nestjsGraph`/`personalEntry` 等既有 fixture。
6. **jsdom 无真实 CSS**：布局断言只能查 className 字符串（`toContain('hidden')` 等），视觉效果靠浏览器验收。
7. **中文 commit message、中文 UI 文案**（与现有代码一致）。
8. **工作流**：SDD——implementer/reviewer 一律显式 `model=sonnet`，直接在 main 分支工作（既定工作流，同 2026-08-19 三功能）。
9. 每任务结束跑：相关测试文件 + `npm run typecheck`；全量 `npm test` 至少每两个任务一次。
10. 所有移动端新增交互必须可在 jsdom 中测出「状态 → 渲染」闭环，禁止只写样式不写测试。

---

### Task 1: mobileView 单栏视图栈（App.tsx + NodeDetailPanel）

**Files:**
- Modify: `src/App.tsx`（state、select 函数、onSelectNode、main 三栏容器、header 返回按钮）
- Modify: `src/features/skill-tree/NodeDetailPanel.tsx:37,62`（容器 class）
- Test: `src/App.test.tsx`（新增 describe「手机端视图栈」）

**Interfaces:**
- Produces: App state `mobileView: 'list' | 'graph' | 'detail'`（初值 `'list'`）；三个容器 data-testid：`mobile-list` / `mobile-graph` / `mobile-detail`；返回按钮 aria-label「返回上一级」（仅 `mobileView !== 'list'` 渲染，带 `lg:hidden`）；选树函数进入 `'graph'`、节点选择进入 `'detail'`、`AdminPanel onBack` 与账号切换重置 `'list'`。
- T2 依赖：header 左侧容器改为 `<div className="flex min-w-0 items-center gap-2">` 包住标题块（返回按钮插在标题前），T2 在此容器内再加 ☰ 按钮。

- [ ] **Step 1: 写失败测试**

在 `src/App.test.tsx` 的 `describe('管理面板入口', ...)`（约 613 行）之后、`function renderApp()`（615 行）之前插入：

```tsx
describe('手机端视图栈', () => {
  it('初始显示列表页：列表可见、图与详情隐藏、无返回按钮', async () => {
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-graph').className).toContain('hidden');
    expect(screen.getByTestId('mobile-detail').className).toContain('hidden');
    expect(
      screen.queryByRole('button', { name: '返回上一级' }),
    ).not.toBeInTheDocument();
  });

  it('点树项进入图页：图可见、列表隐藏、返回按钮出现', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-list').className).toContain('hidden');
    expect(screen.getByRole('button', { name: '返回上一级' })).toBeInTheDocument();
  });

  it('点节点进入详情页，返回按钮先回图页再回列表', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      await screen.findByRole('button', { name: '查看 NestJS 完整学习树' }),
    );
    await user.click(
      await screen.findByRole('button', { name: '查看节点 基础节点' }),
    );
    expect(screen.getByTestId('mobile-detail').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-graph').className).toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-graph').className).not.toContain('hidden');
    expect(screen.getByTestId('mobile-detail').className).toContain('hidden');

    await user.click(screen.getByRole('button', { name: '返回上一级' }));
    expect(screen.getByTestId('mobile-list').className).not.toContain('hidden');
    expect(
      screen.queryByRole('button', { name: '返回上一级' }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/App.test.tsx -t '手机端视图栈'`
Expected: 3 个 FAIL——`getByTestId('mobile-list')` 找不到元素（testid 不存在）。

- [ ] **Step 3: 实现 mobileView 状态与三栏响应式容器**

`src/App.tsx`：

3.1 在 `const [generationSessionId, setGenerationSessionId] = useState...`（47-49 行）之后加 state：

```tsx
const [mobileView, setMobileView] = useState<'list' | 'graph' | 'detail'>('list');
```

3.2 账号切换重置 effect（134-138 行）追加 `setMobileView('list');`：

```tsx
useEffect(() => {
  setSelectedLibraryEntryId(null);
  setSelectedNodeId(null);
  setCompletion(null);
  setMobileView('list');
}, [accountPlayerId]);
```

3.3 `selectPublicTree`（237-241 行）与 `selectPersonalTree`（242-246 行）各追加一行 `setMobileView('graph');`。

3.4 AdminPanel onBack（292-295 行）：

```tsx
<AdminPanel
  onBack={() => {
    setView('personal');
    setMobileView('list');
  }}
  csrfToken={session.csrfToken}
/>
```

3.5 `onSelectNode`（470 行）：

```tsx
onSelectNode={(nodeId) => {
  setSelectedNodeId(nodeId);
  setMobileView('detail');
}}
```

3.6 main 容器（377 行）加纵向形态：`className="flex min-h-0 flex-1"` → `className="flex min-h-0 flex-1 flex-col lg:flex-row"`。

3.7 列表 aside（378 行）替换为：

```tsx
<aside
  data-testid="mobile-list"
  className={`${
    mobileView === 'list' ? 'flex' : 'hidden'
  } w-full min-h-0 flex-1 flex-col overflow-y-auto border-b border-slate-800 bg-slate-950/95 p-3 lg:flex lg:w-64 lg:flex-none lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r`}
>
```

3.8 图 section（464 行）替换为：

```tsx
<section
  data-testid="mobile-graph"
  className={`${mobileView === 'graph' ? 'block' : 'hidden'} relative min-w-0 flex-1 lg:block`}
>
```

3.9 详情区（487-504 行，`{snapshot ? ... : ...}` 整段）替换为：

```tsx
{snapshot ? (
  <div
    data-testid="mobile-detail"
    className={`${
      mobileView === 'detail' ? 'flex' : 'hidden'
    } min-h-0 flex-1 flex-col lg:flex lg:w-80 lg:flex-none`}
  >
    <NodeDetailPanel
      snapshot={snapshot}
      displayMode={displayMode}
      selectedNodeId={selectedNodeId}
      completionPending={completionMutation.isPending}
      onSetCompleted={
        view === 'personal'
          ? (nodeId, completed) =>
              completionMutation.mutate({ nodeId, completed })
          : undefined
      }
    />
  </div>
) : (
  <aside
    data-testid="mobile-detail"
    className={`${
      mobileView === 'detail' ? 'flex' : 'hidden'
    } w-full min-h-0 flex-1 flex-col items-center justify-center border-t border-slate-800 bg-slate-950/95 p-6 text-center text-sm text-slate-600 lg:flex lg:w-80 lg:flex-none lg:border-l lg:border-t-0`}
  >
    选择并加载技能树后，可在这里查看节点详情。
  </aside>
)}
```

3.10 header（330 行）：左侧标题块（331-340 行）包一层 flex 容器并在标题前插返回按钮：

```tsx
<div className="flex min-w-0 items-center gap-2">
  {mobileView !== 'list' && (
    <button
      type="button"
      aria-label="返回上一级"
      onClick={() => setMobileView(mobileView === 'detail' ? 'graph' : 'list')}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 lg:hidden"
    >
      ←
    </button>
  )}
  <div className="min-w-0">
    <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
      {activeTitle}
    </h1>
    <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
      {view === 'public'
        ? '公共示例树 · 全亮预览，不代表你的学习进度'
        : '我的学习树 · 进度仅保存在当前账号'}
    </p>
  </div>
</div>
```

3.11 `src/features/skill-tree/NodeDetailPanel.tsx` 两个 aside 容器改响应式（手机全宽 + 顶部边线，PC 还原 80 宽 + 左边线）：

- 37 行：`className="flex w-80 shrink-0 items-center justify-center border-l border-slate-800 bg-slate-950/95 p-6"` → `className="flex w-full shrink-0 items-center justify-center border-t border-slate-800 bg-slate-950/95 p-6 lg:w-80 lg:border-l lg:border-t-0"`
- 62 行：`className="w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-950/95 p-5"` → `className="w-full shrink-0 overflow-y-auto border-t border-slate-800 bg-slate-950/95 p-5 lg:w-80 lg:border-l lg:border-t-0"`

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/App.test.tsx -t '手机端视图栈'`
Expected: 3 个 PASS。

- [ ] **Step 5: 回归 App 既有测试 + typecheck**

Run: `npx vitest run src/App.test.tsx && npm run typecheck`
Expected: 全部 PASS（既有测试只查内容/角色，class 变化不影响；typecheck 无错误）。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/features/skill-tree/NodeDetailPanel.tsx src/App.test.tsx
git commit -m "feat: 手机端单栏视图栈（列表/图/详情 + 返回按钮）"
```

---

### Task 2: 手机 header + 左上角抽屉 + 抽屉接线

**Files:**
- Create: `src/features/navigation/MobileDrawer.tsx`
- Create: `src/features/feedback/FeedbackDialog.tsx`（自 FeedbackButton 拆出 dialog）
- Modify: `src/features/feedback/FeedbackButton.tsx`（改用 FeedbackDialog）
- Modify: `src/App.tsx`（header 手机版 + 抽屉内容 + 接线）
- Test: `src/features/navigation/MobileDrawer.test.tsx`（新建）、`src/App.test.tsx`（新增 describe「手机端抽屉」）

**Interfaces:**
- Consumes: T1 的 `mobileView`、header 左侧 `<div className="flex min-w-0 items-center gap-2">` 容器、`mobileView === 'list'` 语义。
- Produces: `MobileDrawer({ open, onClose, children })`（组件，`fixed inset-0 z-50 lg:hidden`，Esc/遮罩关闭）；`FeedbackDialog({ onClose })`（对话框组件，内部管理 content/done/submit 状态）；App state `drawerOpen` / `announcementsOpen` / `feedbackOpen`；抽屉内「公告」「意见反馈」条目仅登录后渲染（与 PC 的 AnnouncementsButton/FeedbackButton 的 `if (!session) return null` 行为一致）。
- T3 依赖: FeedbackDialog 的容器 class 暂用 `max-w-md`（与 FeedbackButton 现状逐字一致），T3 统一改 `max-w-[min(28rem,calc(100vw-2rem))]`。

- [ ] **Step 1: 写失败测试**

1.1 新建 `src/features/navigation/MobileDrawer.test.tsx`：

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MobileDrawer from './MobileDrawer';

describe('MobileDrawer', () => {
  it('open 时渲染内容，按 Esc 关闭', () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer open onClose={onClose}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );
    expect(screen.getByRole('dialog', { name: '功能菜单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抽屉条目' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩关闭', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MobileDrawer open onClose={onClose}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );

    await user.click(screen.getByTestId('mobile-drawer-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close 时不渲染内容', () => {
    render(
      <MobileDrawer open={false} onClose={() => undefined}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

1.2 `src/App.test.tsx` 顶部 mock 基础设施加公告 client（放在 48 行 `vi.mock('./lib/api', ...)` 之后）：

```tsx
const announcementsApi = vi.hoisted(() => ({ getAnnouncements: vi.fn() }));

vi.mock('./features/announcements/announcementsClient', () => announcementsApi);
```

`beforeEach`（171 行起）里加一行（放在 `legacyApi.fetchLearningTree.mockReset()` 附近）：

```tsx
announcementsApi.getAnnouncements.mockReset();
announcementsApi.getAnnouncements.mockResolvedValue({ items: [], unreadCount: 0 });
```

`renderApp()`（615 行）上方 import 行改为：

```tsx
import { within } from '@testing-library/react';
```

1.3 在 T1 新增的 `describe('手机端视图栈', ...)` 之后插入：

```tsx
describe('手机端抽屉', () => {
  it('点 ☰ 打开抽屉，点「我的学习」进入个人视图并关闭抽屉', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    const drawer = screen.getByRole('dialog', { name: '功能菜单' });
    await user.click(within(drawer).getByRole('button', { name: '我的学习' }));

    expect(
      screen.queryByRole('dialog', { name: '功能菜单' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('从公共树池加入一棵技能树后，就可以从零记录进度。'),
    ).toBeInTheDocument();
  });

  it('管理员可在抽屉打开管理面板', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(adminAccount);
    renderApp();
    await screen.findByText(adminAccount.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '管理面板',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: '管理面板' }),
    ).toBeInTheDocument();
  });

  it('未登录时抽屉提供登录入口', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('NestJS 完整学习树');

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '登录 / 激活账号',
      }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('登录后抽屉的公告入口打开公告列表', async () => {
    const user = userEvent.setup();
    identityApi.fetchCurrentSession.mockResolvedValue(authenticated);
    renderApp();
    await screen.findByText(authenticated.account.playerId);

    await user.click(screen.getByRole('button', { name: '打开功能菜单' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '功能菜单' })).getByRole('button', {
        name: '公告',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: '全部公告' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/navigation/MobileDrawer.test.tsx src/App.test.tsx -t '手机端抽屉|MobileDrawer'`
Expected: FAIL——MobileDrawer 文件不存在（import 报错）；App 测试找不到「打开功能菜单」按钮。

- [ ] **Step 3: 新建 MobileDrawer 组件**

`src/features/navigation/MobileDrawer.tsx`：

```tsx
import { useEffect, type ReactNode } from 'react';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        data-testid="mobile-drawer-overlay"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="功能菜单"
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-xs flex-col border-r border-slate-800 bg-slate-950 p-4 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 拆分 FeedbackDialog**

4.1 新建 `src/features/feedback/FeedbackDialog.tsx`（把 FeedbackButton 中 dialog 部分原样移入，`onClose` 作 prop；容器 class 暂保持 `max-w-md`）：

```tsx
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { submitFeedback } from './feedbackClient';

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { session } = useIdentity();
  const [content, setContent] = useState('');
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: () => submitFeedback(content, session?.csrfToken ?? ''),
    onSuccess: () => {
      setDone(true);
      setContent('');
    },
  });

  const close = () => {
    if (submit.isPending) return;
    onClose();
    setDone(false);
    submit.reset();
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    submit.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 id="feedback-dialog-title" className="text-base font-semibold text-white">
          意见反馈
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          功能建议、遇到的问题，或者任何想说的话。
        </p>
        {done ? (
          <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
            已收到你的反馈，感谢！
          </p>
        ) : (
          <form onSubmit={submitForm} className="mt-4">
            <textarea
              autoFocus
              aria-label="反馈内容"
              required
              maxLength={2000}
              rows={5}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              placeholder="写点什么…"
            />
            {submit.error && (
              <p role="alert" className="mt-2 text-xs text-rose-300">
                {submit.error.message}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submit.isPending || !content.trim()}
                className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submit.isPending ? '提交中…' : '提交反馈'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
```

4.2 `src/features/feedback/FeedbackButton.tsx` 整体替换为：

```tsx
import { useState } from 'react';
import { useIdentity } from '../identity/IdentityContext';
import FeedbackDialog from './FeedbackDialog';

export default function FeedbackButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  if (!session) return null;
  return (
    <>
      <button
        type="button"
        aria-label="意见反馈"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition hover:border-cyan-600 hover:text-white"
      >
        意见反馈
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 5: App.tsx 手机 header 与抽屉接线**

5.1 import（12-14 行附近）追加：

```tsx
import MobileDrawer from './features/navigation/MobileDrawer';
import AnnouncementsDialog from './features/announcements/AnnouncementsDialog';
import FeedbackDialog from './features/feedback/FeedbackDialog';
```

5.2 `useIdentity()` 解构（35-40 行）追加 `logout, logoutPending`（已有 `openIdentityDialog`）。

5.3 state（T1 的 mobileView 附近）追加：

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
const [announcementsOpen, setAnnouncementsOpen] = useState(false);
const [feedbackOpen, setFeedbackOpen] = useState(false);
```

5.4 header（330 行起）：T1 加的 `<div className="flex min-w-0 items-center gap-2">` 内、返回按钮之前插入 ☰ 按钮：

```tsx
{mobileView === 'list' && (
  <button
    type="button"
    aria-label="打开功能菜单"
    onClick={() => setDrawerOpen(true)}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 lg:hidden"
  >
    ☰
  </button>
)}
```

5.5 nav（341 行）改为手机隐藏：`className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs"` → `className="hidden shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs lg:flex"`。

5.6 右侧功能组（361-374 行）——AnnouncementsButton 与 IdentityAccess 包 `hidden lg:block` 容器（CreditPill 手机保留）：

```tsx
<div className="flex shrink-0 items-center gap-2">
  <div className="hidden lg:block">
    <AnnouncementsButton />
  </div>
  {session &&
    generationCapabilities?.platformFundedEnabled === true && (
      <CreditPill
        credit={creditQuery.data ?? null}
        onSignedIn={() => {
          void creditQuery.refetch();
          void platformEntitlements.refetch();
        }}
      />
    )}
  <div className="hidden lg:block">
    <IdentityAccess />
  </div>
</div>
```

5.7 在 `<FeedbackButton />`（542 行）之前插入抽屉与两个 dialog（都放根 div 内）：

```tsx
<MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
    {session ? (
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100">
          {session.account.username}
        </div>
        <div className="font-mono text-[10px] text-cyan-300">
          {session.account.playerId}
        </div>
      </div>
    ) : (
      <span className="text-sm text-slate-500">未登录</span>
    )}
    {session ? (
      <button
        type="button"
        aria-label="退出登录"
        disabled={logoutPending}
        onClick={() => void logout()}
        className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-rose-400/60 hover:text-rose-300 disabled:opacity-50"
      >
        退出
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          openIdentityDialog();
          setDrawerOpen(false);
        }}
        className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/20"
      >
        登录 / 激活账号
      </button>
    )}
  </div>

  <nav className="flex flex-col gap-1">
    <DrawerItem
      active={view === 'public'}
      onClick={() => {
        setView('public');
        setSelectedNodeId(null);
        setCompletion(null);
        setMobileView('list');
        setDrawerOpen(false);
      }}
    >
      公共树库
    </DrawerItem>
    <DrawerItem
      active={view === 'personal'}
      onClick={() => {
        showPersonalLibrary();
        setMobileView('list');
        setDrawerOpen(false);
      }}
    >
      我的学习
    </DrawerItem>
    {session?.account.isAdmin && (
      <DrawerItem
        active={view === 'admin'}
        onClick={() => {
          setView('admin');
          setDrawerOpen(false);
        }}
      >
        管理面板
      </DrawerItem>
    )}
  </nav>

  {session && (
    <div className="mt-4 flex flex-col gap-1 border-t border-slate-800 pt-4">
      <DrawerItem
        onClick={() => {
          setAnnouncementsOpen(true);
          setDrawerOpen(false);
        }}
      >
        公告
      </DrawerItem>
      <DrawerItem
        onClick={() => {
          setFeedbackOpen(true);
          setDrawerOpen(false);
        }}
      >
        意见反馈
      </DrawerItem>
    </div>
  )}
</MobileDrawer>

{announcementsOpen && session && (
  <AnnouncementsDialog onClose={() => setAnnouncementsOpen(false)} />
)}
{feedbackOpen && session && (
  <FeedbackDialog onClose={() => setFeedbackOpen(false)} />
)}
```

5.8 文件底部（`ViewButton` 函数之后）加 DrawerItem 组件：

```tsx
function DrawerItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
        active
          ? 'bg-cyan-300 text-slate-950'
          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/features/navigation/MobileDrawer.test.tsx src/App.test.tsx`
Expected: 全部 PASS（新增 7 个：3 MobileDrawer + 4 抽屉；既有测试不受影响——抽屉关闭时不渲染，`within` 限定解决名称重复）。

- [ ] **Step 7: 回归 + typecheck**

Run: `npx vitest run src/App.test.tsx src/features/feedback src/features/navigation && npm run typecheck`
Expected: 全绿。注意：FeedbackButton 悬浮按钮「意见反馈」与抽屉条目「意见反馈」文本相同，但抽屉关闭时只有悬浮按钮在 DOM，既有测试无冲突。

- [ ] **Step 8: 提交**

```bash
git add src/features/navigation/MobileDrawer.tsx src/features/navigation/MobileDrawer.test.tsx src/features/feedback/FeedbackDialog.tsx src/features/feedback/FeedbackButton.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: 手机端左上角抽屉与 header 手机版（功能入口收纳）"
```

---

### Task 3: 响应式组件适配（Dialog 宽度 / AdminPanel / 触摸目标 / safe-area）

**Files:**
- Modify: `src/features/announcements/AnnouncementDialog.tsx:31`
- Modify: `src/features/announcements/AnnouncementsDialog.tsx:24`
- Modify: `src/features/feedback/FeedbackDialog.tsx`（T2 新建）
- Modify: `src/features/identity/IdentityDialog.tsx:154`
- Modify: `src/features/tree-generation/TreeGenerationDialog.tsx:507`
- Modify: `src/features/tree-generation/PlatformGenerationConfirmation.tsx:29`
- Modify: `src/App.tsx`（header safe-area、FullPageStatus:674）
- Modify: `src/features/admin/AdminPanel.tsx:44-65`（tablist 横滚）
- Modify: `src/features/skill-tree/ProgressOverview.tsx:19,33`（safe-area）
- Modify: `src/features/feedback/FeedbackButton.tsx`（safe-area）
- Modify: `index.html`（viewport-fit=cover）
- Modify: `src/index.css`（44px 触摸目标）
- Test: `src/features/admin/AdminPanel.test.tsx`（tablist class 断言）

**Interfaces:**
- Consumes: T2 的 FeedbackDialog（容器 class 在此改为响应式）。
- Produces: 全部 dialog 容器 class 统一为 `max-w-[min(<原值rem>,calc(100vw-2rem))]` 模式（PC 下 min() 取原值，完全不变）；`.react-flow` 与 PC 布局零改动。

- [ ] **Step 1: 写失败测试**

`src/features/admin/AdminPanel.test.tsx` 的 `describe('AdminPanel', ...)` 第一个 it（192 行起）内、`expect(screen.getByRole('tab', { name: '公告' })).toBeInTheDocument();`（204 行）之后加一行：

```tsx
expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto');
```

Run: `npx vitest run src/features/admin/AdminPanel.test.tsx -t 'renders the six tabs'`
Expected: FAIL——`toHaveClass('overflow-x-auto')` 不匹配（tablist 尚无此类）。

- [ ] **Step 2: Dialog 容器宽度改自适应**

全部按「原值 rem 保留、前面套 `min(原值, calc(100vw - 2rem))`」改：

| 文件:行 | 原 class | 新 class |
|---|---|---|
| `src/features/announcements/AnnouncementDialog.tsx:31` | `w-full max-w-md rounded-2xl ...` | `w-full max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl ...` |
| `src/features/announcements/AnnouncementsDialog.tsx:24` | `... w-full max-w-lg flex-col ...` | `... w-full max-w-[min(32rem,calc(100vw-2rem))] flex-col ...` |
| `src/features/feedback/FeedbackDialog.tsx` | `w-full max-w-md rounded-2xl ...` | `w-full max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl ...` |
| `src/features/identity/IdentityDialog.tsx:154` | `w-full max-w-md overflow-hidden ...` | `w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden ...` |
| `src/features/tree-generation/TreeGenerationDialog.tsx:507` | `... w-full max-w-4xl flex-col ...` | `... w-full max-w-[min(56rem,calc(100vw-2rem))] flex-col ...` |
| `src/features/tree-generation/PlatformGenerationConfirmation.tsx:29` | `w-full max-w-md rounded-2xl ...` | `w-full max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl ...` |
| `src/App.tsx:674`（FullPageStatus） | `max-w-md rounded-2xl border ...` | `max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl border ...` |

每个文件改完只动这一处 class，其余不动（min() 在 ≥原值宽度时取原值，PC 零变化）。

- [ ] **Step 3: AdminPanel tablist 可横向滚动**

`src/features/admin/AdminPanel.tsx:44-48` nav：

```tsx
<nav
  role="tablist"
  aria-label="管理面板分区"
  className="ml-auto flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs"
>
```

tab button（50-64 行）class 加 `shrink-0 whitespace-nowrap`：

```tsx
className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold transition ${
```

- [ ] **Step 4: index.css 触摸目标 + index.html viewport-fit**

4.1 `src/index.css` 文件末尾追加：

```css
/* 手机端（<1024px）触摸目标 ≥44px（WCAG 2.5.5），PC 不受影响 */
@media (max-width: 1023px) {
  button,
  input,
  textarea,
  select {
    min-height: 44px;
  }
}
```

4.2 `index.html` viewport meta 改为：`width=device-width, initial-scale=1.0, viewport-fit=cover`（启用 env(safe-area-inset-*)，下面几处用它做安全区 padding）。

- [ ] **Step 5: safe-area 处理（max-lg: variant，Tailwind 3.3+ 默认可用，config 未禁用）**

- `src/App.tsx` header（330 行）class 追加：`max-lg:pt-[max(0.5rem,env(safe-area-inset-top))]`
- `src/features/feedback/FeedbackButton.tsx` 悬浮按钮 class 中 `bottom-5` 改为 `max-lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]`
- `src/features/skill-tree/ProgressOverview.tsx` 两个 footer（19 行、33 行）class 各追加：`max-lg:pb-[env(safe-area-inset-bottom)]`

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/features/admin/AdminPanel.test.tsx src/App.test.tsx && npm run typecheck`
Expected: 全绿（本任务全是 class 改动，行为不变）。

- [ ] **Step 7: 全量回归**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全部用例通过（当前 136+新增）、typecheck 无错误、build 成功。

- [ ] **Step 8: 提交**

```bash
git add src/features/announcements/AnnouncementDialog.tsx src/features/announcements/AnnouncementsDialog.tsx src/features/feedback/FeedbackDialog.tsx src/features/identity/IdentityDialog.tsx src/features/tree-generation/TreeGenerationDialog.tsx src/features/tree-generation/PlatformGenerationConfirmation.tsx src/features/admin/AdminPanel.tsx src/features/admin/AdminPanel.test.tsx src/features/skill-tree/ProgressOverview.tsx src/features/feedback/FeedbackButton.tsx src/App.tsx src/index.css index.html
git commit -m "feat: 手机端响应式组件适配（对话框宽度/管理面板横滚/触摸目标/safe-area）"
```

---

### Task 4: 全量验证 + CI 部署 + 验收（主会话执行，非 subagent）

**Files:**
- Modify: `D:\mapflow-server\.github\workflows\ci.yml`（MAPFLOW_COMMIT 更新）

**Interfaces:**
- Consumes: T1-T3 全部提交；前端 HEAD 为新 mobile responsive 提交。

- [ ] **Step 1: 全量门禁（前端）**

Run: `npm test && npm run typecheck && npm run build`
Expected: 全绿。记录前端 HEAD（`git rev-parse HEAD`）。

- [ ] **Step 2: 更新 server CI 的 MAPFLOW_COMMIT 并部署**

`D:\mapflow-server\.github\workflows\ci.yml` 第 12 行 `MAPFLOW_COMMIT` 改为 Step 1 记录的 HEAD；先 push 前端 main（ci.yml fetch 依赖远端存在该 commit），再在 server 仓库 commit + push：

```bash
git -C D:\mapflow-server add .github/workflows/ci.yml
git -C D:\mapflow-server commit -m "ci: 手机端适配发布（MAPFLOW_COMMIT 更新）"
git -C D:\mapflow-server push
```

Expected: CI 跑通（fmt/clippy/test/前端构建/容器冒烟），deploy-prod 自动部署到 https://xxian.fun。

- [ ] **Step 3: 线上验证**

Run: `curl -fsS https://xxian.fun/health/ready && curl -fsS https://xxian.fun/ | head -c 400`
Expected: health 200；首页 HTML 正常返回。抽查生产 JS 含「打开功能菜单」「返回上一级」字符串（`curl -fsS https://xxian.fun/ | grep -o '/assets/index-[^"]*\.js' | head -1` 取 hash，再下载对应 JS grep，注意 Windows/Linux 构建 hash 可能不同，以实际部署为准）。

- [ ] **Step 4: 浏览器验收清单（用户执行，主会话提供清单）**

DevTools 移动模拟（375×667，iPhone 12 档）逐项：
1. 列表页：☰ 左上角 + 标题 + 右侧积分胶囊；树列表全宽可点。
2. 点树项 → 图页全屏（触摸可平移缩放），左上 ← 回列表。
3. 点节点 → 详情页全屏可滚动，← 回图页，再 ← 回列表。
4. ☰ 抽屉：公共树库/我的学习/管理面板（管理员）切换正确；公告/意见反馈入口打开对应弹窗；未登录时显示「登录 / 激活账号」。
5. 公告弹窗、反馈弹窗、签到弹窗、生成技能树全流程弹窗在 375px 下不溢出、可滚动。
6. 管理面板：Tab 可横向滑动，六 Tab 均可用。
7. 悬浮「意见反馈」按钮不遮挡底部 Home 条（safe-area）。
8. PC 回归（≥1024px）：三栏布局、header 导航、各弹窗宽度与改造前一致。
9. 真机（iOS Safari + Android Chrome）复验 1-7。

---

## Self-Review

**1. Spec 覆盖（对照 docs/superpowers/specs/2026-08-20-mobile-responsive-design.md）：**

| Spec 要求 | 落点 |
|---|---|
| A. 断点 lg、PC 零变化、手机单栏 | T1（所有 mobile class 配 lg: 还原）；T3 dialog min() 原值保留 |
| B. mobileView 三视图栈 + 返回 | T1（state、select 函数、onSelectNode、返回按钮、三个 data-testid） |
| C. 左上角抽屉（85vw、遮罩/Esc 关闭、功能不减） | T2（MobileDrawer 组件 + App 接线 + DrawerItem） |
| D1. 三栏组件手机全屏化 | T1（list/graph/detail 容器 + NodeDetailPanel 内部容器） |
| D2. 弹窗 max-w-[min(...)] | T3 Step 2（7 处） |
| D3. AdminPanel <lg 全屏 + Tab 横滚 | T3 Step 3（AdminPanel 已是全屏结构，仅 tablist 横滚） |
| D4. 触摸目标 ≥44px + overflow-x 兜底 + safe-area | T3 Step 4/5（44px 仅 <1024px；overflow-x 兜底由 T1 的 hidden/flex 切换天然满足，且根布局本就 overflow:hidden；safe-area 用 max-lg:） |
| E. 不做 PWA/路由库/性能专项 | 全局约束 3（不引入新依赖） |
| 验证：npm test/typecheck/build + 浏览器验收 + PC 回归 + 部署 | T4 全部 |

**2. Placeholder 扫描：** 无 TBD/TODO/「类似 Task N」；每个步骤含完整代码或精确到行号的改动说明。

**3. Type consistency：**
- `mobileView` 三值在 T1 定义、T1/T2 使用，写法一致（`'list' | 'graph' | 'detail'`）。
- data-testid：T1 建立 `mobile-list`/`mobile-graph`/`mobile-detail`，T1 测试引用同一批。
- `MobileDrawer({ open, onClose, children })` T2 定义 + 测试同签名；`FeedbackDialog({ onClose })` T2 定义、T2 App 接线与 T3 class 改动同名。
- 返回按钮 aria-label「返回上一级」、☰ 按钮 aria-label「打开功能菜单」在 T1/T2 测试中一致。
- 抽屉「公告」入口 → `AnnouncementsDialog`（aria-labelledby 标题「全部公告」），测试 `getByRole('dialog', { name: '全部公告' })` 一致。
- T2 测试 mock 的 `getAnnouncements` 返回 `{ items, unreadCount }` 与 T8 的 client 结构一致（AnnouncementsDialog 消费 `items`）。

**4. 已知风险与缓解：**
- App.test.tsx 既有测试依赖 header 按钮唯一性（「我的学习」「退出登录」「登录 / 激活账号」）——抽屉关闭时 `if (!open) return null` 不渲染，无冲突；T2 测试内用 `within(drawer)` 限定。已在 T2 Step 7 标注。
- `max-lg:` 变体依赖 Tailwind 3.3+ 默认配置——tailwind.config.ts 仅 extend animation/keyframes，未禁用，可用（T3 Step 5 已注明）。
- jsdom 无 CSS：44px/safe-area/overflow 效果无法自动测，由 T4 浏览器验收兜底（全局约束 6）。
