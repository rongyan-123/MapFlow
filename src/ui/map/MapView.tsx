import { useEffect,useState } from 'react';
import type { LearningTreeSnapshot,TreeLayoutMode,TreeDisplayMode } from '../../types/learning';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import MapCanvas from './MapCanvas';
import NodeDetails from './NodeDetails';
import NodeNoteDialog from './NodeNoteDialog';
import { describePublicError } from '../../lib/publicErrors';

interface Props{snapshot:LearningTreeSnapshot;displayMode:TreeDisplayMode;accountId:string;entryId?:string;csrfToken?:string;initialNodeId?:string;initialLayout?:TreeLayoutMode;onLearn?:(node?:{id:string;title:string})=>void;onSetCompleted?:(nodeId:string,completed:boolean)=>void;onSetProgress?:(nodeId:string,percent:number)=>void;progressPending?:boolean;completionPending?:boolean;error?:unknown}
export default function MapView({snapshot,displayMode,accountId,entryId,csrfToken,initialNodeId,initialLayout,onLearn,onSetCompleted,onSetProgress,progressPending,completionPending,error}:Props) {
  const [layout,setLayout]=useState<TreeLayoutMode>(initialLayout??'relationship');const [selectedId,setSelectedId]=useState<string|null>(initialNodeId??null);
  const [noteOpen,setNoteOpen]=useState(false);
  useEffect(()=>{setSelectedId(initialNodeId??null);setLayout(initialLayout??'relationship');setNoteOpen(false);},[snapshot.tree.id,initialNodeId,initialLayout]);
  const selected=snapshot.nodes.find(node=>node.id===selectedId);
  return <div className="mf-map-view"><div className="mf-map-controls"><Button className="mf-block-sort-button" variant={layout==='blocks'?'primary':'secondary'} aria-pressed={layout==='blocks'} title={layout==='blocks'?'再次点击恢复知识关系':'按学习块整理地图节点'} onClick={()=>setLayout(previous=>previous==='blocks'?'relationship':'blocks')}>按块排序</Button><span className="mf-muted mf-small">{snapshot.nodes.length} 个节点 · {layout==='blocks'?(snapshot.node_block_assignments?.length?'再次点击恢复知识关系':'暂无节点分组，仍显示知识关系'):'点击节点查看内容'}</span></div>{Boolean(error) && <p role="alert" className="mf-status mf-status--error">{describePublicError(error)}</p>}<div className="mf-map-canvas">{snapshot.nodes.length ? <MapCanvas snapshot={snapshot} displayMode={displayMode} layoutMode={layout} selectedNodeId={selectedId} onSelectNode={setSelectedId} isGraphVisible viewportStorageKey={`mapflow.map-viewport.v1.${accountId}.${snapshot.tree.id}`} />:<p className="mf-empty">这张地图还没有节点。</p>}</div>{selected && (noteOpen && entryId && csrfToken ? <NodeNoteDialog accountId={accountId} libraryEntryId={entryId} nodeId={selected.id} nodeTitle={selected.title} csrfToken={csrfToken} onClose={()=>setNoteOpen(false)} />:<Dialog title={selected.title} onClose={()=>setSelectedId(null)}><NodeDetails snapshot={snapshot} selectedNodeId={selected.id} displayMode={displayMode} onSetCompleted={onSetCompleted} onSetProgress={onSetProgress} progressPending={progressPending} completionPending={completionPending} onOpenChat={onLearn?()=>onLearn({id:selected.id,title:selected.title}):undefined} onOpenNote={entryId&&csrfToken?()=>setNoteOpen(true):undefined} /><Button variant="quiet" onClick={()=>setSelectedId(null)}>返回地图</Button></Dialog>)}</div>;
}
