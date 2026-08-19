# 反馈 + 积分 + 公告 设计文档

**日期**: 2026-08-19
**状态**: 待确认

## 背景

管理面板 v2（审计可读化 + 统计增强 + 自动部署）已上线。用户提出三个新需求：

1. **反馈系统**：用户可随时提反馈，管理员在面板查看
2. **积分系统**：签到领积分（每天一次），生成树免费 3 次用完后花积分
3. **公告系统**：新功能/群聊/仓库等信息，新用户弹窗展示，老用户可随时查看

另：Agent 重构聊天系统为独立大功能，另行开分支，不在本 spec 范围。

## 现状调查（已确认的事实）

- 免费生成额度现有机制：`platform_generation_grants` 表（source_kind: invite_activation | manual）+ `invite_batches.platform_generation_grant_count`。`reserve_platform_session`（tree_generation_store.rs:92）事务内：锁 accounts 行 → `available = sum(grants) - count(reserved+consumed)`，`<= 0` 抛 `EntitlementExhausted`。
- 生产数据：17 条 invite_activation grants（共 49 次）、2 条 manual（共 6 次）。早期批次 grant_count=3，后期批次=0，发放不统一。
- usage state 流转：`reserved → consumed`（成功/弃用）或 `released`（规划失败/平台失败），有触发器强制一次性流转 + 唯一部分索引保证每账号最多 1 条 reserved。
- accounts 表无积分/次数字段；Cargo.toml 无 rand crate（有 getrandom 0.4.3）。
- 前端无路由库，AppView 三态（public/personal/admin）切换；admin Tab 定义在 AdminPanel.tsx（overview/accounts/invitations/audit）；弹窗模式统一（fixed inset-0 z-50 自研 Dialog）；client 模式 = 每 feature 一个文件 + request 包装 + 强校验。

## 设计

### A. 积分系统

**额度模型（两套独立）**

- **免费额度：现有 grants 系统原样保留**，老账号有多少用多少，不做任何迁移。
- **积分：新表 `credit_ledger`（流水账）**，余额由流水求和，不存单独余额列（防并发丢失）。

```sql
CREATE TABLE credit_ledger (
    entry_id             UUID PRIMARY KEY,
    account_id           UUID NOT NULL REFERENCES accounts(account_id),
    kind                 TEXT NOT NULL CHECK (kind IN ('signin', 'spend', 'refund')),
    amount               INTEGER NOT NULL CHECK (amount <> 0),  -- signin/refund 正，spend 负
    balance_after        INTEGER NOT NULL,
    signin_date          DATE NULL,       -- 仅 signin 条目非空（UTC+8 日期）
    generation_session_id UUID NULL,      -- 仅 spend/refund 条目非空，用于退款关联
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 签到唯一：同账号同 UTC+8 日期只能一条
CREATE UNIQUE INDEX credit_ledger_signin_unique
    ON credit_ledger (account_id, signin_date) WHERE kind = 'signin';
```

**数值**（写死常量，后续可调）：
- 签到：随机 2-5 分（getrandom 取随机字节，不新增 rand 依赖）
- 生成一棵树：固定 3 分

**签到**：`POST /api/credit/signin`（require_mutation_identity）
- UTC+8 日期（`created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'`）唯一，同一天重复签 → 409 `credit.already_signed_in`
- 成功：INSERT signin 条目（amount 2-5，balance_after 当前余额 + amount），返回 `{ balance, awarded }`

**生成扣费改造**（tree_generation_store.rs `reserve_platform_session` 事务内）：
1. 现有逻辑算 `grants_available`（已锁 accounts 行）
2. `grants_available > 0` → 免费路径（现有逻辑不变，不碰积分）
3. `grants_available <= 0` → 积分路径：同一事务内 `SELECT COALESCE(SUM(amount),0) FROM credit_ledger WHERE account_id=$1` 求余额，`< 3` 抛 `EntitlementExhausted`（复用现有错误，前端显示积分不足消息）；`>= 3` → INSERT spend 条目（amount -3，balance_after 扣后值，generation_session_id 关联）→ 继续现有 reserve 流程
4. **退款**：usage 变 `released`（`fail_platform_initial_planning` / `platform_failed`）时，若该 session 有 spend 条目 → INSERT refund 条目（amount +3，generation_session_id 关联）。与 grants 的 reserved→released 释放语义一致（reserved 即占用额度）。

**新注册用户送 3 次免费**：invitation claim / 注册触发 grant 发放处，改为固定发 3 次（`source_kind='invite_activation'`，忽略批次 grant_count）。现有 19 账号不动。

