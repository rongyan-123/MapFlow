import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {fetchModelCatalog,syncModelCatalog,createModelVerificationBatch,fetchModelVerificationBatch,cancelModelVerificationBatch,recheckModelVerificationBatch,setModelAvailability,setDefaultCashModel,type ModelCandidate} from '../../api/agentModelCatalogClient';
import {Button} from '../../ui/Button';
import {QueryStatus} from '../../ui/QueryStatus';

const attemptLabels:Record<string,string>={queued:'等待验证',running:'验证中',completed:'验证通过',failed:'验证未通过',outcome_unknown:'结果待确认',blocked_reconstruction:'恢复资料不完整',cancelled:'已取消',superseded:'配置已更新，旧结果已归档'};
function canVerify(model:ModelCandidate){return model.status==='active'&&model.adminEnabled&&model.profileId&&!model.selectable
  && !['queued','running','outcome_unknown','blocked_reconstruction'].includes(model.latestAttempt?.state??'');}
export default function ModelCatalogPanel({csrfToken,sources,defaultEpoch,onDefaultChanged}:{csrfToken:string;sources:{id:string;name:string}[];defaultEpoch:number;onDefaultChanged:()=>void}){
  const client=useQueryClient();const [source,setSource]=useState('');const [search,setSearch]=useState('');const [selectedBatch,setBatch]=useState<string|null>(null);
  const batchAction=useRef<{key:string;id:string}|null>(null);const syncAction=useRef<string|null>(null);
  const query=useQuery({queryKey:['admin','agent-model-catalog'],queryFn:fetchModelCatalog,retry:false,
    refetchInterval:current=>current.state.data?.lastSync?.state==='fetching'||current.state.data?.candidates.some(model=>['queued','running'].includes(model.latestAttempt?.state??''))?2000:false});
  const refresh=()=>{void client.invalidateQueries({queryKey:['admin','agent-model-catalog']});void client.invalidateQueries({queryKey:['me']});};
  const sync=useMutation({mutationFn:()=>{
    syncAction.current??=crypto.randomUUID();return syncModelCatalog(syncAction.current,source||sources[0]?.id||'',csrfToken);
  },onSuccess:()=>{syncAction.current=null;refresh();},retry:false});
  const verify=useMutation({mutationFn:(ids:string[])=>{
    const key=[...ids].sort().join('\n');if(batchAction.current?.key!==key)batchAction.current={key,id:crypto.randomUUID()};
    return createModelVerificationBatch(batchAction.current.id,ids,csrfToken);
  },onSuccess:batch=>{setBatch(batch.batchId);batchAction.current=null;client.setQueryData(['admin','model-probe-batch',batch.batchId],batch);refresh();},retry:false});
  const availability=useMutation({mutationFn:(model:ModelCandidate)=>setModelAvailability(model.profileId!,model.publicationGeneration!,!model.adminEnabled,csrfToken),onSuccess:refresh,retry:false});
  const makeDefault=useMutation({mutationFn:(model:ModelCandidate)=>setDefaultCashModel(model.profileId!,model.profileVersion!,model.publicationGeneration!,defaultEpoch,csrfToken),onSuccess:()=>{refresh();onDefaultChanged();},retry:false});
  const id=selectedBatch??query.data?.recentBatches[0];
  const batch=useQuery({queryKey:['admin','model-probe-batch',id],queryFn:()=>fetchModelVerificationBatch(id!),enabled:!!id,retry:false,
    refetchInterval:current=>current.state.data?.attempts.some(attempt=>['queued','running'].includes(attempt.state))?2000:false});
  const terminalStates=batch.data?.attempts.filter(attempt=>!['queued','running'].includes(attempt.state)).map(attempt=>`${attempt.attemptId}:${attempt.state}`).join('|');
  useEffect(()=>{if(terminalStates){void client.invalidateQueries({queryKey:['admin','agent-model-catalog']});void client.invalidateQueries({queryKey:['me']});}},[client,id,terminalStates]);
  const cancel=useMutation({mutationFn:()=>cancelModelVerificationBatch(id!,csrfToken),onSuccess:saved=>{client.setQueryData(['admin','model-probe-batch',id],saved);refresh();},retry:false});
  const recheck=useMutation({mutationFn:()=>recheckModelVerificationBatch(id!,csrfToken),onSuccess:saved=>{client.setQueryData(['admin','model-probe-batch',id],saved);refresh();},retry:false});
  const candidates=query.data?.candidates??[];const pending=candidates.filter(canVerify).map(model=>model.profileId!);
  const needle=search.trim().toLocaleLowerCase();const shown=candidates.filter(model=>`${model.modelId} ${model.displayName}`.toLocaleLowerCase().includes(needle));
  const busy=sync.isPending||verify.isPending||availability.isPending||makeDefault.isPending;
  return <section className="mf-card mf-stack" aria-label="上游聊天模型目录">
    <div className="mf-row mf-row--between mf-wrap"><div><h3>聊天模型目录</h3><p className="mf-muted mf-small">同步目录后验证可用模型。开放选择与设为默认分别操作。</p></div>
      <div className="mf-row mf-wrap"><Button disabled={query.isFetching} onClick={()=>void query.refetch()}>重新读取目录</Button><Button disabled={!sources.length||sync.isPending||query.data?.lastSync?.state==='fetching'} onClick={()=>sync.mutate()}>{sync.isPending||query.data?.lastSync?.state==='fetching'?'正在同步目录…':'同步上游目录'}</Button></div></div>
    {sources.length>1&&<label className="mf-field">沿用已保存的接入凭据<select value={source||sources[0]?.id} onChange={event=>setSource(event.target.value)}>{sources.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
    {!sources.length&&<p className="mf-muted mf-small">请先保存一个现金模型接入配置，目录同步会沿用它的凭据。</p>}
    <QueryStatus pending={query.isPending} error={query.error} retry={()=>void query.refetch()} />
    <QueryStatus error={sync.error??verify.error??availability.error??makeDefault.error??cancel.error??recheck.error} />
    {query.data?.lastSync?.reason&&<p role="status" className="mf-status">{query.data.lastSync.reason}</p>}
    {!!candidates.length&&<><div className="mf-row mf-row--between mf-wrap"><label className="mf-field">查找模型<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="名称或模型 ID" /></label>
      <Button variant="primary" disabled={busy||!pending.length} onClick={()=>verify.mutate(pending)}>验证待开放模型（{pending.length}）</Button></div>
      <p className="mf-muted mf-small">验证会调用上游并产生接入账号费用，不扣用户额度。结果未知的调用会保留原记录，不自动重试。共 {candidates.length} 项，已开放 {candidates.filter(model=>model.selectable).length} 项。</p>
      <div className="mf-grid mf-grid--2">{shown.map(model=><article className="mf-card mf-stack" key={model.profileId??model.modelId}><div><h4>{model.displayName}</h4><p className="mf-muted mf-small" style={{overflowWrap:'anywhere'}}>{model.modelId}</p></div>
        <p className="mf-small">{model.selectable?'已开放选择':!model.adminEnabled&&model.profileId?'管理员已停用':model.latestAttempt?attemptLabels[model.latestAttempt.state]??'状态待确认':model.status==='unadapted'?'尚未适配':model.status==='disabled'?'上游已停用':model.status==='unknown'?'上游状态待确认':'等待验证'}</p>
        {(model.reason||model.latestAttempt?.reason)&&<p className="mf-small mf-muted" style={{overflowWrap:'anywhere'}}>{model.reason||model.latestAttempt?.reason}</p>}
        <div className="mf-row mf-wrap">{canVerify(model)&&<Button disabled={busy} onClick={()=>verify.mutate([model.profileId!])}>验证 {model.displayName}</Button>}
          {model.selectable&&<Button disabled={busy} onClick={()=>makeDefault.mutate(model)}>设为现金默认</Button>}
          {model.profileId&&<Button disabled={busy} onClick={()=>availability.mutate(model)}>{model.adminEnabled?'暂停开放':'允许验证开放'}</Button>}
          {model.latestAttempt&&<Button onClick={()=>setBatch(model.latestAttempt!.batchId)}>查看验证记录</Button>}</div>
      </article>)}</div></>}
    {id&&<details open className="mf-status mf-stack"><summary>验证记录</summary><QueryStatus pending={batch.isPending} error={batch.error} retry={()=>void batch.refetch()} />
      {batch.data?.attempts.map(attempt=><div key={attempt.attemptId} className="mf-stack"><strong style={{overflowWrap:'anywhere'}}>{attempt.profileId} · {attemptLabels[attempt.state]??attempt.state}</strong>{attempt.reason&&<small style={{overflowWrap:'anywhere'}}>{attempt.reason}</small>}</div>)}
      {batch.data?.attempts.some(attempt=>['queued','running'].includes(attempt.state))&&<Button disabled={cancel.isPending||batch.data.cancelRequested} onClick={()=>cancel.mutate()}>取消本批验证</Button>}
      {batch.data?.attempts.some(attempt=>['failed','outcome_unknown','blocked_reconstruction'].includes(attempt.state))&&<Button disabled={recheck.isPending} onClick={()=>recheck.mutate()}>核对原验证记录（不调用模型）</Button>}
    </details>}
  </section>;
}
