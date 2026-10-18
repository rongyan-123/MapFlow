import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHistory, fetchPlaythrough } from '../../api/englishWorldClient';
import { useWorldOperation } from '../../domains/englishWorld/operations';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { Accepted, Checkpoint, PlaythroughPublic, RestoreResult, TaskPublic, Translation, Utterance as PublicUtterance, WordToken } from '../../domains/englishWorld/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { QueryStatus } from '../QueryStatus';
import { CheckpointDialog } from './CheckpointDialog';
import { DeathDebrief } from './DeathDebrief';
import { EnglishComposer } from './EnglishComposer';
import { TaskProgress } from './TaskProgress';
import { Utterance } from './Utterance';
import { branchLabels, OperationNotice, playAddress, type WorldPageContext } from './shared';

export function PlayWorkspace({ context, playthroughId, branchId }: { context: WorldPageContext; playthroughId: string; branchId?: string }) {
  const play = useQuery({ queryKey: worldKeys.play(context.accountId, playthroughId, branchId), queryFn: ({ signal }) => fetchPlaythrough(playthroughId, branchId, signal), retry: false });
  return <><QueryStatus pending={play.isPending} error={play.error} retry={() => void play.refetch()} />{play.data && <PlayScene key={play.data.viewedBranchId} context={context} play={play.data} requestedBranchId={branchId} />}</>;
}

