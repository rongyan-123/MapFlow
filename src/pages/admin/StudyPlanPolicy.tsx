import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readPlanPolicy,savePlanPolicy,publishPlanPolicy,type PlanPolicy} from '../../api/studyPlanClient';
import {describePublicError} from '../../lib/publicErrors';
import {Button} from '../../ui/Button';
export default function StudyPlanPolicy({accountId,csrfToken}:{accountId:string;csrfToken:string}){
  const key=['admin',accountId,'study-plan-policy'];const client=useQueryClient();const query=useQuery({queryKey:key,queryFn:readPlanPolicy,retry:false});
  if(query.isPending)return <p role="status">正在读取计划策略…</p>;
  if(!query.data)return <p role="alert" className="mf-status">{describePublicError(query.error)} <Button onClick={()=>void query.refetch()}>重试</Button></p>;
  return <PolicyEditor key={query.data.revision} policy={query.data} csrfToken={csrfToken} onUpdated={saved=>client.setQueryData(key,saved)} />;
}
function PolicyEditor({policy,csrfToken,onUpdated}:{policy:PlanPolicy;csrfToken:string;onUpdated:(saved:PlanPolicy)=>void}){
  const [draft,setDraft]=useState(policy.draft);const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>(null);const dirty=draft!==policy.draft;
  async function update(action:'save'|'publish',rollback:number|null=null){if(busy)return;setBusy(true);setError(null);try{onUpdated(await (action==='save'?savePlanPolicy(policy.revision,draft,csrfToken):publishPlanPolicy(policy.revision,rollback,csrfToken)));}catch(cause){setError(cause);}finally{setBusy(false);}}
  return <section className="mf-stack"><div className="mf-card mf-stack"><h2>学习计划策略</h2><p>已发布版本 {policy.publishedVersion} · 固定 Skill {policy.skillVersion} · 提交契约 {policy.toolVersion}</p><p className="mf-muted">策略控制学习节奏、重点与估时。授权、完整覆盖、前置顺序、每日预算和计费规则由宿主校验，策略无法放宽。发布仅影响新任务。</p><label className="mf-field">策略草稿<textarea rows={12} maxLength={16000} disabled={busy} value={draft} onChange={event=>setDraft(event.target.value)} /></label><div className="mf-row mf-wrap"><Button disabled={busy||!dirty||!draft.trim()} onClick={()=>void update('save')}>保存草稿</Button><Button variant="primary" disabled={busy||dirty} onClick={()=>void update('publish')}>发布当前草稿</Button>{dirty&&<small>先保存草稿，再发布。</small>}</div>{!!error&&<p role="alert" className="mf-status mf-status--error">{describePublicError(error)}</p>}</div><h3>版本记录</h3>{policy.versions.map(version=><details className="mf-card" key={version.version}><summary>版本 {version.version}{version.version===policy.publishedVersion?' · 当前发布':''} · {new Date(version.createdAt).toLocaleString()}</summary><p style={{whiteSpace:'pre-wrap'}}>{version.body}</p>{version.rollbackOf&&<p>由版本 {version.rollbackOf} 回滚发布。</p>}<Button disabled={busy||version.version===policy.publishedVersion} onClick={()=>void update('publish',version.version)}>将此版本发布为新版本</Button></details>)}</section>;
}
