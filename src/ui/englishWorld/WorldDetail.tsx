import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorldDetail } from '../../api/englishWorldClient';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import { useWorldOperation } from '../../domains/englishWorld/operations';
import type { Accepted, WorldConfiguration } from '../../domains/englishWorld/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { QueryStatus } from '../QueryStatus';
import { WorldConfigurationDialog } from './WorldConfigurationDialog';
import { branchLabels, difficultyLabels, followAccepted, OperationNotice, playAddress, type WorldPageContext } from './shared';

export function WorldDetail({ context, worldId }: { context: WorldPageContext; worldId: string }) {
  const world = useQuery({ queryKey: worldKeys.world(context.accountId, worldId), queryFn: ({ signal }) => fetchWorldDetail(worldId, signal), retry: false });
  const operation = useWorldOperation(context.accountId, 'world.' + worldId, context.csrfToken);
  const [chosenVersion, setChosenVersion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [localError, setLocalError] = useState('');
  const ready = world.data?.versions.filter(version => version.status === 'ready') ?? [];
  const versionId = ready.some(version => version.worldVersionId === chosenVersion) ? chosenVersion : world.data?.world.currentVersionId ?? ready[0]?.worldVersionId;
  async function start() {
    setLocalError('');
    try { const result = await operation.perform(`/worlds/${worldId}/playthroughs`, { worldVersionId: versionId, ...context.funding() }, 'accepted'); if (result) followAccepted(result, context.navigate); }
    catch (failure) { setLocalError(describePublicError(failure)); }
  }
  async function generate(configuration: WorldConfiguration) {
    setLocalError('');
    try { const result = await operation.perform(`/worlds/${worldId}/versions`, { ...configuration, ...context.funding() }, 'accepted'); if (result) followAccepted(result, context.navigate); }
    catch (failure) { setLocalError(describePublicError(failure)); }
  }
  const busy = operation.busy || !!operation.pending;
  return <div className="mf-content"><div className="mf-page"><QueryStatus pending={world.isPending} error={world.error} retry={() => void world.refetch()} />{world.data && <>
    <section className="ew-intro"><div><span className="ew-tag">{difficultyLabels[world.data.world.difficulty]}</span><h2>{world.data.world.title}</h2><p>{world.data.world.summary}</p></div></section>
    <section className="ew-section ew-stack"><h2>选择这次的故事版本</h2><p className="mf-muted">每次开局都是独立记录。已开始的路线始终保留原版本。</p><label className="mf-field ew-version-select">剧本版本<select value={versionId ?? ''} onChange={event => setChosenVersion(event.target.value)} disabled={busy || !ready.length}>{!ready.length && <option value="">尚无可玩版本</option>}{ready.map(version => <option key={version.worldVersionId} value={version.worldVersionId}>版本 {version.versionNo}</option>)}</select></label><div className="mf-row mf-wrap"><Button variant="primary" disabled={busy || !versionId || !world.data.allowedActions.canStart} onClick={() => void start()}>开始游玩</Button><Button disabled={busy || !world.data.allowedActions.canGenerateVersion} onClick={() => setGenerating(true)}>生成新版本</Button></div></section>
    {!!world.data.playthroughs.length && <section className="ew-section"><h2>你的游玩记录</h2><div className="ew-world-grid">{world.data.playthroughs.map(play => <article className="ew-world-card" key={play.playthroughId}><span className="ew-tag">{branchLabels[play.branchStatus]}</span><h3>{play.location}</h3><Button onClick={() => context.navigate(playAddress(play.playthroughId, play.branchId))}>打开路线</Button></article>)}</div></section>}
  </>}{localError && <p role="alert" className="mf-status mf-status--error">{localError}</p>}<OperationNotice operation={operation} apiKey={context.apiKey} onResult={result => { if ('operationId' in result) followAccepted(result as Accepted, context.navigate); }} />
  {generating && <WorldConfigurationDialog title="生成新版本" busy={busy} onClose={() => setGenerating(false)} onSubmit={configuration => void generate(configuration)} error={localError || (operation.error ? describePublicError(operation.error) : '')} />}
  </div></div>;
}
