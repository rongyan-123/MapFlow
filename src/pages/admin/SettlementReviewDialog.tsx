import { useId, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewAgentSettlement, type AgentSettlementAttention, type AgentSettlementReviewInput } from '../../api/agentModelClient';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { describePublicError } from '../../lib/publicErrors';

interface Props {
  accountId: string;
  csrfToken: string;
  record: AgentSettlementAttention;
  onClose: () => void;
}

export default function SettlementReviewDialog({ accountId, csrfToken, record, onClose }: Props) {
  const [note, setNote] = useState('');
  const formId = useId();
  const [attentionKey, setAttentionKey] = useState(record.attentionKey);
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(false);
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: (action: AgentSettlementReviewInput['action']) => reviewAgentSettlement(record.executionId, { action, expectedAttentionKey: attentionKey, ...(action === 'acknowledge_audit' ? { note: note.trim() } : {}) }, csrfToken),
    onSuccess: result => {
      if (result.attentionKey) setAttentionKey(result.attentionKey);
      return client.invalidateQueries({ queryKey: ['admin', accountId, 'agent-settlements'] });
    },
  });
  function submit(action: AgentSettlementReviewInput['action']) {
    if (submission.current || (action === 'acknowledge_audit' && !note.trim())) return;
    submission.current = true; setSubmitting(true);
    review.mutate(action, { onSettled: () => { submission.current = false; setSubmitting(false); } });
  }
  const busy = submitting || review.isPending;
  const editable = !review.data || review.data.outcome === 'pending';
  return <Dialog title="核对执行记录" className="mf-settlement-review" onClose={onClose} dismissible={!busy}
    footer={editable && record.status === 'audit_only' && <Button form={formId} type="submit" variant="primary" disabled={!note.trim() || busy}>确认已核对，归档本次提醒</Button>}>
    <div className="mf-stack">
      <p className="mf-small">执行：{record.executionId}</p>
      <p className="mf-small">资金通路：{record.funding === 'byok' ? '用户自带 Key（BYOK）' : record.funding === 'cash' ? '现金额度' : '平台积分'}{record.status === 'audit_only' && ' · 仅审计，本站不扣费'}</p>
      <p role={review.data ? 'status' : undefined} className="mf-status">{review.data?.reason ?? record.reason}</p>
      {editable && <>
        <Button disabled={busy} onClick={() => submit('recheck')}>重新核对已有证据</Button>
        {record.status === 'audit_only' && <form id={formId} className="mf-stack" onSubmit={event => { event.preventDefault(); submit('acknowledge_audit'); }}>
          <p className="mf-small">归档只记录你的复核，不改变上游结果或费用。新证据到达后会重新提醒。</p>
          <label className="mf-field">核对说明<textarea rows={4} maxLength={2000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="说明核对依据及仍待确认的上游情况" /></label>
        </form>}
      </>}
      {review.error && <div className="mf-stack"><p role="alert" className="mf-status mf-status--error">{describePublicError(review.error)}</p><Button disabled={busy} onClick={() => { void client.invalidateQueries({ queryKey: ['admin', accountId, 'agent-settlements'] }); onClose(); }}>重新读取记录</Button></div>}
    </div>
  </Dialog>;
}
