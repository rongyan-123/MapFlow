import { useState } from 'react';
import { useIdentity } from '../domains/identity/IdentityContext';
import { usePersonalCatalog } from '../domains/maps/useMapCatalog';
import { useMapActions } from '../domains/maps/useMapActions';
import { snapshotFromGraph } from '../domains/maps/snapshotFromGraph';
import { describePublicError } from '../lib/publicErrors';
import type { Navigate } from '../app/useLocation';
import { PageHeader } from '../ui/PageHeader';
import { Button,IconButton } from '../ui/Button';
import { MapCard } from '../ui/MapCard';
import MapView from '../ui/map/MapView';
import MapManageDialog from '../ui/map/MapManageDialog';

export default function MapsPage({navigate,entryId}:{navigate:Navigate;entryId?:string}) {
  const {session}=useIdentity();const {catalog,detail,owned}=usePersonalCatalog(session?.account.playerId,entryId);const [search,setSearch]=useState('');
  const [manageOpen,setManageOpen]=useState(false);
  const actions=useMapActions({accountId:session?.account.playerId??'',csrfToken:session?.csrfToken??'',entryId:owned?entryId:undefined,onDeleted:()=>navigate('/maps'),onLearning:(area,node)=>{const search=new URLSearchParams({area:area.areaId});if(node){search.set('node',node.id);search.set('title',node.title);}navigate(`/learning?${search}`);}});
  const entries=(catalog.data?.entries??[]).filter(entry=>`${entry.tree.title} ${entry.tree.topic}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><PageHeader title={entryId ? detail.data?.graph.tree.title??'我的地图':'我的地图'} actions={entryId?<><IconButton icon="back" label="返回地图列表" onClick={()=>navigate('/maps')} /><Button variant="primary" disabled={!owned||actions.learning.isPending} onClick={()=>actions.openLearning()}>进入学习</Button><IconButton icon="more" label="管理地图" disabled={!detail.data} onClick={()=>setManageOpen(true)} /></>:<Button variant="primary" onClick={()=>navigate('/assistant')}>创建地图</Button>} />
    {actions.learning.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(actions.learning.error)}</p>}
    {entryId && owned ? <>{detail.isPending && <p role="status" className="mf-status">正在读取地图…</p>}{detail.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(detail.error)} <Button onClick={()=>void detail.refetch()}>重试读取地图</Button></p>}{detail.data && !detail.error && <MapView snapshot={snapshotFromGraph(detail.data.graph,detail.data.completed_node_ids,detail.data.node_progress)} displayMode="personal" accountId={session!.account.playerId} entryId={entryId} csrfToken={session!.csrfToken} onLearn={node=>actions.openLearning(node)} onSetCompleted={(nodeId,completed)=>actions.completion.mutate({nodeId,completed})} onSetProgress={(nodeId,percent)=>actions.progress.mutate({nodeId,percent})} completionPending={actions.completion.isPending} progressPending={actions.progress.isPending} error={actions.completion.error??actions.progress.error} />}{manageOpen && detail.data && <MapManageDialog detail={detail.data} accountId={session!.account.playerId} csrfToken={session!.csrfToken} actions={actions} onClose={()=>setManageOpen(false)} />}</> : <div className="mf-content"><main className="mf-page">
      <div className="mf-page-heading"><div><p className="mf-eyebrow">YOUR LEARNING MAPS</p><h1>你的方向，慢慢清晰。</h1><p>地图、笔记与学习进度，都留在这里。</p></div></div>
      {entryId && catalog.data && !owned && <p role="alert" className="mf-status mf-status--warning">当前账号找不到这张地图。</p>}
      <label className="mf-field mf-catalog-search"><span className="mf-sr-only">搜索我的地图</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索我的学习地图" /></label>
      {catalog.isPending && <p role="status" className="mf-status">正在读取我的地图…</p>}{catalog.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(catalog.error)} <Button onClick={()=>void catalog.refetch()}>重新读取我的地图</Button></p>}
      {catalog.data && !catalog.error && (!catalog.data.entries.length ? <div className="mf-empty"><h2>第一张地图，从你的目标开始。</h2><p>告诉助手你想学什么，或从公共书库选择一条路线。</p><div className="mf-row mf-wrap mf-empty-actions"><Button variant="primary" onClick={()=>navigate('/assistant')}>和助手创建地图</Button><Button onClick={()=>navigate('/library')}>浏览公共书库</Button></div></div>:<div className="mf-grid mf-grid--3">{entries.map(entry=><MapCard key={entry.library_entry_id} tree={entry.tree} progress={entry.progress_percent??Math.round(entry.completed_nodes/Math.max(1,entry.tree.total_nodes)*100)} onOpen={()=>navigate(`/maps?entry=${encodeURIComponent(entry.library_entry_id)}`)} onLearn={()=>actions.openLearning(undefined,entry.library_entry_id)} />)}{!entries.length && <p className="mf-empty">没有找到匹配的地图。</p>}</div>)}
    </main></div>}
  </>;
}
