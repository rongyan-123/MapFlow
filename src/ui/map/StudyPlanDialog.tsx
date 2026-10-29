import {useEffect,useRef,useState} from 'react';
import {StudyPlanApiError,createStudyPlan,stopStudyPlan,resumeStudyPlan,type StudyPlanState,type PlanConditions} from '../../api/studyPlanClient';
import {useAgentModelConfiguration} from '../../domains/models/AgentModelContext';
import {useSharedModelSelection} from '../../domains/models/ModelSelectionContext';
import {describePublicError} from '../../lib/publicErrors';
import {Dialog} from '../Dialog';
import {Button} from '../Button';
import ModelSettings from '../conversation/ModelSettings';
interface Props{accountId:string;entryId:string;csrfToken:string;title:string;total:number;remaining:number;state:StudyPlanState;onClose:()=>void;onChanged:()=>void}
interface PendingCommand{clientActionId:string;conditions:PlanConditions;funding:string;profileId?:string;profileVersion?:number;modelAccess?:{baseUrl:string;model:string;contextWindow:number;maxOutputTokens:number|null;reasoningProtocol:string;reasoningSupported:boolean}}
const active=(state:string|undefined)=>!!state&&!['succeeded','failed','stopped'].includes(state);
export default function StudyPlanDialog({accountId,entryId,csrfToken,title,total,remaining,state,onClose,onChanged}:Props){
  const model=useAgentModelConfiguration('study_plan');const shared=useSharedModelSelection('study_plan')!;
  const commandKey=`mapflow.pending-plan.v1.${accountId}.${entryId}`;
  const [original,setOriginal]=useState<PendingCommand|null>(()=>{try{return JSON.parse(localStorage.getItem(commandKey)??'null');}catch{return null;}});
  const initial=original?.conditions??state.task?.conditions??state.plan?.conditions;
  const [deadline,setDeadline]=useState(initial?.deadline??'');const [start,setStart]=useState(initial?.startDate??'');const [minutes,setMinutes]=useState(initial?.dailyMinutes?.toString()??'');const [timezone]=useState(initial?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [settings,setSettings]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');const inFlight=useRef(false);
  useEffect(()=>{if(original&&state.task?.clientActionId===original.clientActionId){localStorage.removeItem(commandKey);setOriginal(null);}},[original,state.task?.clientActionId,commandKey]);
  const taskActive=active(state.task?.state)&&!state.task?.accepted;
  const funding=model.options.funding;const modelName=model.options.modelLabel??shared.selection.model??'配置模型';
  const modelReady=model.ready&&(funding==='cash'?!!model.cash:funding==='points'?!!model.catalogue.data?.points:!!shared.selection.apiKey&&!!shared.selection.model&&!!shared.selection.baseUrl&&!!model.options.contextWindow);
  async function generate(){
    if(inFlight.current||taskActive||!remaining)return;
    if(!original&&(!deadline||start&&deadline<start||minutes&&(!Number.isInteger(Number(minutes))||Number(minutes)<1||Number(minutes)>1440))){setError('请填写截止日期，并检查开始日期与每日分钟数。');return;}
    if(!modelReady){setError('请先为学习计划保存可用的模型配置。');return;}
    const command:PendingCommand=original??{clientActionId:crypto.randomUUID(),conditions:{deadline,startDate:start||null,dailyMinutes:minutes?Number(minutes):null,timezone,expectedVersion:state.version},funding,...(funding==='cash'?{profileId:model.options.profileId,profileVersion:model.options.profileVersion}:{}),...(funding==='byok'?{modelAccess:{baseUrl:shared.selection.baseUrl,model:shared.selection.model,contextWindow:model.options.contextWindow!,maxOutputTokens:model.options.maxOutputTokens??null,reasoningProtocol:model.options.reasoningProtocol??'none',reasoningSupported:model.options.reasoningSupported??false}}:{})};
    inFlight.current=true;setPending(true);setError('');setOriginal(command);try{localStorage.setItem(commandKey,JSON.stringify(command));}catch{/* The current component still holds the original identity. */}
    try{await createStudyPlan(entryId,{...command,...(command.modelAccess?{modelAccess:{...command.modelAccess,apiKey:shared.selection.apiKey}}:{})},csrfToken);localStorage.removeItem(commandKey);setOriginal(null);onChanged();onClose();}
    catch(cause){if(cause instanceof StudyPlanApiError&&cause.status>=400&&cause.status<500){localStorage.removeItem(commandKey);setOriginal(null);setError(describePublicError(cause));}else{setError(`${describePublicError(cause)} 可先核对任务，再使用原请求重试。`);}onChanged();}
    finally{inFlight.current=false;setPending(false);}
  }
  async function cancelTask(){if(!state.task||inFlight.current)return;inFlight.current=true;setPending(true);try{await stopStudyPlan(entryId,state.task.executionId,crypto.randomUUID(),csrfToken);localStorage.removeItem(commandKey);setOriginal(null);onChanged();}catch(cause){setError(describePublicError(cause));}finally{inFlight.current=false;setPending(false);}}
  async function resume(){if(!state.task||inFlight.current)return;inFlight.current=true;setPending(true);try{await resumeStudyPlan(entryId,state.task.executionId,shared.selection.apiKey||undefined,csrfToken);onChanged();}catch(cause){setError(describePublicError(cause));}finally{inFlight.current=false;setPending(false);}}
  return <Dialog title={settings?'学习计划模型':'制定学习计划'} onClose={settings?()=>setSettings(false):onClose} dismissible={!pending} className="mf-study-plan-dialog">
    {settings?<><Button onClick={()=>setSettings(false)}>返回计划条件</Button><ModelSettings onDone={()=>setSettings(false)} initialPurpose="study_plan" accountId={accountId} csrfToken={csrfToken} onWallet={()=>window.open('/wallet','_blank','noopener')} /></>:<form className="mf-plan-form" onSubmit={event=>{event.preventDefault();void generate();}}>
      <p className="mf-muted">范围：{title} · 全部 {total} 个知识点，安排剩余 {remaining} 个。</p>
      <label className="mf-field">截止日期（必填）<input aria-label="截止日期（必填）" type="date" required value={deadline} disabled={pending||taskActive||!!original} onChange={event=>setDeadline(event.target.value)} /><small>希望在这一天之前学完当前范围。</small></label>
      <div className="mf-plan-optionals"><label className="mf-field">开始日期（选填）<input type="date" value={start} disabled={pending||taskActive||!!original} onChange={event=>setStart(event.target.value)} /><small>留空则从今天开始。</small></label><label className="mf-field">每日可投入时间（分钟，选填）<input type="number" min={1} max={1440} step={1} value={minutes} disabled={pending||taskActive||!!original} onChange={event=>setMinutes(event.target.value)} placeholder="例如 60" /><small>留空则按截止日期估算。</small></label></div>
      <small className="mf-muted">日期按 {timezone} 计算。</small><div className="mf-plan-model"><span>计划使用的模型</span><Button disabled={pending||!!original} onClick={()=>setSettings(true)}>{modelName||'配置模型'} · {funding==='cash'?'现金额度':funding==='points'?'平台积分':'自填 Key'}</Button></div>
      {!remaining&&<p role="status" className="mf-status">当前范围已全部完成，无需生成计划。</p>}
      {taskActive&&<p role="status" className="mf-status">{state.task?.state==='awaiting_reconciliation'?'原任务等待凭据或用量核对。':'正在生成计划，关闭窗口后仍可回来查看。'}</p>}
      {state.task?.submission?.outcome==='needs_adjustment'&&<p role="status" className="mf-status">{state.task.submission.summary} · 之前的计划保持不变。</p>}
      {error&&<p role="alert" className="mf-status mf-status--error">{error}</p>}
      <p className="mf-muted mf-small">将结合知识点内容、已有进度和前置关系安排。时长为估计。成功后更新今天及以后的安排，历史计划保留。</p>
      <div className="mf-row mf-wrap"><Button disabled={pending} onClick={onClose}>关闭</Button>{taskActive?<><Button disabled={pending} onClick={onChanged}>核对任务</Button>{state.task?.state==='awaiting_reconciliation'&&<Button disabled={pending} onClick={()=>void resume()}>恢复原任务</Button>}<Button disabled={pending} onClick={()=>void cancelTask()}>取消生成</Button></>:<><Button variant="primary" type="submit" disabled={pending||!remaining||!modelReady}>{pending?'正在提交…':original?'重试原请求':'生成计划'}</Button>{original&&<Button disabled={pending} onClick={onChanged}>核对任务</Button>}</>}</div>
    </form>}
  </Dialog>;
}