**API 汇总**

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /api/credit/me | 登录（GET 无 CSRF） | `{ balance, signedInToday, freeRemaining, pricePerTree }` |
| POST | /api/credit/signin | 登录+CSRF | 返回 `{ balance, awarded }`，重复 409 |
| GET | /api/admin/accounts | 管理员 | 已有，AccountsTab 补积分余额列 |

**管理端**：AccountsTab 加「积分余额」列（credit_ledger 求和，join 子查询）。管理员手动调积分（admin_adjust）**范围外**（雏形不做）。

### B. 反馈系统

```sql
CREATE TABLE user_feedback (
    feedback_id UUID PRIMARY KEY,
    account_id  UUID NOT NULL REFERENCES accounts(account_id),
    content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `POST /api/feedback`（require_mutation_identity，body `{ content }`，201）→ 前端右下角悬浮按钮 + Dialog 文本域
- `GET /api/admin/feedback?limit=&offset=`（管理员）→ `{ items, total }`，items 含用户名（join accounts）
- 管理面板新增「反馈」Tab：列表（用户名 + 内容 + 时间），分页

### C. 公告系统

```sql
CREATE TABLE announcements (
    announcement_id UUID PRIMARY KEY,
    title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
    content         TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 5000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE announcement_reads (
    account_id       UUID NOT NULL REFERENCES accounts(account_id),
    announcement_id  UUID NOT NULL REFERENCES announcements(announcement_id),
    read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, announcement_id)
);
```

- `GET /api/announcements`（登录）→ `{ items: [...], unreadIds: [...] }`（items 按 created_at 倒序；unreadIds 该账号未读的 id 列表）
- `POST /api/announcements/{id}/read`（登录+CSRF）→ 204（幂等，重复标记无害）
- `POST /api/admin/announcements`（管理员）`{ title, content }` → 201
- `DELETE /api/admin/announcements/{id}`（管理员）→ 204
- `GET /api/admin/announcements`（管理员）→ 列表（含每则已读人数）

**前端**：
- 登录后（session 从 null → 非 null）`AnnouncementProvider`（react-query）查未读 → 有未读弹 Dialog 逐条/列表展示 → 「知道了」逐条标记已读
- 导航区常驻「公告」按钮（IdentityAccess 附近）→ 列表 Dialog（全部公告含已读，倒序）
- 管理面板新增「公告」Tab：列表 + 新建（标题/内容）+ 删除

### D. 前端总览

- `src/features/credit/`：creditClient.ts + types.ts（me/signin）
- `src/features/feedback/`：feedbackClient.ts + types.ts（submit）
- `src/features/announcements/`：announcementsClient.ts + types.ts + AnnouncementProvider.tsx + AnnouncementDialog.tsx + AnnouncementsDialog.tsx（全部列表）
- 积分展示：IdentityAccess 区域加「积分 X · 签到」按钮（点击签到，成功后刷新 + 轻提示）；TreeGenerationDialog 平台模式显示免费剩余 / 积分余额（免费用尽时显示「需 3 积分」）
- 反馈按钮：右下角固定悬浮（z-40，低于 Dialog 的 z-50），public/personal 视图显示
- AdminPanel.tsx：TABS 加 `feedback` | `announcements`，新增 FeedbackTab.tsx / AnnouncementsTab.tsx（仿 AccountsTab 模式）

## 风险与缓解

- **积分并发超卖**：spend 与 balance 校验在 `reserve_platform_session` 同一事务内（已持 accounts 行 FOR UPDATE），同账号串行，无超卖。
- **退款遗漏**：spend 条目带 generation_session_id，released 时按关联退；触发器已有一次性流转保证每条 usage 只 released 一次。
- **UTC+8 日界**：signin_date 用 `AT TIME ZONE 'Asia/Shanghai'` 计算（服务器时区无关）。
- **老账号无免费额度**：直接走积分路径（0 分则拒绝），符合现状不迁移。

## 验证方式

- 后端：`cargo test`（签到唯一/随机范围 2-5、免费优先不扣分、免费尽扣 3 分、余额不足拒绝、planning 失败退款、反馈写入、公告未读/已读、新注册送 3 次）
- 前端：`npm test`（签到按钮、反馈弹窗、公告弹窗/列表、admin 新 Tab）
- 端到端：push 自动部署后 curl 验证（signin 200/重复 409、me 字段、feedback 201、公告 unread/read、admin 列表）+ 浏览器验收
- 数值验证：签到 10 次分布落在 2-5；生成 3 次免费 + 积分流程人工走一遍

## 范围外（明确不做）

- 管理员手动调整积分（admin_adjust）
- 连续签到奖励 / 积分历史页 / 积分过期
- 公告富文本 / 图片 / 定时发布
- 反馈回复 / 状态流转（只看不回复）
- Agent 重构聊天系统（独立大功能，另行开分支）
