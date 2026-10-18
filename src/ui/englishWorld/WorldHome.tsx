import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWorlds } from '../../api/englishWorldClient';
import { useWorldOperation } from '../../domains/englishWorld/operations';
import { worldKeys } from '../../domains/englishWorld/queryKeys';
import type { Accepted, WorldConfiguration } from '../../domains/englishWorld/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { QueryStatus } from '../QueryStatus';
import { WorldConfigurationDialog } from './WorldConfigurationDialog';
import { OperationNotice, branchLabels, difficultyLabels, followAccepted, playAddress, type WorldPageContext } from './shared';

export function WorldHome(context: WorldPageContext) {
  const worlds = useQuery({ queryKey: worldKeys.worlds(context.accountId), queryFn: ({ signal }) => fetchWorlds(signal), retry: false });
  const operation = useWorldOperation(context.accountId, 'create', context.csrfToken);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  async function create(configuration: WorldConfiguration) {
    setFormError('');
    try {
      const result = await operation.perform('/worlds', { ...configuration, ...context.funding() }, 'accepted');
      if (result) { setCreating(false); followAccepted(result, context.navigate); }
    } catch (failure) { setFormError(describePublicError(failure)); }
  }
  return <div className="mf-content"><div className="mf-page ew-home">
    <section className="ew-intro"><div><p className="mf-eyebrow">ENGLISH WORLD</p><h2>用英语，走进故事。</h2><p>听人物说话，寻找线索，自己决定下一步。每段人物台词可以选择一个词，确认后查看语境中的意思。</p></div><Button variant="primary" disabled={worlds.isPending || !!worlds.error || operation.busy || !!operation.pending} onClick={() => setCreating(true)}><Icon name="plus" />创建世界</Button></section>
    <QueryStatus pending={worlds.isPending} error={worlds.error} retry={() => void worlds.refetch()} />
    <OperationNotice operation={operation} apiKey={context.apiKey} onResult={result => { if ('operationId' in result) followAccepted(result as Accepted, context.navigate); }} />
    {operation.kind === 'accepted' && operation.result && 'operationId' in operation.result && <Button onClick={() => followAccepted(operation.result as Accepted, context.navigate)}>查看原请求结果</Button>}
    {worlds.data && <>
      <div className="ew-overview"><span><strong>{worlds.data.worlds.length}</strong> 个保存的世界</span><Button variant="quiet" onClick={() => context.navigate('/english-world/review')}>待复习 {worlds.data.reviewCount} 词<Icon name="right" /></Button></div>
      {!!worlds.data.recentPlaythroughs.length && <section className="ew-section"><h2>继续你的路线</h2><div className="ew-world-grid">{worlds.data.recentPlaythroughs.map(play => <article className="ew-world-card" key={play.playthroughId}><span className="ew-tag">{branchLabels[play.branchStatus]}</span><h3>{play.worldTitle}</h3><p>{play.location}</p><Button onClick={() => context.navigate(playAddress(play.playthroughId, play.branchId))}>{play.branchStatus === 'active' ? '继续游玩' : '查看这条路线'}</Button></article>)}</div></section>}
      <section className="ew-section"><h2>我的世界</h2>{!worlds.data.worlds.length ? <div className="ew-empty"><Icon name="book" /><h3>你的第一个世界，等你开启。</h3><p>从一个题材开始，准备一段属于你的英文案件。</p></div> : <div className="ew-world-grid">{worlds.data.worlds.map(world => <article className="ew-world-card" key={world.worldId}><div className="ew-card-meta"><span className="ew-tag">{difficultyLabels[world.difficulty]}</span><span>{world.status === 'ready' ? '可以开始' : world.status === 'preparing' ? '正在准备' : world.status === 'failed' ? '准备未完成' : '已归档'}</span></div><h3>{world.title}</h3><p>{world.summary}</p><Button onClick={() => context.navigate(world.activeTaskId ? '/english-world/prepare/' + world.activeTaskId : '/english-world/worlds/' + world.worldId)}>{world.activeTaskId ? '查看准备进度' : '查看世界'}</Button></article>)}</div>}</section>
    </>}
    {creating && <WorldConfigurationDialog busy={operation.busy || !!operation.pending} onClose={() => setCreating(false)} onSubmit={configuration => void create(configuration)} error={formError || (operation.error ? describePublicError(operation.error) : '')} />}
  </div></div>;
}
