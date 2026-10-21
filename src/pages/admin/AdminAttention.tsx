import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readUpstreamBalance } from '../../api/walletClient';
import { fetchAgentSettlementAttention, type AgentSettlementAttention } from '../../api/agentModelClient';
import { Button } from '../../ui/Button';
import { QueryStatus } from '../../ui/QueryStatus';
import SettlementReviewDialog from './SettlementReviewDialog';

const fundingLabels = { byok: '用户自带 Key', cash: '现金额度', points: '平台积分' };
const settlementLabels: Record<string, string> = { audit_only: '仅审计（本站不扣费）', pending_evidence: '待补原始依据', pending_posting: '待入账', settled: '已结算', no_site_charge: '本站不扣费' };
const callLabels: Record<string, string> = { prepared: '准备中', dispatched: '已发送，结果待确认', outcome_unknown: '上游结果未知', completed: '已完成', not_executed: '未执行' };

export default function AdminAttention({ accountId, csrfToken }: { accountId: string; csrfToken: string }) {
  const [before, setBefore] = useState<string>();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<AgentSettlementAttention | null>(null);
  const upstream = useQuery({ queryKey: ['admin', accountId, 'upstream-balance'], queryFn: readUpstreamBalance, refetchInterval: 90_000, retry: false });
  const settlements = useQuery({ queryKey: ['admin', accountId, 'agent-settlements', before ?? null], queryFn: () => fetchAgentSettlementAttention(before), refetchInterval: 60_000, retry: false });
  const balance = upstream.data;
  const page = settlements.data;
  return <div className="mf-stack mf-admin-attention">
    {balance && balance.status !== 'disabled' && <p role={balance.status === 'exhausted' ? 'alert' : 'status'} className="mf-status">
      {balance.status === 'exhausted' ? '上游账号余额已耗尽，请补充余额。' : balance.status === 'unavailable' ? '暂时无法检测上游余额，将自动重试。' : `上游可用余额：$${balance.availableBalanceUsd} USD · 每 90 秒检查`}
    </p>}
    <QueryStatus error={upstream.error} retry={() => void upstream.refetch()} />
    <QueryStatus error={settlements.error} retry={() => void settlements.refetch()} />
    {!!page?.totalCount && <section className="mf-card mf-stack">
      <div className="mf-row mf-wrap"><strong>{page.totalCount} 笔记录待核对</strong><Button aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起待核对记录' : '查看待核对记录'}</Button></div>
      <p className="mf-muted mf-small">重新核对已有证据，或为已停止的请求留下复核说明；原始依据始终保留。</p>
      {open && <>
        <div className="mf-stack">{page.pending.map(execution => <article className="mf-card mf-stack" key={execution.executionId}>
          <h3>{execution.reason}</h3>
          <p className="mf-small">执行：{execution.executionId}</p>
          <p className="mf-small">账号：{execution.username?.trim() || '用户名暂不可用'} · {execution.accountId} · {fundingLabels[execution.funding]} · {settlementLabels[execution.status] ?? execution.status} · 最近核对 {execution.checkedAt ? new Date(execution.checkedAt).toLocaleString() : '尚未核对'}</p>
          {execution.calls.map(call => <div key={call.callId}>
            <strong className="mf-small">{call.callId} · {callLabels[call.status] ?? call.status}</strong>
            <p className="mf-small">{call.usage ? `输入 ${call.usage.inputTokens} · 输出 ${call.usage.outputTokens} Token` : '用量尚未提供'}</p>
            {call.receipts.map(receipt => <p className="mf-small" key={`${receipt.receiptId}:${receipt.amount}`}>{receipt.currency} {receipt.amount} · {receipt.receiptId} {receipt.validationError}</p>)}
          </div>)}
          <Button onClick={() => setReview(execution)}>核对这笔记录</Button>
          <details><summary>核对诊断</summary><pre>{JSON.stringify(execution.diagnostic, null, 2)}</pre></details>
        </article>)}</div>
        <div className="mf-row mf-wrap"><Button onClick={() => { setBefore(undefined); void settlements.refetch(); }}>返回最新记录</Button>{page.nextBefore && <Button onClick={() => setBefore(page.nextBefore!)}>下一页</Button>}</div>
      </>}
    </section>}
    {review && <SettlementReviewDialog key={`${review.executionId}.${review.attentionKey}`} accountId={accountId} csrfToken={csrfToken} record={review} onClose={() => setReview(null)} />}
  </div>;
}
