import { useState } from 'react';
import type { PersonalTreeDetail } from '../../domains/maps/types';
import type { useMapActions } from '../../domains/maps/useMapActions';
import { downloadTreeExport } from '../../domains/maps/treeExport';
import { describePublicError } from '../../lib/publicErrors';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
import PublicationDialog from './PublicationDialog';
import RestoreControl from './RestoreControl';
export default function MapManageDialog({detail,accountId,csrfToken,actions,onClose}:{detail:PersonalTreeDetail;accountId:string;csrfToken:string;actions:ReturnType<typeof useMapActions>;onClose:()=>void}){
  const [action,setAction]=useState<'menu'|'rename'|'delete'|'publish'|'export'|'restore'>('menu');const [title,setTitle]=useState(detail.graph.tree.title);const [validation,setValidation]=useState<string|null>(null);
  const pending=actions.rename.isPending||actions.removal.isPending;
  if(action==='publish')return <PublicationDialog libraryEntryId={detail.library_entry_id} title={detail.graph.tree.title} csrfToken={csrfToken} onClose={onClose} />;
  if(action==='restore')return <RestoreControl accountId={accountId} libraryEntryId={detail.library_entry_id} csrfToken={csrfToken} initialOpen onClosed={onClose} />;
  const error=validation??(actions.rename.error||actions.removal.error?describePublicError(actions.rename.error??actions.removal.error):null);
  return <Dialog title={action==='rename'?'重命名地图':action==='delete'?'删除地图':action==='export'?'导出地图':'管理地图'} onClose={onClose} dismissible={!pending}><div className="mf-stack"><h3>{detail.graph.tree.title}</h3>
    {action==='menu'?<div className="mf-grid mf-grid--2"><Button onClick={()=>{actions.rename.reset();setAction('rename');}}>重命名</Button><Button onClick={()=>setAction('export')}>导出地图</Button><Button onClick={()=>setAction('publish')}>公开与发布</Button><Button onClick={()=>setAction('restore')}>恢复最近一次修改</Button><Button variant="danger" onClick={()=>{actions.removal.reset();setAction('delete');}}>删除地图</Button></div>:action==='rename'?<><label className="mf-field">新的地图名称<input maxLength={240} value={title} onChange={event=>{setTitle(event.target.value);setValidation(null);}} /></label><Button variant="primary" disabled={pending} onClick={()=>{if(!title.trim()){setValidation('名称不能为空。');return;}if(title.trim().length>240){setValidation('名称不能超过 240 个字符。');return;}void actions.rename.mutateAsync(title.trim()).then(onClose).catch(()=>{});}}>保存名称</Button></>:action==='delete'?<><p className="mf-status mf-status--warning">删除后，这张地图的学习进度、聊天历史和个人修改都会被移除，公共地图不受影响。</p><Button variant="danger" disabled={pending} onClick={()=>actions.removal.mutate()}>确认删除地图</Button></>:<><p className="mf-muted">导出当前的完整结构或学习清单。</p><Button onClick={()=>{downloadTreeExport(detail,'json');onClose();}}>下载 JSON（完整结构）</Button><Button onClick={()=>{downloadTreeExport(detail,'markdown');onClose();}}>下载 Markdown（便于阅读）</Button></>}
    {error && <p role="alert" className="mf-status mf-status--error">{error}</p>}
  </div></Dialog>;
}
