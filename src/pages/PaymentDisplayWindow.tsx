import type { MutableRefObject } from 'react';
import type { PaymentChannel } from '../api/walletClient';
import { usePaymentDisplay } from '../domains/wallet/usePaymentDisplay';
import { Button } from '../ui/Button';

export default function PaymentDisplayWindow(props: {topupId:string;channel:PaymentChannel;csrfToken:string;releasePending?:MutableRefObject<Promise<void>>}) {
  const {display,error,remaining,retry} = usePaymentDisplay(props);
  const retryButton = <Button onClick={retry}>重新排队</Button>;
  if(error) return <div className="mf-stack"><p role="alert" className="mf-status mf-status--error">{error}</p>{retryButton}</div>;
  if(!display) return <p role="status" className="mf-status">正在申请展示窗口…</p>;
  if(display.status==='waiting') return <div role="status" className="mf-status"><p>当前有人正在充值，请稍候</p><p>前方还有 {display.position} 人，每人最多展示 20 秒，轮到你后自动显示。</p></div>;
  if(display.status==='active' && display.imageUrl && remaining>0) return <div className="mf-stack"><p role="status" className="mf-pill mf-pill--green">本次展示剩余 {remaining} 秒</p><img className="mf-payment-qr" src={display.imageUrl} alt={`${props.channel==='wechat' ? '微信' : '支付宝'}收款码`} /><small className="mf-muted">展示结束后可重新排队。已扫码请在订单有效期内按指定金额付款，到账会自动更新。</small></div>;
  if(display.status==='finished') return <p role="status" className="mf-status">本次展示已结束，正在更新订单状态…</p>;
  return <div className="mf-stack"><p role="status">展示时间已结束</p><small className="mf-muted">已扫码可继续按指定金额付款，无需重复创建订单。</small>{retryButton}</div>;
}
