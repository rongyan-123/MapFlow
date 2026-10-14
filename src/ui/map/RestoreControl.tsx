import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { fetchRestorePoint,restoreTree } from '../../api/treeRestoreClient';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
export default function RestoreControl({accountId,libraryEntryId,csrfToken,onRestored,initialOpen=false,onClosed}:{accountId:string;libraryEntryId:string;csrfToken:string;onRestored?:()=>void;initialOpen?:boolean;onClosed?:()=>void}){
  const [open,setOpen]=useState(initialOpen);const client=useQueryClient();
  const point=useQuery({queryKey:['me',accountId,'tree-library',libraryEntryId,'restore'],queryFn:()=>fetchRestorePoint(libraryEntryId),enabled:open,retry:false,staleTime:0});
  const restore=useMutation({mutationFn:(snapshot:string)=>restoreTree(libraryEntryId,snapshot,csrfToken),onSuccess:()=>{setOpen(false);onClosed?.();void client.invalidateQueries({queryKey:['me',accountId,'tree-library']});void client.invalidateQueries({queryKey:['me',accountId,'node-note']});onRestored?.();}});
  const error=point.error??restore.error;
  return <><Button onClick={()=>{restore.reset();setOpen(true);}}>恢复最近一次修改</Button>{restore.isSuccess&&!open && <p role="status" className="mf-status">已恢复修改前的地图、笔记和进度。</p>}{open && <Dialog title="恢复地图修改" dismissible={!restore.isPending} onClose={()=>{setOpen(false);onClosed?.();}}><div className="mf-stack"><p className="mf-muted">将恢复最近一次已确认修改前的地图结构、笔记和学习进度。仅当此后没有修改时才能恢复。</p>{point.isPending && <p role="status" className="mf-status">正在检查可恢复记录…</p>}{error && <p role="alert" className="mf-status mf-status--error">{describePublicError(error)}</p>}{point.data&&!point.data.canRestore && <p className="mf-status">{point.data.snapshotId?'地图或笔记已有后续修改，不能恢复。':'暂无可恢复的修改。'}</p>}<div className="mf-row mf-wrap">{point.data?.canRestore&&point.data.snapshotId && <Button variant="primary" disabled={restore.isPending||point.isFetching} onClick={()=>restore.mutate(point.data!.snapshotId!)}>确认恢复地图、笔记和进度</Button>}<Button disabled={restore.isPending} onClick={()=>{setOpen(false);onClosed?.();}}>取消</Button></div></div></Dialog>}</>;
}
