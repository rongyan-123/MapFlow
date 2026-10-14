import { useEffect,useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateTreeConnection } from '../../api/tavernClient';
import type { ConversationDetail } from '../../domains/conversations/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
export default function ToolSettings({detail,csrfToken,onUpdated,onConflict,onBusyChange,onCanvas}:{detail:ConversationDetail;csrfToken:string;onUpdated:(detail:ConversationDetail)=>void;onConflict:()=>void|Promise<void>;onBusyChange?:(busy:boolean)=>void;onCanvas:()=>void}){
  const entry=detail.conversation.scene==='learning'&&detail.conversation.libraryEntryId===detail.conversation.learningAreaId?detail.conversation.libraryEntryId:null;
  const [enabled,setEnabled]=useState(detail.conversation.treeToolsEnabled??false);
  const save=useMutation({mutationFn:()=>updateTreeConnection(detail.conversation.conversationId,detail.graph.revision,entry||null,enabled,csrfToken),onSuccess:onUpdated,onError:async failure=>{if('status' in failure&&failure.status===409)await onConflict();}});
  useEffect(()=>{onBusyChange?.(save.isPending);},[save.isPending,onBusyChange]);useEffect(()=>()=>onBusyChange?.(false),[onBusyChange]);
  return <div className="mf-stack">{entry?<><p className="mf-muted">工具只访问当前学习区的地图。可以搜索资料并提出修改，每次修改仍需你确认。</p><label className="mf-row"><input type="checkbox" checked={enabled} disabled={save.isPending} onChange={event=>setEnabled(event.target.checked)} />允许使用技能树工具</label>{save.error&&<p role="alert" className="mf-status mf-status--error">{describePublicError(save.error)}</p>}<Button variant="primary" disabled={save.isPending} onClick={()=>save.mutate()}>{save.isPending?'保存中…':'保存工具设置'}</Button></>:<p className="mf-status">{detail.conversation.scene==='management'?'全局助手可以规划地图、查看资料并提出修改。修改已有地图时会先请求确认。':'技能树工具在对应学习区使用。'}</p>}<hr className="mf-divider" /><h3>教学画布</h3><p className="mf-muted mf-small">手动绘图会自动保存到当前会话。画布内可以开启“允许 AI 绘图”，授权助手修改。</p><Button onClick={onCanvas}>打开教学画布</Button></div>;
}
