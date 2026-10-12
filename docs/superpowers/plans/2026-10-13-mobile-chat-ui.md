# Unified Mobile Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 三个聊天场景在手机上共用一行操作栏、一个导航抽屉和紧凑输入框。

**Architecture:** ApplicationShell 接管手机顶部及抽屉，通过稳定的 DOM 插槽和 React portal 接收当前场景的操作与选择器。对话组件始终保留挂载；选择、草稿、执行订阅及配置仍由现有业务组件拥有。可视窗口变化只更新外壳尺寸，不重新渲染地图。

**Tech Stack:** React 18、TypeScript、Tailwind、Vitest、Testing Library、真实应用 Playwright 浏览器验收。

**Spec:** `docs/specs/2026-10-13-mobile-chat-ui-design.md`（用户已批准实施）

## Global Constraints

- 顶部内容高 52px，另计设备顶部安全区；不换行。
- 按钮触控区域至少 44×44px，使用有无障碍名称的图标。
- 320px 宽仍保留全部四个按钮，不挤出屏幕。
- 只有一个手机导航抽屉，采用不透明面板并覆盖画布、地图和它们的操作菜单。
- 关闭时原聊天不卸载，输入草稿、流式订阅与滚动位置保留。
- 输入框初始一行，随输入自然增长至四行，之后在输入框内部滚动。
- 对话和角色仍读写现有数据库，运行、日志、支付、模型结算和权限使用现有后端。
- 桌面保留既有侧栏与可拖动工作区。不新增收费或自动请求，不清空历史及草稿。
- 原工作目录的用户改动保留；全部修改在 `D:/MapFlow-mobile-ui-design-20261013` 完成。

## Review Focus

- 抽屉打开/关闭和配置切换后，键盘焦点、背景滚动和原聊天草稿应恢复。
- 学习地图打开后顶部操作仍可用，返回后不丢聊天订阅或输入。
- 320px 与长模型/角色/会话名称不能挤出操作按钮或发送按钮。
- 中文输入法组合期间 Enter 不发送；可视窗口缩小后输入框仍在底部。
- 新角色提示及模型选择在一个抽屉可达，筛选历史不暗中切换当前角色。

---

### Task 1: 共用手机顶部与安全抽屉

**Files:** Create `src/features/navigation/MobileChatChrome.tsx`; modify `ApplicationShell.tsx`, `MobileDrawer.tsx`; test `src/App.test.tsx`, `MobileDrawer.test.tsx`.

**Interfaces:** `useMobileChatChrome(): MobileChatChrome | null`; `MobileChromePortal({slot,children})`; slot 为 `title | new | configuration | canvas | learning | characters | history | model`。上下文提供 `openDrawer()`、`closeDrawer()` 和稳定的 DOM 插槽目标。桌面或没有外壳时返回 null，保留现有独立组件能力。

- [x] 写真实 App 手机交互测试：进入学习对话，`within(screen.getByRole('toolbar',{name:'对话操作'}))` 同时找到菜单、新建、配置和画布，配置点击后打开原配置界面；选择器默认在抽屉中。
- [x] 执行 `npm exec vitest run -- src/App.test.tsx -t '统一手机聊天'`，确认现有多行布局无法满足同一个 toolbar，测试失败。
- [x] 实现插槽公共契约；顶部用四个 44px 图标按钮，中间标题省略。业务导航后顺序放入学习区、角色、历史、模型插槽，辅助导航继续保留权限条件。

```tsx
export type MobileChromeSlot = 'title' | 'new' | 'configuration' | 'canvas' | 'learning' | 'characters' | 'history' | 'model';
export function MobileChromePortal({slot, children}: {slot: MobileChromeSlot; children: React.ReactNode}) {
  const chrome = useMobileChatChrome();
  const target = chrome?.targets[slot];
  return target ? createPortal(children, target) : null;
}
```

- [x] 抽屉 portal 至 body 的最高层级；保存原焦点和 body overflow，锁定背景、限制 Tab、Escape 关闭，cleanup 恢复。写并运行真实焦点测试：打开时首按钮获取焦点，Shift+Tab 回末按钮，关闭返回触发器。
- [x] 运行 App 手机用例和抽屉测试，类型检查，自审差异，提交 `feat: share mobile navigation and chat controls`。

### Task 2: 场景入口与选择器全部接入一个抽屉

**Files:** Modify `AgentTavernPage.tsx`, `LearningChatWorkspace.tsx`, `TavernPage.tsx`; tests `App.test.tsx`, `TavernPage.test.tsx`, `LearningChatWorkspace.test.tsx`.

**Interfaces:** Consume `useMobileChatChrome`、`MobileChromePortal`。继续使用现有 `createNewConversation`、`selectConversation`、角色导入和配置状态，不创建第二套状态或 HTTP 接口。

