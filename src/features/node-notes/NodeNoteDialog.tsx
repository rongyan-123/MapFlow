import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteNodeNote, fetchNodeNote, saveNodeNote, TreeLibraryApiError } from '../tree-library/treeLibraryClient';
import SafeMarkdown from './SafeMarkdown';

interface Props { libraryEntryId:string; nodeId:string; nodeTitle:string; csrfToken:string; onClose:()=>void }

export default function NodeNoteDialog({libraryEntryId,nodeId,nodeTitle,csrfToken,onClose}:Props){
  const queryClient=useQueryClient();
  const key=['node-note',libraryEntryId,nodeId] as const;
  const note=useQuery({queryKey:key,queryFn:()=>fetchNodeNote(libraryEntryId,nodeId),retry:false});
  const [markdown,setMarkdown]=useState('');
  const [preview,setPreview]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  useEffect(()=>{if(note.data)setMarkdown(note.data.markdown);},[note.data]);
  const refreshTree=()=>void queryClient.invalidateQueries({queryKey:['me']});
  const save=useMutation({mutationFn:()=>saveNodeNote(libraryEntryId,nodeId,markdown,note.data?.version??0,csrfToken),onSuccess:value=>{queryClient.setQueryData(key,value);refreshTree();setMessage('笔记已保存');},onError:error=>{if(error instanceof TreeLibraryApiError&&error.code==='tree_note.version_conflict'){setMessage('笔记已在其他位置更新，已为你重新加载。');void note.refetch();}else setMessage(error instanceof Error?error.message:'保存失败');}});
  const remove=useMutation({mutationFn:()=>deleteNodeNote(libraryEntryId,nodeId,note.data?.version??0,csrfToken),onSuccess:value=>{queryClient.setQueryData(key,value);setMarkdown('');refreshTree();setMessage('笔记已删除');},onError:error=>setMessage(error instanceof Error?error.message:'删除失败')});
  const dirty=note.data!==undefined&&markdown!==note.data.markdown;
  const close=()=>{if(!dirty||window.confirm('有未保存的笔记，确定关闭吗？'))onClose();};
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
    <section role="dialog" aria-modal="true" aria-label={`${nodeTitle}的节点笔记`} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-2xl shadow-cyan-500/10">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-xs font-semibold tracking-widest text-cyan-300">节点笔记</p><h2 className="mt-1 font-bold text-white">{nodeTitle}</h2></div><button type="button" onClick={close} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">关闭</button></header>
      {note.isPending?<p className="p-6 text-sm text-slate-400">正在读取笔记…</p>:note.isError?<p className="p-6 text-sm text-rose-300">{note.error instanceof Error?note.error.message:'读取失败'}</p>:<>
        <div className="flex gap-2 border-b border-slate-800 px-5 py-3"><button type="button" onClick={()=>setPreview(false)} className={`rounded-lg px-3 py-1.5 text-sm ${!preview?'bg-cyan-400/15 text-cyan-200':'text-slate-400'}`}>编辑</button><button type="button" onClick={()=>setPreview(true)} className={`rounded-lg px-3 py-1.5 text-sm ${preview?'bg-cyan-400/15 text-cyan-200':'text-slate-400'}`}>预览</button><span className="ml-auto text-xs text-slate-600">版本 {note.data?.version??0}</span></div>
        <div className="min-h-72 flex-1 overflow-y-auto p-5">{preview?<SafeMarkdown markdown={markdown}/>:<textarea aria-label="Markdown 笔记" value={markdown} maxLength={30000} onChange={e=>{setMarkdown(e.target.value);setMessage(null);}} placeholder="写下你对这个节点的理解、易错点和复习提示…" className="min-h-72 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-cyan-400"/>}</div>
        <footer className="flex items-center gap-3 border-t border-slate-800 px-5 py-4"><span className="text-xs text-slate-500">{markdown.length.toLocaleString()} / 30,000</span>{message&&<span className="text-xs text-amber-200">{message}</span>}<div className="ml-auto flex gap-2">{note.data?.has_note&&<button type="button" disabled={remove.isPending} onClick={()=>{if(window.confirm('确定删除这条笔记吗？版本记录会保留。'))remove.mutate();}} className="rounded-lg border border-rose-400/30 px-3 py-2 text-sm text-rose-300">删除笔记</button>}<button type="button" disabled={save.isPending||markdown.trim()===''||!dirty} onClick={()=>save.mutate()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">保存笔记</button></div></footer>
      </>}
    </section>
  </div>;
}
