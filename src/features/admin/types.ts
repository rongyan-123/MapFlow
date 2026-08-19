export interface AdminDashboard {
  registeredAccounts: number;
  availableInvites: number;
  redeemedInvites: number;
  revokedInvites: number;
  activeSessions: number;
  platformConsumedUsages: number;
  platformConsumedTokens: number;
  loginTrend7d: { date: string; activeAccounts: number }[];
}

export interface AdminAccount {
  accountId: string;
  username: string;
  status: string;
  registeredAt: string;
  lastSeenAt: string | null;
  byokSessions: number;
  platformSessions: number;
  totalTokens: number;
}

/** 绝不包含邀请码明文或摘要字段（后端响应类型编译期保证）。 */
export interface AdminInvitation {
  inviteId: string;
  status: string;
  createdAt: string;
  claimedIp: string | null;
  claimedAt: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
}

export interface AdminAuditEvent {
  eventId: string;
  eventType: string;
  outcome: string;
  playerId: string | null;
  occurredAt: string;
}

/** 审计日志筛选条件；发给后端时映射为 snake_case 查询参数。 */
export interface AuditFilter {
  eventType?: string;
  /** RFC3339 起止时间（可选）。 */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
