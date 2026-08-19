# 管理员面板设计（2026-08-19）

## 背景与目标

MapFlow 上线邀请码注册后，出现陌生人注册并消耗平台 API 额度的情况（截至 2026-08-19：17 个账号、13 次 platform 模式生成）。用户需要一个**管理员面板**掌握运营数据，为后续创业统计打基础。

核心目标：
1. 管理员可查看运营数据：注册/登录趋势、在线时长、邀请码库存、用户用量、审计日志
2. 可执行最小操作：封禁账号、作废邀请码
3. 数据源全部来自现有日志表，不新增埋点

## 架构总览

- 后端（mapflow-server，Rust/Axum）：新增 `/api/admin/*` 路由组，复用现有会话认证 + 管理员检查层
- 前端（MapFlow-publish，React）：`AppView` 新增 `'admin'`，导航栏出现管理面板入口（仅管理员可见）
- 数据库：**不新增表**，全部实时 SQL 聚合（数据量小，无需物化表）

## 管理员身份

- 服务器 secrets 文件 `/run/secrets/admin-username` 存管理员用户名（单行文本）
- 启动时读入内存（`MAPFLOW_ADMIN_USERNAME_FILE` 环境变量指定路径，沿用现有 secrets 挂载模式）
- 认证流程：现有 `require_current_identity` 解析会话 → 新增 `require_admin_identity` 检查 `username_key == admin_username`，不匹配返回 403
- 前端 `/api/me`（现有当前用户接口）扩展返回 `isAdmin: bool`，用于显示入口

## 后端 API

统一前缀 `/api/admin`，全部需要管理员身份：

### GET /api/admin/dashboard
核心指标汇总，一次返回：
```json
{
  "totals": {
    "registeredAccounts": 17,
    "availableInvites": 38,
    "redeemedInvites": 17,
    "revokedInvites": 0,
    "activeSessions": 21,
    "platformUsages": { "count": 13, "inputTokens": 0, "outputTokens": 0 }
  },
  "loginTrend7d": [
    { "date": "2026-08-13", "activeAccounts": 2 },
    { "date": "2026-08-14", "activeAccounts": 0 }
  ],
  "inviteClaims": { "today": 0, "yesterday": 1, "last7d": 5 }
}
```
- 登录口径：`sessions` 按日 `count(DISTINCT account_id)`（`last_seen_at` 落在当日）
- 平台额度：`platform_generation_usages` 聚合

### GET /api/admin/accounts
用户列表 + 用量：
```json
{
  "accounts": [
    {
      "accountId": "uuid",
      "username": "orange",
      "status": "active",
      "registeredAt": "2026-08-18T14:31:02Z",
      "lastSeenAt": "2026-08-19T02:12:42Z",
      "generationSessions": { "byok": 0, "platform": 3 },
      "totalTokens": 12345
    }
  ]
}
```
- 最后活跃：该账号最近一次 `sessions.last_seen_at`
- token：`tree_generation_plans`（input+output+cache 汇总）按会话聚合
- 排序：注册时间倒序

### GET /api/admin/invitations
邀请码全量状态：
```json
{
  "summary": { "available": 38, "redeemed": 17, "revoked": 0 },
  "items": [
    {
      "inviteId": "uuid",
      "status": "available",
      "createdAt": "2026-08-15T10:00:00Z",
      "claimedIp": "120.230.61.229",
      "claimedAt": "2026-08-16T03:40:11Z",
      "redeemedBy": "焦糖牛之角",
      "redeemedAt": "2026-08-16T03:40:31Z"
    }
  ]
}
```
- 来自 `invite_codes` LEFT JOIN `invitation_claims` LEFT JOIN `accounts`
- 邀请码明文不返回，只返回 digest 前 6 位用于区分？——**不返回明文**（安全约束），仅状态与关联信息

