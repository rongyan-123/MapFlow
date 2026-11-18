import {useEffect,useRef,useState} from 'react';
import {useIdentity} from '../domains/identity/IdentityContext';
import {useLearningWorkspace} from '../domains/learning/useLearningWorkspace';
import {useMapActions} from '../domains/maps/useMapActions';
import {snapshotFromGraph} from '../domains/maps/snapshotFromGraph';
import type {Navigate} from '../app/useLocation';
import {describePublicError} from '../lib/publicErrors';
import {Button,IconButton} from '../ui/Button';
import MapView from '../ui/map/MapView';
import SceneWorkspace from './SceneWorkspace';
import MapsPage from './MapsPage';
import {LearningResources} from '../ui/map/LearningResources';
interface Props{navigate:Navigate;areaId?:string;node?:{id:string;title:string}}
export default function LearningPage({navigate,areaId,node}:Props){
  const [panelTab,setPanelTab]=useState<'chat'|'notes'|'plan'>('chat');
  const [selectedNode,setSelectedNode]=useState(node);
  const toolbarHost=useRef<HTMLDivElement>(null);
  const {session}=useIdentity();const [overview,setOverview]=useState(false);
  const accountId=session?.account.playerId??'';const csrfToken=session?.csrfToken??'';const workspace=useLearningWorkspace(accountId,csrfToken,areaId);const {area,maps,areas}=workspace;
  useEffect(()=>{setSelectedNode(node);setPanelTab('chat');setOverview(false);},[accountId,area?.areaId]);
  useEffect(()=>{if(area&&!areaId){const query=new URLSearchParams(window.location.search);query.set('area',area.areaId);navigate(`/learning?${query}`,true);}},[area?.areaId,areaId,navigate]);
  useEffect(()=>{if(!area?.available)return;try{if(localStorage.getItem(`mapflow.ui.map.v1.${accountId}.${area.areaId}`)===null&&window.innerWidth>=1180)workspace.setMapVisible(true);}catch{/* Keep the default when storage is unavailable. */}},[area?.areaId]);
  const actions=useMapActions({accountId,csrfToken,entryId:area?.available?area.libraryEntryId:undefined,onLearning:()=>{},onDeleted:()=>{}});
  function select(id:string|null){workspace.select(id);navigate(id?`/learning?area=${encodeURIComponent(id)}`:'/maps');}
  function reference(node?:{id:string;title:string}){if(!area||!node)return;setSelectedNode(node);setPanelTab('chat');if(window.innerWidth<1180)workspace.setMapVisible(false);navigate(`/learning?${new URLSearchParams({area:area.areaId,node:node.id,title:node.title})}`);}
  const resourceFailure=maps.catalog.error??maps.detail.error;
  const resources=resourceFailure?<p role="alert" className="mf-status">{describePublicError(resourceFailure)} <Button onClick={()=>{void maps.catalog.refetch();void maps.detail.refetch();}}>重试读取地图</Button></p>
    :!area?.available||maps.catalog.isSuccess&&!maps.owned?<p role="status">地图不可用，已保存的对话仍在“对话”中。</p>
    :maps.detail.data&&panelTab!=='chat'?<LearningResources tab={panelTab} accountId={accountId} entryId={area.libraryEntryId} csrfToken={csrfToken} snapshot={snapshotFromGraph(maps.detail.data.graph,maps.detail.data.completed_node_ids,maps.detail.data.node_progress)} selectedNodeId={selectedNode?.id} onSelectNode={setSelectedNode} />
    :<p role="status">正在读取地图资料…</p>;
  if(!session)return null;
  if(area)return <SceneWorkspace key={`${accountId}.${area.areaId}`} owner={{accountId,csrfToken,userName:session.account.username,scene:'learning',areaId:area.areaId,available:area.available}} navigate={navigate} panelTabs={<div role="tablist" aria-label="学习面板" className="mf-learning-tabs">{([['chat','对话'],['notes','笔记'],['plan','计划']] as const).map(([id,label])=><Button role="tab" aria-selected={panelTab===id} key={id} onClick={()=>{setPanelTab(id);if(window.innerWidth<1180)workspace.setMapVisible(false);}}>{label}</Button>)}</div>} panelContentActive={panelTab!=='chat'} panelContent={resources} headerTools={workspace.mapVisible?<div ref={toolbarHost} className="mf-header-map-tools" />:undefined} headerContext={<span className="mf-learning-map-title">{area.title}</span>} headerLeading={<IconButton icon="back" label="返回我的学习" onClick={()=>select(null)} />} headerExtra={area.available&&<>{!workspace.mapVisible&&<Button aria-pressed={workspace.mapVisible&&overview} onClick={()=>{setOverview(true);workspace.setMapVisible(true);}}>知识总览</Button>}<IconButton icon="map" label={workspace.mapVisible?'返回学习聊天':'查看学习地图'} onClick={()=>{setOverview(false);workspace.setMapVisible(!workspace.mapVisible);}} /></>} mapVisible={workspace.mapVisible} onOpenCanvas={()=>workspace.setMapVisible(false)} nodeReference={node} onNodeReferenceConsumed={()=>navigate(`/learning?area=${encodeURIComponent(area.areaId)}`,true)} mapPane={<>{maps.detail.isPending?<p role="status" className="mf-status">正在读取学习地图…</p>:maps.detail.error?<p role="alert" className="mf-status mf-status--error">{describePublicError(maps.detail.error)} <Button onClick={()=>void maps.detail.refetch()}>重试</Button></p>:maps.detail.data&&<MapView onNodeSelect={setSelectedNode} overviewVisible={overview} onOverviewChange={setOverview} isVisible={workspace.mapVisible} toolbarHostRef={toolbarHost} snapshot={snapshotFromGraph(maps.detail.data.graph,maps.detail.data.completed_node_ids,maps.detail.data.node_progress)} displayMode="personal" accountId={accountId} entryId={area.libraryEntryId} csrfToken={csrfToken} onLearn={reference} onSetBatchProgress={actions.saveProgressBatch} onCancelBatchProgress={actions.cancelProgressBatch} onSetCompleted={(nodeId,completed)=>actions.completion.mutateAsync({nodeId,completed})} onSetProgress={(nodeId,percent)=>actions.progress.mutateAsync({nodeId,percent})} progressPending={actions.progress.isPending} completionPending={actions.completion.isPending} error={actions.progress.error??actions.completion.error} />}</>} />;
  return <><MapsPage navigate={navigate} />{areaId&&areas.isSuccess&&!area&&<p role="alert" className="mf-status">当前账号找不到这个学习区，请重新选择。</p>}</>;
}
