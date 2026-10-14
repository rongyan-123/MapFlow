import { describePublicError } from '../lib/publicErrors';
import { formatAmountMicros,formatFen,type LedgerEntry,type Topup } from '../api/walletClient';
import { useWallet } from '../domains/wallet/useWallet';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import PaymentDisplayWindow from './PaymentDisplayWindow';

const statusLabels: Record<Topup['status'],string> = {awaiting_payment:'待付款',awaiting_review:'待核实',closed_unpaid:'未付款关闭',credited:'已入账',rejected:'已拒绝',reversed:'已撤销'};
const ledgerLabels: Record<LedgerEntry['kind'],string> = {welcome:'一次性赠送',topup:'充值入账',adjustment:'额度调整',reversal:'撤销变动',usage:'模型消费'};

export default function WalletPage({accountId,csrfToken,onBack,onNavigateModels}:{accountId:string;csrfToken:string;onBack:()=>void;onNavigateModels:()=>void}) {
  const state=useWallet(accountId,csrfToken);
  const {wallet,activeTopup,choiceOpen,busy,error,paymentExpired}=state;
  return <>
    <PageHeader title="我的额度" actions={<Button variant="quiet" onClick={onNavigateModels}>模型价格</Button>} />
    <div className="mf-content"><main className="mf-page mf-stack">
      <div className="mf-page-heading"><div><h1>每一笔，都清清楚楚。</h1><p>查看额度、充值记录和模型消费。</p></div></div>
      {state.notice && <p role="status" className="mf-status">{state.notice}</p>}
      {wallet.isPending && <p role="status" className="mf-status">正在读取额度…</p>}
      {wallet.error && <div role="alert" className="mf-status mf-status--error">{describePublicError(wallet.error)} <Button onClick={()=>void wallet.refetch()}>重试读取额度</Button></div>}
      {wallet.data && !wallet.error && <>
        {wallet.data.qqGroup && wallet.data.topups.some(order=>order.status==='credited') && <p className="mf-status">可以加入 Q 群：{wallet.data.qqGroup}</p>}
        <div className="mf-grid mf-grid--2">
          <section className="mf-card mf-balance-card"><p className="mf-eyebrow">AVAILABLE BALANCE</p><h2>可用额度</h2><p className="mf-balance">{formatAmountMicros(wallet.data.balanceMicros)} 额度</p><small>1 元 = 1 额度。现金额度与学习积分分开记录。</small></section>
          <section className="mf-card mf-stack"><h2>充值申请</h2><p className="mf-muted">选择渠道，按订单显示的金额付款，收款确认后自动到账。</p>
            <div className="mf-grid mf-grid--2"><label className="mf-field">充值金额（元）<input inputMode="decimal" placeholder="例如 10.00" value={state.amount} onChange={event=>{state.setAmount(event.target.value);state.pendingCreate.current=null;}} /></label><label className="mf-field">付款渠道<select value={state.selectedChannel} onChange={event=>{if(event.target.value==='wechat'||event.target.value==='alipay')state.setChannel(event.target.value);state.pendingCreate.current=null;}}>{wallet.data.channels.map(channel=><option key={channel.channel} value={channel.channel}>{channel.label}</option>)}</select></label></div>
            <button type="button" ref={state.createButtonRef} className="mf-button mf-button--primary" disabled={busy||activeTopup!==null||!wallet.data.channels.length} onClick={()=>void state.create()}>{busy?'创建中…':'创建充值申请'}</button>
            {!wallet.data.channels.length && <p className="mf-status mf-status--warning">充值渠道暂未开放，请联系客服。</p>}
            <small className="mf-muted">预计 2–5 分钟到账。遇到问题请联系客服：{wallet.data.supportContact}</small>
          </section>
        </div>
        <section className="mf-card"><div className="mf-section-title"><h2>额度流水</h2><small className="mf-muted">每一笔变动都在这里</small></div>{!wallet.data.ledger.length ? <p className="mf-status">暂无流水</p> : <ul className="mf-records">{wallet.data.ledger.map(entry=><li key={entry.entryId} className="mf-record"><div><p>{ledgerLabels[entry.kind]} {entry.reversed && <span className="mf-pill">已撤销</span>}</p>{entry.note && entry.kind!=='usage' && <p className="mf-muted">{entry.note}</p>}<small className="mf-muted">{new Date(entry.createdAt).toLocaleString()}</small></div><div className="mf-record-amount"><p className={entry.amountMicros<0?'mf-negative':'mf-positive'}>{entry.amountMicros>0?'+':''}{formatAmountMicros(entry.amountMicros)} 额度</p><small className="mf-muted">余额 {formatAmountMicros(entry.balanceAfterMicros)} 额度</small></div></li>)}</ul>}</section>
        <section className="mf-card"><div className="mf-section-title"><h2>历史申请</h2></div>{!wallet.data.topups.length ? <p className="mf-status">暂无申请</p> : <ul className="mf-records">{wallet.data.topups.map(order=><li key={order.topupId} className="mf-record"><div><p>¥{formatFen(order.paymentAmountFen??order.amountFen)} · {order.channel==='wechat'?'微信':'支付宝'} <span className="mf-pill">{statusLabels[order.status]}</span></p><small className="mf-muted">{new Date(order.createdAt).toLocaleString()}</small>{order.reviewNote && <p>{order.reviewNote}</p>}<details className="mf-record-details"><summary>查看申请详情</summary><p>申请编号：{order.topupId}</p></details></div>{['awaiting_payment','closed_unpaid'].includes(order.status) && <Button onClick={event=>{state.paymentReturnFocusRef.current=event.currentTarget;state.setActiveTopup(order);state.setChoiceOpen(true);state.setError(null);}}>声明付款状态</Button>}</li>)}</ul>}</section>
      </>}
      {error && !activeTopup && <p role="alert" className="mf-status mf-status--error">{error}</p>}
      <button ref={state.backButtonRef} className="mf-text-action" onClick={onBack}>返回工作空间</button>
    </main></div>
    {activeTopup && <div ref={state.paymentDialogRef} role="dialog" aria-modal="true" aria-label="充值付款" aria-busy={busy} tabIndex={-1} className="mf-modal-layer mf-payment-layer">
      <section className="mf-dialog"><div className="mf-dialog-content mf-stack mf-payment-content">
        <h2>{activeTopup.paymentAmountFen ? `请支付 ¥${formatFen(activeTopup.paymentAmountFen)}`:`充值 ¥${formatFen(activeTopup.amountFen)}`}</h2>
        {activeTopup.paymentAmountFen && <p className="mf-status mf-status--warning">请按以上金额付款，实付金额将全部计入额度。{activeTopup.paymentAmountFen!==activeTopup.amountFen && '系统已调整金额以区分订单，请勿改回原金额。'}</p>}
        {activeTopup.paymentExpiresAt && <p className="mf-muted">{paymentExpired?'订单已过期，请关闭后重新创建，勿再扫码付款。':`请在 ${new Date(activeTopup.paymentExpiresAt).toLocaleTimeString()} 前付款`}</p>}
        <p>{activeTopup.channel==='wechat'?'微信':'支付宝'}</p>
        {!choiceOpen&&!paymentExpired && <PaymentDisplayWindow topupId={activeTopup.topupId} channel={activeTopup.channel} csrfToken={csrfToken} releasePending={state.paymentDisplayRelease} />}
        {error && <p role="alert" className="mf-status mf-status--error">{error}</p>}
        <div className="mf-row mf-wrap mf-payment-actions">{choiceOpen ? <><Button disabled={busy} variant="primary" onClick={()=>void state.declare(true)}>我已付款</Button><Button disabled={busy} onClick={()=>void state.declare(false)}>我没有付款</Button><Button disabled={busy} onClick={()=>state.setChoiceOpen(false)}>返回收款码</Button></> : <><Button onClick={()=>state.setChoiceOpen(true)}>关闭</Button>{state.paidExitVisible && <Button onClick={()=>state.setChoiceOpen(true)}>我已付款，点击退出</Button>}</>}</div>
      </div></section>
    </div>}
  </>;
}
