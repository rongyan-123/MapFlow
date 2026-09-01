export interface AdminDashboard {
  registeredAccounts: number;
  availableInvites: number;
  redeemedInvites: number;
  revokedInvites: number;
  activeSessions: number;
  platformConsumedUsages: number;
  platformConsumedTokens: number;
  loginTrend7d: { date: string; activeAccounts: number }[];
  // v2 统计增强（与后端 AdminDashboard 响应 camelCase 一致）
  currentOnline: number;
  consecutive3dLogins: number;
  totalActiveMinutes: number;
  avgActiveMinutes: number;
  dailyConsumed7d: { date: string; consumed: number }[];
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
  // v2 统计增强
  platformConsumedUsages: number;
  activeMinutes: number;
  // 积分余额（T9：管理端列表新增列）
  creditBalance: number;
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

/** GET /api/admin/invitations 的汇总数字。 */
export interface AdminInvitationSummary {
  available: number;
  redeemed: number;
  revoked: number;
}

/** GET /api/admin/invitations 响应信封：汇总 + 列表。 */
export interface AdminInvitationsResponse {
  summary: AdminInvitationSummary;
  items: AdminInvitation[];
}

export interface AdminAuditEvent {
  eventId: string;
  eventType: string;
  outcome: string;
  playerId: string | null;
  occurredAt: string;
  /** JSONB 透出；键为 snake_case（如 `client_ip`），前端按原键读取。 */
  details: Record<string, unknown>;
}

/** GET /api/admin/audit-events 响应信封：事件列表 + 全量总数（含分页时）。 */
export interface AdminAuditEventsPage {
  events: AdminAuditEvent[];
  total: number;
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

export type RequestObservationOutcome =
  | 'succeeded'
  | 'rejected'
  | 'failed'
  | 'async_pending';

export type RequestStageId =
  | 'client'
  | 'edge_proxy'
  | 'router'
  | 'security_guard'
  | 'identity'
  | 'http_handler'
  | 'business_service'
  | 'database'
  | 'worker'
  | 'external_dependency'
  | 'response';

export type RequestStageStatus =
  | 'passed'
  | 'rejected'
  | 'failed'
  | 'pending'
  | 'not_reached'
  | 'not_applicable'
  | 'unobserved';

export type RequestStageOperationStatus = Extract<
  RequestStageStatus,
  'passed' | 'rejected' | 'failed' | 'pending'
>;

export type ObservationEvidence =
  | 'measured'
  | 'confirmed_header'
  | 'inferred'
  | 'not_observed';

export type RequestActorKind =
  | 'authenticated'
  | 'visitor'
  | 'identity_rejected'
  | 'unassociated';

export type RequestLifecycleDataStatus = 'current' | 'legacy_degraded' | 'corrupt';

export interface AdminRequestStageSummary {
  id: RequestStageId;
  status: RequestStageStatus;
  evidence: ObservationEvidence;
  durationMs: number | null;
}

export interface AdminRequestObservationSummary {
  requestId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  method: string;
  route: string;
  routeFamily: string;
  httpStatus: number;
  requestBytes: number | null;
  responseBytes: number | null;
  outcome: RequestObservationOutcome;
  summary: string;
  terminalStage: RequestStageId | null;
  errorCode: string | null;
  effectiveClientIp: string | null;
  accountId: string | null;
  username: string | null;
  correlationId: string | null;
  actorKind: RequestActorKind;
  lifecycleSchemaVersion: number;
  lifecycleDataStatus: RequestLifecycleDataStatus;
  stages: AdminRequestStageSummary[];
}

export interface AdminRequestStage {
  id: RequestStageId;
  title: string;
  location: string;
  status: RequestStageStatus;
  evidence: ObservationEvidence;
  explanation: string;
  startedOffsetMs: number | null;
  durationMs: number | null;
  technical: Record<string, unknown>;
  technicalTruncated: boolean;
  operations: AdminRequestStageOperation[];
  operationsTruncated: boolean;
}

export interface AdminRequestStageOperation {
  code: string;
  status: RequestStageOperationStatus;
  evidence: ObservationEvidence;
  startedOffsetMs: number;
  durationMs: number;
  explanation: string;
}

export interface AdminRequestObservation extends AdminRequestObservationSummary {
  peerIp: string | null;
  lifecycleSchemaVersion: number;
  redactionSchemaVersion: number;
  stages: AdminRequestStage[];
}

export interface RequestObservationDeliveryStatus {
  persistedSinceStart: number;
  queueDroppedSinceStart: number;
  writeFailedSinceStart: number;
  queued: number;
  capacity: number;
}

export interface AdminRequestObservationsPage {
  items: AdminRequestObservationSummary[];
  total: number;
  delivery: RequestObservationDeliveryStatus | null;
}

export interface RequestObservationFilter {
  outcome?: RequestObservationOutcome;
  routeFamily?: string;
  terminalStage?: RequestStageId;
  errorCode?: string;
  httpStatus?: number;
  requestId?: string;
  accountId?: string;
  effectiveClientIp?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** 单条用户反馈（GET /api/admin/feedback 列表项）。 */
export interface AdminFeedback {
  feedbackId: string;
  username: string;
  content: string;
  createdAt: string;
}

/** GET /api/admin/feedback 响应信封：列表 + 全量总数（供分页）。 */
export interface AdminFeedbackPage {
  items: AdminFeedback[];
  total: number;
}

/** 单条公告（GET /api/admin/announcements 列表项）。 */
export interface AdminAnnouncement {
  announcementId: string;
  title: string;
  content: string;
  createdAt: string;
  readCount: number;
}
