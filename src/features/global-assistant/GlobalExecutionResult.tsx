import type {AgentCompletion} from '../../api/agentExecutionClient';
import {formatAmountMicros} from '../../api/walletClient';
import {formatCreditAmount} from '../../api/creditClient';
import type {Navigate} from '../../app/useLocation';
import AgentMapResults from '../../ui/conversation/AgentMapResults';
import KnowledgeSources from './KnowledgeSources';

export default function GlobalExecutionResult({completion,accountId,csrfToken,navigate}:{completion:AgentCompletion;accountId:string;csrfToken:string;navigate:Navigate}){
  const {settlement}=completion;
  const pending=['pending_evidence','pending_posting'].includes(settlement.status);
  const fee=pending?'结果已保存，费用待核对。':settlement.cashMicros!==null?`本次费用 ¥${formatAmountMicros(settlement.cashMicros)}`:
    settlement.pointUnits!==null?`本次消耗 ${formatCreditAmount(settlement.pointUnits/1_000_000)} 积分`:'未扣本站额度。';
  return <div data-execution-id={completion.executionId}>
    <AgentMapResults completion={completion} accountId={accountId} csrfToken={csrfToken} onNavigate={navigate} />
    <KnowledgeSources executionId={completion.executionId} accountId={accountId} />
    <details className="mf-usage"><summary>{fee} <span>用量明细</span></summary>{completion.usage&&<p>输入 {completion.usage.inputTokens} · 输出 {completion.usage.outputTokens} Token</p>}{settlement.balanceMicros!==null&&<p>现金余额 ¥{formatAmountMicros(settlement.balanceMicros)}</p>}</details>
  </div>;
}
