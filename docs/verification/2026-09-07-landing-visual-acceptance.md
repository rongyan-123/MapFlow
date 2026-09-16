# 首页视觉验收记录（2026-09-07）

## 范围

只验收 MapFlow 首页的 Earth 叙事、开场 CRT 视窗、地图图例、短视口内容边界和既有交互；未改工作台、登录、MCP 协议或后端。

预览：`http://127.0.0.1:5177/?marketing=1`

## 结果

- A：Earth 与控件隐藏；标题居中进入 CRT 视窗，使用标题纹理的非线性 UV 鱼眼采样，保留低幅色散、扫描线和噪点效果。
- B：前段仍隐藏 Earth；到转场才逐步揭示 Earth 与关系图，滚回时可逆收回。
- C：保留完整七节点地图，移除“学习方向 / 工程问题 / 前置关系”重复徽章。
- D：在同一张地图上增量出现 MCP 节点和边。
- E：图例明确标为“示意进度”，CTA 与归属信息可达。
- 窄屏：390px 保留低采样 shader，不再用第二份错位标题；标题在“学习——”后语义换行，“什么时候”保持完整；768×800 的 scene 内容改为可延展布局。

## 浏览器证据

- A 桌面：`C:/Users/Administrator/.codex/visualizations/2026/09/07/01a07a75-994c-7fe3-89a2-6c5a15c35843/narrative-A-refined-1720x1080.png`
- A 移动端：`C:/Users/Administrator/.codex/visualizations/2026/09/07/01a07a75-994c-7fe3-89a2-6c5a15c35843/narrative-A-mobile-refined.png`
- C：`C:/Users/Administrator/.codex/visualizations/2026/09/07/01a07a75-994c-7fe3-89a2-6c5a15c35843/narrative-C-refined-confirmed-v2.png`
- E：`C:/Users/Administrator/.codex/visualizations/2026/09/07/01a07a75-994c-7fe3-89a2-6c5a15c35843/narrative-E-refined-confirmed-v2.png`
- 本次修正桌面首屏：`C:/Users/Administrator/.codex/visualizations/2026/09/08/mapflow-crt/landing-crt-desktop-1440x900-v2.png`
- 本次修正移动首屏：`C:/Users/Administrator/.codex/visualizations/2026/09/08/mapflow-crt/landing-crt-mobile-390x844.png`
- 本次修正桌面滚动中间态：`C:/Users/Administrator/.codex/visualizations/2026/09/08/mapflow-crt/landing-crt-desktop-middle-1440x900-v3.png`

1440×900 实测：opening h2 与 CRT canvas 同尺寸，标题 `white-space: nowrap` 且整句单行；WebGL renderer 实际为 `webgl`。390×844 实测：标题按“学习—— / 什么时候 / 变得如此困难？”排版，`什么时候` 未拆词，document/client width 均为 `391`，无横向溢出。滚动中间态的 CRT progress 从 `0.000231` 降至 `0.1125`，正文保持稳定。

768×800 实测：document/client width 均为 `768`；修复前 clarity/domain/mcp/progress 的 inner 高度超过固定 scene，修复后全部落在可延展 scene 内。最大滚动位置仍可见 E 的 CTA（top `182`）和 attribution（top `768`），无横向溢出。

模拟 `prefers-reduced-motion: reduce` 后，CRT renderer 为 `fallback`，canvas `display:none`，DOM 标题恢复不带色散/阴影的清晰样式。

## 工程验证

- `npm run test -- --run`：36 个测试文件、312 个测试通过。
- `npm run typecheck`：通过。
- `npm run build`：通过；仅有既有大 chunk advisory。
- `git diff --check`：通过。

## 来源凭证限制

本轮未复现 mutation 403 或来源凭证失败；仅观察到同源 `GET /api/capabilities` 返回 200、匿名 `GET /api/auth/session` 返回 401。未修改服务端 Origin、CSRF、代理或部署配置。
