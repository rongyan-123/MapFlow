import { useEffect,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { deleteNodeNote,fetchNodeNote,saveNodeNote,TreeLibraryApiError } from '../../api/treeLibraryClient';
import type { NodeNote } from '../maps/types';
import { describePublicError } from '../../lib/publicErrors';
import { clearNoteDraft,noteDraftKey,readNoteDraft,writeNoteDraft } from './noteDrafts';
export interface NoteOwner {accountId:string;libraryEntryId:string;nodeId:string;csrfToken:string;onClose:()=>void}
interface NoteWrite {markdown:string;expectedVersion:number;draftRevision:string}
export function useNodeNote({accountId,libraryEntryId,nodeId,csrfToken,onClose}:NoteOwner) {
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
  function change(markdown:string){
    setMarkdown(markdown);setMessage(null);
    if(markdown===note.data?.markdown)clearNoteDraft(draftKey);
    else writeNoteDraft(draftKey,markdown,note.data?.markdown??'',note.data?.version??0);
  }
  return {note,markdown,preview,setPreview,message,currentDraft,dirty,writing,close,change,
    save:()=>save.mutate(currentWrite()),remove:()=>{if(window.confirm('确定删除这条笔记吗？'))remove.mutate(currentWrite());}};
}