### GET /api/admin/audit-events?event_type=&from=&to=&limit=50&offset=0
审计日志分页：
```json
{
  "events": [
    {
      "eventId": "uuid",
      "eventType": "identity.registered",
      "outcome": "succeeded",
      "playerId": "MF-XXXX-XXXX-XXXX",
      "occurredAt": "2026-08-16T03:40:11Z",
      "details": {}
    }
  ],
  "total": 27
}
```
- 过滤：event_type（identity.registered / identity.logged_in / 全量）、日期区间
- 分页：limit（默认 50，上限 200）+ offset

### POST /api/admin/accounts/{account_id}/suspend
封禁账号：`accounts.status` → `suspended`（幂等：已 suspended 返回成功）
- 副作用：吊销该账号所有活跃会话（`sessions.revoked_at` 置当前时间）
- 成功后写 `identity_audit_events`（event_type `admin.account_suspended`）

### POST /api/admin/invitations/{invite_id}/revoke
作废邀请码：`invite_codes.status` → `revoked`（仅 available 可作废，redeemed 返回 409）
- 写 `identity_audit_events`（event_type `admin.invite_revoked`）

## 统计口径（在线时长等）

| 指标 | 计算 | 数据源 |
|---|---|---|
| 每日登录人数 | `last_seen_at` 按日 `COUNT(DISTINCT account_id)` | sessions |
| 在线时长 | 活跃会话 `last_seen_at - created_at` 均值/最大 | sessions |
| 平均停留 | 所有会话 `idle_expires_at - created_at` 均值 | sessions |
| 生成时长 | `finished_at - started_at` 均值/最大 | tree_generation_runs |
| 平台额度消耗 | usages 聚合（次数、input/output token） | platform_generation_usages |

第一版 dashboard 只返回 `loginTrend7d` 与汇总；平均停留/生成时长作为 accounts 列表的扩展字段或后续版本加入（YAGNI，用户可随时要求加，SQL 已有现成口径）。

## 前端

- `AppView` 扩展：`type AppView = 'public' | 'personal' | 'admin'`
- 现有 `/api/me` 返回 `isAdmin`；personal 视图导航栏渲染"管理面板"按钮（`isAdmin === true` 时）
- `features/admin/`：
  - `AdminPanel.tsx` — 主面板（Tab：概览 / 用户 / 邀请码 / 审计日志）
  - `OverviewTab.tsx` — 指标卡片 + 7 日登录 CSS 柱状图
  - `AccountsTab.tsx` — 用户表格 + 封禁按钮（二次确认）
  - `InvitationsTab.tsx` — 分布计数 + 列表 + 作废按钮
  - `AuditLogTab.tsx` — 类型过滤 + 分页列表
  - `adminClient.ts` — API 类型与调用（React Query，沿用现有模式）
- 风格：沿用现有 slate/cyan 深色主题

## 错误处理

- 非管理员访问：403 + 通用错误提示（不泄露管理员用户名）
- 账号不存在：404；作废已兑邀请码：409
- 前端对 403/404/409 显示对应中文提示

## 测试

后端（TDD）：
- `require_admin_identity`：非管理员 403、管理员通过、未登录 401
- dashboard SQL 聚合：注册数/邀请码分布/登录趋势正确（集成测试连真实 postgres，沿用 CI postgres service）
- suspend/revoke：状态变更 + 会话吊销 + 审计写入；revoke 已兑码返回 409

前端（TDD）：
- adminClient 请求参数与类型
- AdminPanel：非管理员不渲染入口、各 Tab 渲染、封禁/作废交互（mock API）
- `/api/me` isAdmin 字段

## 部署

- 后端：新端点进 CI 集成测试 → artifact
- 服务器：新增 secret 文件 `/opt/mapflow/identity/secrets/admin-username`（root 0600 权限），switch 脚本需挂载该文件到容器 `/run/secrets/admin-username`（脚本 `MAPFLOW_ADMIN_USERNAME_FILE` env）
- 前端：随 CI pin 更新走现有部署流程

## 不在本版范围

- 邀请码明文查看（安全约束）
- 多管理员管理（数据库 role 字段）
- 图表库（CSS 柱状图足够）
- 数据导出/报表
- 定时物化统计表（数据量增长后再考虑）