- [x] 写参数化测试覆盖 `/assistant`、`/learning?area=…`、`/tavern`，一个顶部和一个抽屉，顶部＋调用原新建流程；进入抽屉后模型通路、角色与历史可见；切换历史关闭抽屉。打开/关闭抽屉后 `输入消息` 的用户草稿原样保留。
- [x] 运行新增测试，确认旧场景重复栏位及嵌套抽屉导致失败。
- [x] 用 portal 传递现有控件，手机场景原顶部不输出；桌面不变。学习区切换和地图入口放到 learning 插槽；角色导入/自创/新增提示放 characters；默认全部历史放 history；现金、积分和自填 Key 选择放 model。每个导航动作先 `closeDrawer()`，再执行现有动作。

```tsx
const mobileChrome = useMobileChatChrome();
const openConfiguration = () => {
  mobileChrome?.closeDrawer();
  setConfigurationSection('model');
  setConfigurationOpen(true);
};
// 同一配置和会话状态分别呈现到移动插槽或原桌面区域。
```

- [x] 修正已有移动交互用例至批准后的入口语义；测试配置保存、历史筛选不切角色、导入不切会话。运行相关测试和类型检查，提交 `feat: move mobile scene selection into one drawer`。

### Task 3: 紧凑消息、输入框和键盘尺寸

**Files:** Modify `ConversationPane.tsx`, `teachingWorkspace.css`; create `src/lib/useMobileViewport.ts`; modify `ApplicationShell.tsx`; test `src/App.test.tsx`、`src/features/assistant/NativeConversationPane.test.tsx`。视口行为在真实 App 外壳上验证。

**Interfaces:** `useMobileViewport(enabled: boolean): RefObject<HTMLDivElement | null>` 返回外壳 ref；事件只更新该元素的 `--mobile-viewport-height` 和 `--mobile-viewport-top`，卸载清理。

- [x] 写输入交互测试：移动输入初始 rows=1；组合输入 Enter 不触发真实 HTTP 边界；输入多行后 Shift+Enter 不发送；发送和停止使用同位置的原回调。可视窗口测试模拟 resize 后 height CSS 值随实际高度变化，卸载不保留监听。
- [x] 分别运行两个文件新增测试确认旧 textarea rows=2、未跟随 visualViewport 时失败。
- [x] 自动增长使用浏览器真实 scrollHeight，行高 22px、四行后内部滚动。移动隐藏输入区大模型标签，费用以紧凑摘要和原有真实细节呈现，消息动作收进操作入口。

```tsx
function resizeComposer(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = `${Math.max(38, Math.min(element.scrollHeight, 104))}px`;
}
```

- [x] 外壳移动高度跟随 visualViewport.height/offsetTop，降级到 innerHeight；变化只改样式。保留 IME 检测、运行权限、余额及失败状态。
- [x] 运行相关测试、类型检查，浏览器检查 320/360/390/430px、横屏、长代码表格、键盘开关，提交 `feat: compact mobile composer and follow the visible viewport`。

### Task 4: 画布地图模式、完整验收及审阅

**Files:** Modify `ConversationPane.tsx`, `TeachingCanvasPanel.tsx`, `LearningMapPanel.tsx`, `TavernUi.tsx`, `teachingWorkspace.css` only as needed; modify `useTeachingCanvas.ts` for the verified automatic-permission defect; tests `App.test.tsx`, `TeachingCanvasPanel.test.tsx`, `LearningChatWorkspace.test.tsx`, `useTeachingCanvas.test.ts`; update spec status and `docs/research/2026-10-13-mobile-chat-ui-acceptance.md`。

**Interfaces:** Consume顶部 canvas插槽；复用现有画布文档、保存和图工具授权。手机地图仍惰性挂载，画布按钮复用现有状态且先关闭地图。聊天不卸载。

- [x] 写行为测试：顶部展开/收起画布后原草稿仍在；地图打开后新建/配置/返回仍可达；绘图权限不会由切换 UI 自动开启。检查新增角色提醒首次打开角色选择后消失。
- [x] 跑红，按测试补齐移动画布或地图的操作入口。约 200ms 过渡，减少动画时直接切换。抽屉与弹窗覆盖 Excalidraw 菜单，顶部只保留一行。
- [x] 完整运行 `npm test -- --run --maxWorkers=4 --minWorkers=4`、`npm run typecheck`、`npm run build`；自审每一行差异。纯样式以浏览器验证，不写字符串镜像测试。
- [x] 用真实后端、真实账号记录验证三个手机聊天、四种宽度、横屏、桌面回归、配置、角色导入、学习区切换、历史选择、画布真实保存；统计导航期间自动生成请求必须为 0。保存截图及来源，不将模拟数据当真实验收。
- [x] 按 executing-plans 要求邀请一次完整分支的新审阅者，修复可重现问题并重新验证有关测试。提交结果、给出具体可审阅版本。
- [ ] 按具体手机版本的发布授权处理 main 集成和部署；已发布的全局助手不受此待办影响。
