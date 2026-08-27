# MapFlow 项目交接文档

> 交接日期：2026-08-21　交接对象：接手此项目的 AI Agent
> 阅读顺序：本文档（30 秒概览 + 部署流水线必读）→ 全局 `C:\Users\Administrator\.claude\CLAUDE.md`（工作流规则）→ `.superpowers/sdd/2026-08-20-mobile-responsive/progress.md`（修复历史 ledger）→ 相关代码

---

## 1. 30 秒概览

MapFlow 是一个 **AI 技能树教学系统**（生产：https://xxian.fun），核心功能：

- **技能树生成**：输入主题/角色/目标，AI（DeepSeek，经 Rust harness）生成学习技能树
- **公共树库**：所有用户生成的树进入公共池，可浏览/查看（含 showcase 高亮节点）
- **身份系统**：邀请码注册、登录、会话（opaque cookie + CSRF）、管理员面板
- **辅助系统**：信用/积分（平台免费额度）、公告、意见反馈

两个仓库（均直接工作在 `main` 分支）：

| 仓库 | 路径 | 内容 |
|---|---|---|
| `rongyan-123/MapFlow` | `D:\MapFlow-publish` | 前端 React + Vite + Tailwind + xyflow + TanStack Query |
| `rongyan-123/mapflow-server` | `D:\mapflow-server` | Rust (Axum) 后端 + DeepSeek harness + **全部部署流水线** |

---

## 2. 当前状态（2026-08-21）

### 已验证 ✅
- 生产健康：`/health/ready` 200
- 生产已部署 c05199e 版本：新 JS `index-BYhfuej4.js`、CSS `index-as4gmxTC.css`
- `index.html` 响应头 `Cache-Control: no-store`；hash 资源 `public, max-age=31536000, immutable`
- 前端 158 用例全绿 + typecheck + build；server 非 DB 测试全绿（DB 测试需 Postgres，本地无）

### 未验证 ❓（接手后第一优先）
- 用户手机真机复验：「我的学习」视图生成按钮是否稳定显示（修复轮 6 刚部署，用户尚未反馈）
- 无痕窗口验证过不了本地，只能等用户真机确认

### 已知问题（待处理）
- **switch.sh 无回滚缺陷**（服务器脚本 `/opt/mapflow/switch.sh`）：新容器启动失败时旧容器已被 stop+rename，生产直接 502 离线。2026-08-21 已实际发生一次（见 §7 事故记录）。加固方案未定，改动前需与用户确认
- 用户 PAT（`ghp_06hJ...`，存 `D:/tmp/gh-token.txt`）：用于查 CI 状态/删 artifact，不再使用时建议撤销

---

## 3. 真相源优先级

```
运行中的生产代码 > 本地代码 > 测试 > progress.md ledger > 本文档 > 旧交接
```

本文档与 ledger 可能滞后于实际代码。接手时先 `git log --oneline -10` 与 `git status` 核实，再信任文档中的 commit hash 与状态。

---

## 4. 开发工作流（与全局 CLAUDE.md 一致，重点摘录）

- **三阶段**：先想清楚（描述+步骤+验证方式）→ 用户确认 → TDD（先写测试跑红→实现跑绿）→ 完成前全量测试 + typecheck + build
- **修复 bug 用 systematic-debugging 技能**；新功能先 brainstorming
- **全程中文**（对话、commit message、注释）
- **Subagent 必须显式 `model=sonnet`**（用户要求不用 Pro）
- **直接在 main 分支工作**（两仓库都是，用户已确认的既定工作流）
- **最小改动**：只改任务要求的代码；同一方案失败 2-3 次立即 WebSearch
- **图片识别用 `mcp__vision__describe_image`**（豆包 MCP），不用内置 Read 读图
- 用户是产品所有者，有明确技术判断力；**不要假设用户操作错误**（曾因此被纠正）

---

## 5. 部署流水线（最重要，出问题先看这里）

### 5.1 正常发布流程

```
前端改代码 → 前端测试全绿 → commit + push（MapFlow 仓库）
→ 编辑 mapflow-server/.github/workflows/ci.yml 的 MAPFLOW_COMMIT 为前端新 commit 完整 hash
→ server commit + push → GitHub Actions 自动构建部署（约 15-25 分钟）
```

### 5.2 CI 做什么（ci.yml）

1. **linux-canary-artifact job**：checkout → Rust 门禁（fmt/check/clippy/test）→ 前端构建（按 MAPFLOW_COMMIT pin）→ 构建 release 镜像 → 受限运行验证（canary 生成接口等）→ **docker push 到 GHCR**（`ghcr.io/rongyan-123/mapflow-server:canary-$SHA`）→ 清理旧 canary 版本
2. **deploy-prod job**（仅 push 事件，dispatch 不触发）：GHCR pull → **tag 回本地短名** → save → scp 到生产服务器 → `ssh bash /opt/mapflow/switch.sh`

### 5.3 部署验证（不能靠猜）

```bash
curl -s https://xxian.fun/health/ready                    # 200
curl -s https://xxian.fun/ | grep -oE 'assets/index-[^"]+\.js'   # 新 hash
curl -sI https://xxian.fun/ | grep -i cache-control       # no-store
curl -s https://xxian.fun/assets/index-新hash.js | grep '特征字符串'
```

