import { useState } from 'react';
import type {TreeLayoutMode} from '../types/learning';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { addTreeToPersonalLibrary } from '../api/treeLibraryClient';
import { useIdentity } from '../domains/identity/IdentityContext';
import { usePublicCatalog } from '../domains/maps/useMapCatalog';
import { snapshotFromGraph } from '../domains/maps/snapshotFromGraph';
import { describePublicError } from '../lib/publicErrors';
import type { Navigate } from '../app/useLocation';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { MapCard } from '../ui/MapCard';
import MapView from '../ui/map/MapView';

export default function LibraryPage({navigate,treeId,initialNodeId,initialLayout}:{navigate:Navigate;treeId?:string;initialNodeId?:string;initialLayout?:TreeLayoutMode}) {
  const {session}=useIdentity();const {catalog,detail,trees,attributions}=usePublicCatalog(session?.account.playerId,treeId);
  const [search,setSearch]=useState('');const [difficulty,setDifficulty]=useState('all');
  const client=useQueryClient();
  const add=useMutation({mutationFn:()=>addTreeToPersonalLibrary(treeId!,session!.csrfToken),onSuccess:async receipt=>{await client.invalidateQueries({queryKey:['me',session!.account.playerId,'tree-library']});navigate(`/maps?entry=${encodeURIComponent(receipt.library_entry_id)}`);}});
  const visible=trees.filter(tree=>`${tree.title} ${tree.topic} ${tree.description??''}`.toLowerCase().includes(search.trim().toLowerCase())&&(difficulty==='all'||tree.difficulty_level===difficulty));
  return <><PageHeader title={treeId ? detail.data?.graph.tree.title??'公共地图':'公共书库'} actions={treeId?<><Button variant="quiet" onClick={()=>navigate('/library')}>返回书库</Button><Button variant="primary" disabled={!detail.data||add.isPending} onClick={()=>add.mutate()}>加入我的地图</Button></>:<Button variant="quiet" onClick={()=>navigate('/maps')}>我的地图</Button>} />
    {add.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(add.error)}</p>}
    {treeId ? <>{detail.isPending && <p role="status" className="mf-status">正在读取地图…</p>}{detail.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(detail.error)} <Button onClick={()=>void detail.refetch()}>重试</Button></p>}{detail.data && !detail.error && <MapView initialNodeId={initialNodeId} initialLayout={initialLayout} snapshot={snapshotFromGraph(detail.data.graph,[])} displayMode="showcase" accountId={session?.account.playerId??''} />}</> : <div className="mf-content"><main className="mf-page">
      <div className="mf-page-heading"><div><p className="mf-eyebrow">EXPLORE THE LIBRARY</p><h1>找一张地图，开始探索。</h1><p>从已有的学习路线中，找到你感兴趣的方向。</p></div></div>
      <div className="mf-catalog-filter"><label className="mf-field"><span className="mf-sr-only">搜索公共地图</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索主题、地图或知识方向" /></label><label className="mf-field"><span className="mf-sr-only">筛选难度</span><select value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="all">全部难度</option>{[...new Set(trees.map(tree=>tree.difficulty_level))].map(level=><option value={level} key={level}>{level}</option>)}</select></label></div>
      {catalog.isPending && <p role="status" className="mf-status">正在读取书库…</p>}{catalog.error && <div role="alert" className="mf-status mf-status--error">{describePublicError(catalog.error)} <Button onClick={()=>void catalog.refetch()}>重新读取书库</Button></div>}
      {catalog.data && !catalog.error && <>{!trees.length ? <p className="mf-empty">书库暂时没有公开地图。</p> : !visible.length ? <p className="mf-empty">没有找到匹配的地图，换个关键词试试。</p> : <div className="mf-grid mf-grid--3">{visible.map(tree=><MapCard key={tree.id} tree={tree} publisher={attributions[tree.id]?.publisher_display_name} onOpen={()=>navigate(`/library?tree=${encodeURIComponent(tree.id)}`)} />)}</div>}{catalog.hasNextPage && <div className="mf-load-more"><Button disabled={catalog.isFetchingNextPage} onClick={()=>void catalog.fetchNextPage()}>{catalog.isFetchingNextPage?'加载中…':'加载更多地图'}</Button></div>}</>}
    </main></div>}
  </>;
}
