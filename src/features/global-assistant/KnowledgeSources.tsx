import {useState} from 'react';
import {useInfiniteQuery,useQuery} from '@tanstack/react-query';
import {fetchExecutionKnowledgeSources,fetchKnowledgeSource,type KnowledgeReference} from '../../api/assistantKnowledgeClient';
import {Button} from '../../ui/Button';
import {Dialog} from '../../ui/Dialog';
import {QueryStatus} from '../../ui/QueryStatus';
import SafeMarkdown from '../../ui/SafeMarkdown';
import './knowledge-sources.css';

export default function KnowledgeSources({executionId,accountId}:{executionId:string;accountId:string}){
  const [selected,setSelected]=useState<KnowledgeReference|null>(null);
  const references=useQuery({queryKey:['knowledge-sources',accountId,executionId],queryFn:()=>fetchExecutionKnowledgeSources(executionId),staleTime:60_000});
  const sources=references.data?.filter((source,index,all)=>all.findIndex(other=>other.sourceId===source.sourceId)===index)??[];
  if(!sources.length)return null;
  return <div className="mf-knowledge-sources"><span className="mf-small mf-muted">参考来源</span><div className="mf-row mf-wrap">
    {sources.map(source=><Button key={source.sourceId} variant="quiet" onClick={()=>setSelected(source)}>{source.title} · 版本 {source.revisionNumber}</Button>)}
    </div>{selected&&<SourceDialog key={selected.sourceId} source={selected} accountId={accountId} onClose={()=>setSelected(null)}/>}</div>;
}
function SourceDialog({source,accountId,onClose}:{source:KnowledgeReference;accountId:string;onClose:()=>void}){
  const query=useInfiniteQuery({queryKey:['knowledge-source',accountId,source.sourceId],initialPageParam:0,
    queryFn:({pageParam})=>fetchKnowledgeSource(source.sourceId,pageParam),getNextPageParam:page=>page.nextOffset??undefined,
    refetchOnMount:'always',retry:false});
  return <Dialog title={source.title} onClose={onClose}><div className="mf-stack">
    <p className="mf-small mf-muted">已发布资料 · 版本 {source.revisionNumber}</p>
    <QueryStatus pending={query.isPending||!query.isFetchedAfterMount&&query.isFetching} error={query.error} retry={()=>void query.refetch()} />
    {!query.isError&&query.isFetchedAfterMount&&query.data&&<SafeMarkdown markdown={query.data.pages.map(page=>page.markdown).join('')} />}
    {query.hasNextPage&&!query.isError&&query.isFetchedAfterMount&&<Button disabled={query.isFetchingNextPage} onClick={()=>void query.fetchNextPage()}>{query.isFetchingNextPage?'读取中…':'继续读取原文'}</Button>}
  </div></Dialog>;
}
