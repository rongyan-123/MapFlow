import { usePublication } from '../../domains/maps/usePublication';
import { describePublicError } from '../../lib/publicErrors';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
export default function PublicationDialog({libraryEntryId,title,csrfToken,onClose}:{libraryEntryId:string;title:string;csrfToken:string;onClose:()=>void}){
  const {status,prepared,prepare,execute}=usePublication(libraryEntryId,csrfToken,onClose);
  const busy=prepare.isPending||execute.isPending;
  const error=status.error??prepare.error??execute.error;
  return <Dialog title="公开技能树" onClose={onClose} dismissible={!busy}><div className="mf-stack"><h3>{title}</h3>
    {status.isPending?<p role="status" className="mf-status">正在读取公开状态…</p>:prepared?<><div className="mf-status"><p>发布者：<strong>{prepared.publisher_display_name}</strong></p><p>源版本：v{prepared.source_revision} · {prepared.node_count} 节点 · {prepared.edge_count} 条边 · {prepared.block_count} 个分组</p><p>不会公开：{prepared.excludes.join('、')}</p></div><p className="mf-muted mf-small">{prepared.action==='unpublish'?'确认后当前公共副本会立即下架。':'确认后会创建独立快照；以后私人修改不会自动进入公共书库。'}</p><Button variant={prepared.action==='unpublish'?'danger':'primary'} disabled={busy} onClick={()=>execute.mutate()}>{execute.isPending?'处理中…':prepared.action==='unpublish'?'确认取消公开':prepared.action==='update'?'确认更新公共副本':'确认公开到公共池'}</Button></>:status.data?<><p className="mf-muted">{status.data.is_public?'你可以更新为当前版本，或取消公开。':'公开后，其他用户可以浏览并复制这张地图，页面会显示你的用户名作为发布者。'}</p><div className="mf-row mf-wrap"><Button variant="primary" disabled={busy} onClick={()=>prepare.mutate(false)}>{status.data.is_public?'预览更新内容':'预览公开内容'}</Button>{status.data.is_public && <Button variant="danger" disabled={busy} onClick={()=>prepare.mutate(true)}>取消公开</Button>}</div></>:null}
    {error && <p role="alert" className="mf-status mf-status--error">{describePublicError(error)}</p>}
  </div></Dialog>;
}