function SceneFacts({ play }: { play: PlaythroughPublic }) {
  return <div className="ew-facts"><section><h3>当前目标</h3><p lang="en">{play.publicState.goal}</p></section><section><h3>在场人物</h3>{play.publicState.characters.length ? play.publicState.characters.map(character => <article key={character.id}><strong>{character.name}</strong><p lang="en">{character.description}</p></article>) : <p className="mf-muted">暂未遇到人物。</p>}</section><section><h3>公开线索</h3>{play.publicState.clues.length ? <ul>{play.publicState.clues.map(clue => <li key={clue.id}>{clue.text}</li>)}</ul> : <p className="mf-muted">继续探索，记录你发现的线索。</p>}</section><section><h3>随身物品</h3>{play.publicState.inventory.length ? <ul>{play.publicState.inventory.map(item => <li key={item.id}>{item.name}</li>)}</ul> : <p className="mf-muted">暂无物品。</p>}</section></div>;
}
function PlayScene({ context, play, requestedBranchId }: { context: WorldPageContext; play: PlaythroughPublic; requestedBranchId?: string }) {
  const queryClient = useQueryClient();
  const branchId = play.viewedBranchId;
  const operation = useWorldOperation(context.accountId, `play.${play.playthroughId}.${branchId}`, context.csrfToken);
  const draftKey = `mapflow.english-world.draft.v1.${context.accountId}.${play.playthroughId}.${branchId}`;
  const [draft, setDraft] = useState(() => { try { return sessionStorage.getItem(draftKey) ?? ''; } catch { return ''; } });
  const [wordHelp, setWordHelp] = useState<{ utterance: PublicUtterance; token: WordToken } | null>(null);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [checkpointsOpen, setCheckpointsOpen] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskPublic['state']>();
  const [localError, setLocalError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const terminalSeen = useRef('');
  const history = useInfiniteQuery({ queryKey: worldKeys.history(context.accountId, play.playthroughId, branchId), initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchHistory(play.playthroughId, branchId, pageParam ?? undefined, signal), getNextPageParam: page => page.nextCursor ?? undefined, retry: false });
  const utterances = [...new Map(([...(history.data?.pages ?? [])].reverse().flatMap(page => page.utterances)).map(utterance => [utterance.utteranceId, utterance])).values()];
  const taskId = play.activeTaskId ?? localTaskId;
  const waiting = !!taskId && (!taskState || ['queued', 'running', 'validating', 'blocked'].includes(taskState));
  const currentBranch = branchId === play.activeBranchId;
  const busy = operation.busy || !!operation.pending || waiting || leaving;
  const canAct = currentBranch && play.allowedActions.canAct && play.branchStatus === 'active' && !busy && !history.isPending && !history.error;
  function changeDraft(text: string) { setDraft(text); try { sessionStorage.setItem(draftKey, text); } catch { /* The current input still retains its draft. */ } }
  function refreshStory() {
    void queryClient.invalidateQueries({ queryKey: worldKeys.play(context.accountId, play.playthroughId, requestedBranchId) });
    void queryClient.invalidateQueries({ queryKey: worldKeys.history(context.accountId, play.playthroughId, branchId) });
    void queryClient.invalidateQueries({ queryKey: worldKeys.checkpoints(context.accountId, play.playthroughId) });
    void queryClient.invalidateQueries({ queryKey: worldKeys.worlds(context.accountId) });
  }
  function acceptTurn(result: Accepted) {
    changeDraft('');
    if (result.taskId) { setLocalTaskId(result.taskId); setTaskState(undefined); }
    else refreshStory();
  }
  useEffect(() => {
    if (operation.result && 'taskId' in operation.result && operation.result.taskId) setLocalTaskId(operation.result.taskId);
  }, [operation.result]);
  function observeTask(task: TaskPublic) {
    setTaskState(task.state);
    if (['completed', 'stopped', 'failed'].includes(task.state)) {
      const identity = `${task.taskId}.${task.state}.${task.sequence}`;
      if (terminalSeen.current !== identity) { terminalSeen.current = identity; refreshStory(); }
    }
  }
  async function send() {
    if (!canAct || !draft.trim()) return;
    setLocalError('');
    try { const result = await operation.perform(`/playthroughs/${play.playthroughId}/turns`, { branchId, expectedRevision: play.revision, text: draft.trim(), ...context.funding() }, 'accepted'); if (result) acceptTurn(result); }
    catch (failure) { setLocalError(describePublicError(failure)); }
  }
  async function translate() {
    if (!wordHelp || wordHelp.utterance.translationUse || busy || !currentBranch) return;
    setLocalError('');
    try {
      const selected = wordHelp;
      const result = await operation.perform(`/playthroughs/${play.playthroughId}/translations`, { branchId, utteranceId: selected.utterance.utteranceId, tokenId: selected.token.tokenId, ...context.funding() }, 'translation');
      if (result) {
        setTranslations(previous => ({ ...previous, [selected.utterance.utteranceId]: result }));
        if (result.taskId) { setLocalTaskId(result.taskId); setTaskState(undefined); }
        setWordHelp(null); void history.refetch();
      }
    } catch (failure) { setLocalError(describePublicError(failure)); }
  }
  async function restored(result: RestoreResult) {
    setLeaving(true);
    await queryClient.cancelQueries({ queryKey: worldKeys.root(context.accountId) });
    await queryClient.invalidateQueries({ queryKey: worldKeys.root(context.accountId), refetchType: 'none' });
    context.navigate(playAddress(play.playthroughId, result.branchId));
  }
  async function restore(checkpoint: Checkpoint) {
    if (busy || !currentBranch || !play.allowedActions.canRestore) return;
    const result = await operation.perform(`/playthroughs/${play.playthroughId}/restores`, { checkpointId: checkpoint.checkpointId, expectedBranchId: play.activeBranchId, expectedRevision: play.revision }, 'restore');
    if (result) await restored(result);
  }
  return <div className="ew-play"><header className="ew-scene-header"><div><span className="ew-tag">{branchLabels[play.branchStatus]}</span><h2>{play.worldTitle}</h2><p>{play.publicState.location.name} · {play.publicState.worldTime}</p></div><div className="mf-row mf-wrap"><Button onClick={() => setCheckpointsOpen(true)}>存档与回档</Button><Button className="ew-facts-button" onClick={() => setFactsOpen(true)}>人物与线索</Button><Button onClick={() => context.navigate('/english-world')}>离开</Button></div></header>
    <div className="ew-play-body"><aside className="ew-play-records" aria-label="本局记录"><h3>本局记录</h3><p>话轮边界自动保存</p><Button onClick={() => setCheckpointsOpen(true)}>查看存档点</Button><p className="mf-muted">{play.publicState.location.name}</p><p>{branchLabels[play.branchStatus]}</p></aside>
      <div className="ew-reading"><div className="ew-story" aria-label="故事与台词"><div className="ew-location"><h3>{play.publicState.location.name}</h3><p lang="en">{play.publicState.location.description}</p></div>
        {!currentBranch && <div className="mf-status"><p>你正在阅读历史路线。</p><Button onClick={() => context.navigate(playAddress(play.playthroughId, play.activeBranchId))}>回到当前路线</Button></div>}
        <QueryStatus pending={history.isPending} error={history.error} retry={() => void history.refetch()} />
        {history.hasNextPage && <Button disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>读取更多已确认台词</Button>}
        {utterances.map(utterance => { const translated = translations[utterance.utteranceId]; const visible = translated && utterance.translationUse?.status !== 'ready' ? { ...utterance, translationUse: { selectedTokenId: translated.selectedTokenId, status: translated.status, glossZh: translated.glossZh } } : utterance; return <Utterance key={utterance.utteranceId} utterance={visible} disabled={busy || leaving || !currentBranch} onWord={token => setWordHelp({ utterance: visible, token })} />; })}
        {taskId && <TaskProgress key={taskId} context={context} taskId={taskId} onTask={observeTask} />}
        {play.branchStatus === 'dead' && <p role="status" className="ew-route-end">本条路线已死亡</p>}{play.branchStatus === 'completed' && <p role="status" className="ew-route-end">本条路线已完成</p>}
        {play.allowedActions.canReadDebrief && <DeathDebrief context={context} playthroughId={play.playthroughId} branchId={branchId} worldId={play.worldId} onRestore={() => setCheckpointsOpen(true)} />}
        {localError && <p role="alert" className="mf-status mf-status--error">{localError}</p>}
        <OperationNotice operation={operation} apiKey={context.apiKey} onResult={result => { if ('revision' in result) void restored(result); else if ('selectedTokenId' in result) { setWordHelp(null); void history.refetch(); } else if ('operationId' in result) acceptTurn(result); }} />
      </div><EnglishComposer draft={draft} onChange={changeDraft} onSend={() => void send()} disabled={!canAct} waiting={waiting || operation.busy} /></div>
      <aside className="ew-play-facts" aria-label="公开人物与线索"><SceneFacts play={play} /></aside>
    </div>
    {factsOpen && <Dialog title="人物与线索" layout="drawer" onClose={() => setFactsOpen(false)}><SceneFacts play={play} /></Dialog>}
    {checkpointsOpen && <CheckpointDialog context={context} playthroughId={play.playthroughId} canRestore={currentBranch && play.allowedActions.canRestore && !waiting && !operation.pending && !leaving} busy={operation.busy} onClose={() => setCheckpointsOpen(false)} onRestore={checkpoint => void restore(checkpoint)} />}
    {wordHelp && <Dialog title="查这个词" onClose={() => setWordHelp(null)}><div className="ew-stack"><p className="ew-word-title" lang="en">{wordHelp.token.text}</p><p className="ew-context-sentence" lang="en">{wordHelp.utterance.textEn}</p>{wordHelp.utterance.translationUse ? <><p>{wordHelp.utterance.translationUse.glossZh ?? '这个词已选择，结果尚待核对。'}</p><Button onClick={() => { void history.refetch(); setWordHelp(null); }}>核对原翻译</Button></> : <><p>本段还可翻译 1 个词。确认后不能换词。</p><Button variant="primary" disabled={busy} onClick={() => void translate()}>确认翻译</Button></>}{localError && <p role="alert" className="mf-status mf-status--error">{localError}</p>}</div></Dialog>}
  </div>;
}
