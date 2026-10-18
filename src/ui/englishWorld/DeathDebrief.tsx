import { useQuery } from '@tanstack/react-query';
import { fetchDebrief } from '../../api/englishWorldClient';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import { Button } from '../Button';
import { QueryStatus } from '../QueryStatus';
import { TaskProgress } from './TaskProgress';
import type { WorldPageContext } from './shared';

export function DeathDebrief({ context, playthroughId, branchId, onRestore, worldId }: { context: WorldPageContext; playthroughId: string; branchId: string; onRestore: () => void; worldId: string }) {
  const debrief = useQuery({ queryKey: worldKeys.debrief(context.accountId, playthroughId, branchId), queryFn: ({ signal }) => fetchDebrief(playthroughId, branchId, signal), retry: false });
  const category = { language: '语言理解', world_rule: '世界规则', dangerous_choice: '危险决定', mixed: '语言与决定' };
  const current = debrief.data;
  return <section className="ew-debrief" aria-label="本次复盘"><h2>回看这次选择</h2><QueryStatus pending={debrief.isPending} error={debrief.error} retry={() => void debrief.refetch()} />
    {current?.status === 'pending' && <p role="status">复盘正在准备，已确认的路线仍然保留。</p>}
    {current?.status === 'pending' && current.taskId && <TaskProgress context={context} taskId={current.taskId} onCompleted={() => void debrief.refetch()} />}
    {current?.status === 'ready' && <><p className="ew-death-reason">{current.deathReason}</p>{current.category && <span className="ew-tag">{category[current.category]}</span>}<dl className="ew-debrief-detail">{current.lastNpcText && <><dt>上一句人物台词</dt><dd lang="en">{current.lastNpcText}</dd></>}{current.lastNpcTranslation && <><dt>这句话的意思</dt><dd>{current.lastNpcTranslation}</dd></>}{current.playerText && <><dt>你的回答</dt><dd lang="en">{current.playerText}</dd></>}{current.playerMeaning && <><dt>你实际表达的意思</dt><dd>{current.playerMeaning}</dd></>}</dl>{current.explanation && <p>{current.explanation}</p>}</>}
    <div className="mf-row mf-wrap"><Button variant="primary" onClick={onRestore}>从存档继续</Button><Button onClick={() => context.navigate('/english-world/worlds/' + worldId)}>重玩这个世界</Button><Button onClick={() => context.navigate('/english-world/words')}>查看我的词库</Button></div>
  </section>;
}