- **本地构建 hash ≠ 生产 hash**（Windows/Linux 非确定性），用特征字符串验证而非 hash 对比；CSS 的 hash 与本地一致
- 生产是 Linux CI 构建；验证 URL 用 https://xxian.fun（不是 127.0.0.1:18082）

### 5.4 查 CI 状态（用户授权方式）

```bash
TOKEN=$(cat D:/tmp/gh-token.txt)
curl -H "Authorization: Bearer $TOKEN" https://api.github.com/repos/rongyan-123/mapflow-server/actions/runs?per_page=3
```

失败 run 用 `/actions/runs/{id}/jobs` 找失败步骤，`/actions/jobs/{id}/logs` 拉日志。

### 5.5 CI 事故教训（2026-08-21，全部已修复）

| 事故 | 根因 | 修复 |
|---|---|---|
| upload-artifact 配额打满 | 59 个归档 × 40-84MB 超 500MB 免费配额 | API 批量删除 + 改走 GHCR |
| checkout Repository not found | **job 级 permissions 完全覆盖 workflow 级**，丢 contents: read | job 级显式 `contents: read` |
| 配额删除后仍失败 | GitHub 用量统计滞后 6-12 小时 | 镜像改走 GHCR（独立配额） |
| docker run 找不到镜像 | save 时带 ghcr 全名，switch.sh 用短名 | pull 后 tag 回 `mapflow-server:canary-$SHA` |
| **生产 502 离线** | **switch.sh 无回滚**：新容器失败 → 旧容器已停，无人恢复 | 新增 `recover-prod.yml`（手动 dispatch，rename+start previous 容器） |

### 5.6 应急恢复（生产离线时）

仓库根有 `.github/workflows/recover-prod.yml`：workflow_dispatch 手动触发，SSH 恢复 previous 容器并验证 health。

---

## 6. 生产环境与安全约束（verbatim，违反 = 事故）

- **绝不 cat/print secrets**：`database.url`、`identity-secrets.json`、`deepseek-platform-api-key`、turnstile secret key（在 `/opt/mapflow/identity/secrets/`）
- **secrets 绝不进 env/image/git/命令行**；邀请码明文绝不允许进数据库或 API
- **部署私钥只在 GitHub secret**（DEPLOY_SSH_KEY），绝不进 git/logs
- **不要在 1.6GiB 服务器上编译 Rust**（内存不够）
- **不要** `docker system prune --volumes`、不要递归删除 `/opt`、不要 touch `xiuxian` 容器（另一个项目）
- 删除 `releases/backups` 前必须验证绝对路径
- 本地 Rust 验证用：`~/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin/cargo.exe`
- 前端测试：`npx vitest run`（cd D:/MapFlow-publish）

---

## 7. 最近变更（2026-08-20/21，详见 ledger）

修复轮 1-5（手机端适配 + showcase 黑节点 + 进图冻结 + 生成按钮常驻）：commits `bbc1f193..d8ff601`，全部已部署。
修复轮 6（当前上线版本，server c05199e / 前端 8ba45fb）：

- **HTML no-store + 资源 immutable 缓存头**（static_site.rs）——根治浏览器缓存旧 JS 导致线上修复不达
- **capabilities 失败乐观启用身份入口**（IdentityContext.tsx）——杜绝匿名用户无法登录的死锁
- CI 事故修复 + GHCR 迁移 + recover-prod（见 §5.5）

完整历史：`.superpowers/sdd/2026-08-20-mobile-responsive/progress.md`

---

## 8. 测试账号与环境

- 测试账号：`ui-check-20260820` / `ui-check-password-2026`（邀请码 `EEHUHI`，playerId MF-PEZD-WVB9-B9JZ）；cookie 备份 `D:/tmp/mapflow-cookie.txt`
- CDP 验证脚本（headless Chrome）：`C:\Users\Administrator\AppData\Local\Temp\cdp-*.mjs`（可复现手机视口/登录态/接口拦截）
- 生产公告/反馈/信用数据在真实 Postgres，测试操作注意影响

---

## 9. 下一步（接手后建议顺序）

1. 等用户真机反馈「我的学习」按钮（修复轮 6 验收）
2. 用户确认后，讨论 **switch.sh 无回滚加固**（trap 回滚或先起新容器再停旧；改动前与用户确认方案）
3. 建议用户撤销 PAT（若不再需要我这边查 CI）
4. 长期待办：AdminPanel v2、公告/信用/反馈迭代（docs/superpowers/ 下有相关 plan/spec 未实施）

---

## 10. 给接手 AI 的开场指令（可直接复制）

> 你正在接手 MapFlow 教学系统（https://xxian.fun）。请先读 `D:\MapFlow-publish\HANDOVER.md`（项目交接文档）→ 全局 `C:\Users\Administrator\.claude\CLAUDE.md`（工作流规则）→ `.superpowers/sdd/2026-08-20-mobile-responsive/progress.md`（修复历史）。然后 `git log --oneline -10` 核实两仓库（D:\MapFlow-publish 前端、D:\mapflow-server 后端）当前状态。确认无误后我们再开始具体任务。
