import type {PricingChannel} from '../../api/walletClient';
import {modelPriceRows} from '../../domains/wallet/pricePresentation';
export function ReferencePrices({channels}:{channels:readonly PricingChannel[]}) {
  const rows=modelPriceRows(channels);
  if(!rows.length)return <p className="mf-muted">价格暂时无法获取</p>;
  return <div className="mf-price-rows"><small className="mf-muted">参考价 · 每百万 Token</small><div role="list" aria-label="参考价格">{rows.map(row=><div role="listitem" className="mf-row mf-row--between" key={row.label}><span className="mf-muted">{row.label}</span><span className="mf-price">{row.amount}</span></div>)}</div></div>;
}
export function ReferencePriceNote(){return <p className="mf-muted mf-small">计费倍率 <strong>0.2</strong> · 上方为参考价，实际费用以本次账单为准。</p>;}
