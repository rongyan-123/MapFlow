import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { executeTreePublication, fetchPublicationStatus, prepareTreePublication } from './treeLibraryClient';
import type { PublicationPrepare } from './types';

export default function TreePublicationDialog({libraryEntryId,title,csrfToken,onClose}:{libraryEntryId:string;title:string;csrfToken:string;onClose:()=>void}){
  const queryClient=useQueryClient();
  const status=useQuery({queryKey:['tree-publication',libraryEntryId],queryFn:()=>fetchPublicationStatus(libraryEntryId),retry:false});
  const [prepared,setPrepared]=useState<PublicationPrepare|null>(null);
  const [error,setError]=useState<string|null>(null);
  const prepare=useMutation({mutationFn:(unpublish:boolean)=>prepareTreePublication(libraryEntryId,csrfToken,unpublish),onSuccess:value=>{setPrepared(value);setError(null);},onError:value=>setError(value instanceof Error?value.message:'无法准备公开操作')});
  const execute=useMutation({mutationFn:()=>executeTreePublication(libraryEntryId,prepared?.confirmation_token??'',csrfToken,crypto.randomUUID(),prepared?.action==='unpublish'),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['trees','public']});void queryClient.invalidateQueries({queryKey:['tree-publication',libraryEntryId]});setPrepared(null);onClose();},onError:value=>setError(value instanceof Error?value.message:'公开操作失败')});
  const isPublic=status.data?.is_public===true;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4"><section role="dialog" aria-modal="true" aria-label="公开技能树" className="w-full max-w-lg rounded-2xl border border-violet-400/30 bg-slate-950 p-5 shadow-2xl">
    <div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-widest text-violet-300">公共树池</p><h2 className="mt-1 text-lg font-bold text-white">{title}</h2></div><button type="button" onClick={onClose} className="text-slate-400">关闭</button></div>
    {status.isPending?<p className="mt-5 text-sm text-slate-400">正在读取公开状态…</p>:prepared?<div className="mt-5 space-y-4"><div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 text-sm leading-6 text-slate-300"><p>发布者：<strong className="text-white">{prepared.publisher_display_name}</strong></p><p>源版本：v{prepared.source_revision} · {prepared.node_count} 节点 · {prepared.edge_count} 条边 · {prepared.block_count} 个块</p><p className="mt-2 text-slate-500">不会公开：{prepared.excludes.join('、')}</p></div><p className="text-sm text-amber-200">{prepared.action==='unpublish'?'确认后当前公共副本会立即下架。':'确认后会创建独立快照；以后私人修改不会自动进入公共池。'}</p><button type="button" disabled={execute.isPending} onClick={()=>execute.mutate()} className={`w-full rounded-xl px-4 py-3 font-bold ${prepared.action==='unpublish'?'bg-rose-400 text-rose-950':'bg-violet-300 text-violet-950'}`}>{execute.isPending?'处理中…':prepared.action==='unpublish'?'确认取消公开':prepared.action==='update'?'确认更新公共副本':'确认公开到公共池'}</button></div>:<div className="mt-5"><p className="text-sm leading-6 text-slate-400">{isPublic?'当前已有一个公开快照。你可以更新为当前版本，或取消公开。':'公开后，其他用户可以浏览并复制这棵树，页面会显示你的用户名作为发布者。'}</p><div className="mt-4 flex gap-2"><button type="button" disabled={prepare.isPending} onClick={()=>prepare.mutate(false)} className="flex-1 rounded-xl bg-violet-300 px-4 py-3 font-bold text-violet-950">{isPublic?'预览更新内容':'预览公开内容'}</button>{isPublic&&<button type="button" disabled={prepare.isPending} onClick={()=>prepare.mutate(true)} className="rounded-xl border border-rose-400/40 px-4 py-3 font-semibold text-rose-300">取消公开</button>}</div></div>}
    {error&&<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
  </section></div>;
}
