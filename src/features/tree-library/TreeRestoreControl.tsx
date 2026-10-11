import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buttonClass, ErrorNotice } from '../tavern/TavernUi';
import { fetchRestorePoint, restoreTree } from './treeRestoreClient';

export default function TreeRestoreControl({ accountId, libraryEntryId, csrfToken, onRestored }: {
  accountId: string; libraryEntryId: string; csrfToken: string; onRestored?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const point = useQuery({queryKey:['me',accountId,'tree-library',libraryEntryId,'restore'],queryFn:()=>fetchRestorePoint(libraryEntryId),enabled:open,retry:false,staleTime:0});
  const restore = useMutation({mutationFn:(snapshotId:string)=>restoreTree(libraryEntryId,snapshotId,csrfToken),onSuccess:()=>{
    setOpen(false);
    void client.invalidateQueries({queryKey:['me',accountId,'tree-library']});
    void client.invalidateQueries({queryKey:['me',accountId,'node-note']});
    onRestored?.();
  }});
  return <>
    <button type="button" className={buttonClass} onClick={()=>{restore.reset();setOpen(true);}}>恢复最近一次修改</button>
    {restore.isSuccess && !open && <span role="status" className="text-sm text-emerald-300">已恢复修改前的地图、笔记和进度。</span>}
    {open && <section role="dialog" aria-label="恢复地图修改" className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
      <p>将恢复最近一次已确认修改前的地图结构、笔记和学习进度。仅当此后没有修改时才能恢复。</p>
      {point.isPending && <p role="status">正在检查可恢复记录…</p>}
      <ErrorNotice error={point.error ?? restore.error}/>
      {point.data && !point.data.canRestore && <p>{point.data.snapshotId ? '地图或笔记已有后续修改，不能恢复。' : '暂无可恢复的修改。'}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {point.data?.canRestore && point.data.snapshotId && <button type="button" className={buttonClass} disabled={restore.isPending || point.isFetching} onClick={()=>restore.mutate(point.data!.snapshotId!)}>确认恢复地图、笔记和进度</button>}
        <button type="button" className={buttonClass} disabled={restore.isPending} onClick={()=>setOpen(false)}>取消</button>
      </div>
    </section>}
  </>;
}
