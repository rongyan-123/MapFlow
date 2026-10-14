import { describePublicError } from '../../lib/publicErrors';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteNodeNote, fetchNodeNote, saveNodeNote, TreeLibraryApiError } from '../../api/treeLibraryClient';
import type { NodeNote } from '../../domains/maps/types';
import { clearNoteDraft, noteDraftKey, readNoteDraft, writeNoteDraft } from '../../domains/notes/noteDrafts';
import SafeMarkdown from '../../ui/SafeMarkdown';

interface Props { accountId: string; libraryEntryId: string; nodeId: string; nodeTitle: string; csrfToken: string; onClose: () => void }
interface NoteWrite { markdown: string; expectedVersion: number; draftRevision: string }

export default function NodeNoteDialog(props: Props) {
  return <OwnedNodeNoteDialog key={noteDraftKey(props.accountId, props.libraryEntryId, props.nodeId)} {...props} />;
}
function OwnedNodeNoteDialog({ accountId, libraryEntryId, nodeId, nodeTitle, csrfToken, onClose }: Props) {
  const queryClient = useQueryClient();
  const key = ['me', accountId, 'node-note', libraryEntryId, nodeId] as const;
  const draftKey = noteDraftKey(accountId, libraryEntryId, nodeId);
  const [restoredDraft] = useState(() => readNoteDraft(draftKey));
  const note = useQuery({ queryKey: key, queryFn: () => fetchNodeNote(libraryEntryId, nodeId), retry: false });
  const [markdown, setMarkdown] = useState(restoredDraft?.markdown ?? '');
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<string | null>(restoredDraft ? '已恢复未保存的笔记草稿，请核对后保存。' : null);
  const loadedMarkdown = useRef<string | null>(restoredDraft?.baseMarkdown ?? null);
  useEffect(() => {
    if (!note.data) return;
    const previous = loadedMarkdown.current;
    setMarkdown(draft => previous === null || draft === previous ? note.data.markdown : draft);
    loadedMarkdown.current = note.data.markdown;
    const cached = readNoteDraft(draftKey);
    if (cached?.markdown === note.data.markdown) { clearNoteDraft(draftKey, cached.revision); setMessage(null); }
  }, [note.data, draftKey]);
  const refreshTree = () => void queryClient.invalidateQueries({ queryKey: ['me', accountId, 'tree-library'] });
  const applyReceipt = (receipt: NodeNote) => queryClient.setQueryData<NodeNote>(key,
    current => current && current.version > receipt.version ? current : receipt);
  const handleWriteError = (error: unknown) => {
    if (error instanceof TreeLibraryApiError && error.code === 'tree_note.version_conflict') {
      setMessage('笔记已在其他位置更新；你的草稿已保留，请核对新版本后保存。'); void note.refetch();
    } else setMessage(describePublicError(error));
  };
  const save = useMutation({
    mutationFn: (write: NoteWrite) => saveNodeNote(libraryEntryId, nodeId, write.markdown, write.expectedVersion, csrfToken),
    onSuccess: (value, write) => {
      applyReceipt(value); clearNoteDraft(draftKey, write.draftRevision); refreshTree(); setMessage('笔记已保存');
    },
    onError: handleWriteError,
  });
  const remove = useMutation({
    mutationFn: (write: NoteWrite) => deleteNodeNote(libraryEntryId, nodeId, write.expectedVersion, csrfToken),
    onSuccess: (value, write) => {
      applyReceipt(value);
      if (clearNoteDraft(draftKey, write.draftRevision)) setMarkdown('');
      refreshTree(); setMessage('笔记已删除');
    }, onError: handleWriteError,
  });
  const currentDraft = readNoteDraft(draftKey);
  const dirty = note.data !== undefined && markdown !== note.data.markdown;
  const writing = save.isPending || remove.isPending;
  const currentWrite = (): NoteWrite => ({ markdown, expectedVersion: note.data?.version ?? 0,
    draftRevision: (readNoteDraft(draftKey) ?? writeNoteDraft(draftKey, markdown, note.data?.markdown ?? '', note.data?.version ?? 0)).revision });
  const close = () => { if (writing) return; if (!dirty || window.confirm('有未保存的笔记，关闭后会在本次浏览器会话中保留草稿。确定关闭吗？')) onClose(); };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label={`${nodeTitle}的节点笔记`} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-2xl shadow-cyan-500/10">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-xs font-semibold tracking-widest text-cyan-300">节点笔记</p><h2 className="mt-1 font-bold text-white">{nodeTitle}</h2></div><button type="button" onClick={close} disabled={writing} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">关闭</button></header>
      {note.isPending ? <p className="p-6 text-sm text-slate-400">正在读取笔记…</p> : note.isError ? <div className="p-6"><p role="alert" className="text-sm text-rose-300">{describePublicError(note.error)}</p><button onClick={() => void note.refetch()} className="mt-3 text-sm text-cyan-200">重试读取</button></div> : <>
        <div className="flex gap-2 border-b border-slate-800 px-5 py-3"><button type="button" onClick={() => setPreview(false)} className={`rounded-lg px-3 py-1.5 text-sm ${!preview ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-400'}`}>编辑</button><button type="button" onClick={() => setPreview(true)} className={`rounded-lg px-3 py-1.5 text-sm ${preview ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-400'}`}>预览</button><span className="ml-auto text-xs text-slate-600">版本 {note.data?.version ?? 0}</span></div>
        <div className="min-h-72 flex-1 overflow-y-auto p-5">
          {currentDraft && currentDraft.baseVersion !== note.data?.version && dirty && <details className="mb-4 rounded-xl border border-amber-700 p-3 text-sm"><summary>服务器笔记有更新，展开核对</summary><SafeMarkdown markdown={note.data?.markdown ?? ''} /></details>}
          {preview ? <SafeMarkdown markdown={markdown} /> : <textarea aria-label="Markdown 笔记" value={markdown} disabled={writing} maxLength={30000} onChange={event => {
            const draft = event.target.value; setMarkdown(draft); setMessage(null);
            if (draft === note.data?.markdown) clearNoteDraft(draftKey);
            else writeNoteDraft(draftKey, draft, note.data?.markdown ?? '', note.data?.version ?? 0);
          }} placeholder="写下你对这个节点的理解、易错点和复习提示…" className="min-h-72 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-cyan-400" />}
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-5 py-4"><span className="text-xs text-slate-500">{markdown.length.toLocaleString()} / 30,000</span>{message && <span role="status" className="text-xs text-amber-200">{message}</span>}<div className="ml-auto flex gap-2">
          {note.data?.has_note && <button type="button" disabled={writing} onClick={() => { if (window.confirm('确定删除这条笔记吗？')) remove.mutate(currentWrite()); }} className="rounded-lg border border-rose-400/30 px-3 py-2 text-sm text-rose-300">删除笔记</button>}
          <button type="button" disabled={writing || markdown.trim() === '' || !dirty} onClick={() => save.mutate(currentWrite())} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">保存笔记</button>
        </div></footer>
      </>}
    </section>
  </div>;
}
