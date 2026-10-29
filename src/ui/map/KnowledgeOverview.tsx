import {useMemo,useState} from 'react';
import {progressPercentForNode,type LearningTreeSnapshot,type SkillBlock} from '../../types/learning';
import {analyzeDependencies} from '../../domains/maps/dependencies';
import type {SavedPlan} from '../../api/studyPlanClient';
import {Button} from '../Button';
import './overview.css';
interface Props{snapshot:LearningTreeSnapshot;onSelect:(nodeId:string)=>void;onPlan?:()=>void;plan?:SavedPlan|null;personal?:boolean}
export default function KnowledgeOverview({snapshot,onSelect,onPlan,plan,personal=true}:Props){
  const [search,setSearch]=useState('');const progress=new Map(snapshot.progress.map(item=>[item.node_id,progressPercentForNode(item)]));const nodes=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const structure=useMemo(()=>{
    const dependencies=analyzeDependencies(snapshot.nodes.map(node=>node.id),snapshot.edges);
    const assigned=new Map(snapshot.node_block_assignments?.map(item=>[item.node_id,item.block_id]));const blockIds=new Set(snapshot.blocks?.map(block=>block.id));
    const ordered=[...snapshot.nodes].sort((a,b)=>(dependencies.layers.get(a.id)??0)-(dependencies.layers.get(b.id)??0)||a.order_in_level-b.order_in_level||a.id.localeCompare(b.id));
    const groups=[...(snapshot.blocks??[])].sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id)).map(block=>({block,nodes:ordered.filter(node=>assigned.get(node.id)===block.id)}));
    const unassigned=ordered.filter(node=>!blockIds.has(assigned.get(node.id)??''));
    if(unassigned.length)groups.push({block:{id:'unassigned',name:'待归类知识点',sort_order:groups.length,color:null} as SkillBlock,nodes:unassigned});return {groups,dependencies};
  },[snapshot.nodes,snapshot.edges,snapshot.blocks,snapshot.node_block_assignments]);
  const query=search.trim().toLocaleLowerCase();const visible=structure.groups.map(group=>({...group,nodes:group.nodes.filter(node=>`${node.title} ${node.description??''}`.toLocaleLowerCase().includes(query))}));
  const schedule=new Map<string,{date:string;minutes:number;partIndex:number;partCount:number;focus:string}[]>();
  for(const day of plan?.days??[])for(const item of day.items){const entries=schedule.get(item.nodeId)??[];entries.push({date:day.date,minutes:item.estimatedMinutes,partIndex:item.partIndex,partCount:item.partCount,focus:item.focus});schedule.set(item.nodeId,entries);}
  return <article className="mf-knowledge-overview" aria-label="知识总览"><header className="mf-overview-heading"><div><p className="mf-eyebrow">KNOWLEDGE OVERVIEW</p><h1>{snapshot.tree.title}</h1><p>{snapshot.nodes.length} 个知识点{personal?` · 已完成 ${snapshot.nodes.filter(node=>progress.get(node.id)===100).length}`:''}</p></div>{onPlan&&<Button onClick={onPlan}>学习计划</Button>}</header><p className="mf-overview-scope"><b>学习范围：</b>{snapshot.tree.description||'这张地图尚未补充范围说明。'}</p>
    {plan&&<p className="mf-plan-summary">学习计划 · {plan.startDate} 至 {plan.deadline} · {plan.timezone}<br /><span>{plan.summary} · 时长为估计</span></p>}
    <label className="mf-field mf-overview-search"><span className="mf-sr-only">搜索知识点</span><input aria-label="搜索知识点" type="search" placeholder="搜索知识点或说明" value={search} onChange={event=>setSearch(event.target.value)} /></label>
    {(structure.dependencies.unresolved.length>0||structure.dependencies.missingEdges.length>0||structure.dependencies.ambiguousEdges.length>0)&&<p role="status" className="mf-status">关系待审阅：{structure.dependencies.unresolved.length} 个节点的前置关系未能确定顺序，{structure.dependencies.missingEdges.length} 条关系缺少端点，{structure.dependencies.ambiguousEdges.length} 条旧关系含义未确认。全部内容仍可查看。</p>}
    {visible.map(({block,nodes:items},index)=>items.length>0&&<section className="mf-overview-block" key={block.id} aria-label={block.name}><div className="mf-overview-block-heading"><span>{String(index+1).padStart(2,'0')}</span><h2>{block.name}</h2>{personal&&<small>{structure.groups[index].nodes.filter(node=>progress.get(node.id)===100).length} / {structure.groups[index].nodes.length} 已完成</small>}</div>
      {block.overview?<><p className="mf-overview-context"><b>核心问题：</b>{block.overview.core_question}</p><p className="mf-overview-chain"><b>学习链条：</b>{block.overview.chain_node_ids.map((id,chainIndex)=><span key={id}>{chainIndex>0&&<span aria-hidden="true"> → </span>}<button type="button" onClick={()=>onSelect(id)} disabled={!nodes.has(id)}>{nodes.get(id)?.title??'引用知识点已不可用'}</button></span>)}</p></>:<p className="mf-overview-context mf-muted">分类说明尚未补充，可先阅读完整知识点。</p>}
      <ol className="mf-knowledge-items">{items.map(node=><li key={node.id} data-node-id={node.id} className={snapshot.current_node_id===node.id?'mf-knowledge-current':''}><button type="button" className="mf-knowledge-title" onClick={()=>onSelect(node.id)}>{node.title}</button><span className="mf-knowledge-explanation">{node.description||'知识点说明尚未补充。'}</span>{personal&&<span className="mf-knowledge-progress"><span>{progress.get(node.id)??0}%</span>{snapshot.current_node_id===node.id&&<strong>学到这里</strong>}</span>}{schedule.get(node.id)?.map(item=><span className="mf-knowledge-schedule" key={`${item.date}.${item.partIndex}`} title={item.focus}>{item.date} · 约 {item.minutes} 分钟{item.partCount>1?` · 第 ${item.partIndex}/${item.partCount} 段`:''}<span>{item.focus}</span></span>)}</li>)}</ol>
      {block.overview?.note&&<p className="mf-overview-note">{block.overview.note}</p>}
    </section>)}{!visible.some(group=>group.nodes.length>0)&&<p className="mf-empty">没有匹配的知识点。</p>}
  </article>;
}
