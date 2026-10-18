import { useQuery } from '@tanstack/react-query';
import { fetchCheckpoints } from '../../api/englishWorldClient';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { Checkpoint } from '../../domains/englishWorld/types';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { QueryStatus } from '../QueryStatus';
import type { WorldPageContext } from './shared';

export function CheckpointDialog({ context, playthroughId, canRestore, busy, onClose, onRestore }: { context: WorldPageContext; playthroughId: string; canRestore: boolean; busy: boolean; onClose: () => void; onRestore: (checkpoint: Checkpoint) => void }) {
  const checkpoints = useQuery({ queryKey: worldKeys.checkpoints(context.accountId, playthroughId), queryFn: ({ signal }) => fetchCheckpoints(playthroughId, signal), retry: false });
  return <Dialog title="存档与回档" onClose={onClose}><div className="ew-stack"><p>每个已确认的话轮都会自动保存。回档会创建新分支，保留原路线、个人词库和已发生的费用。</p>{!canRestore && <p role="status" className="mf-status">请先核对或停止当前任务，再从当前路线回档。</p>}<QueryStatus pending={checkpoints.isPending} error={checkpoints.error} retry={() => void checkpoints.refetch()} />
    {checkpoints.data?.checkpoints.map(checkpoint => <article className="ew-checkpoint" key={checkpoint.checkpointId}><h3>{checkpoint.location} · {checkpoint.worldTime}</h3><p>{checkpoint.summary}</p><Button disabled={busy || !canRestore} onClick={() => onRestore(checkpoint)}>从这里继续</Button></article>)}{checkpoints.data && !checkpoints.data.checkpoints.length && <p className="mf-muted">尚无可恢复的存档点。</p>}
  </div></Dialog>;
}
