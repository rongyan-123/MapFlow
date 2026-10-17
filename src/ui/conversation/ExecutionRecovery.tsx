import {useQuery} from '@tanstack/react-query';
import {AgentApiError,fetchAgentExecutionControl,type AgentExecutionControl,type AgentState,type AgentFunding} from '../../api/agentExecutionClient';
import {describePublicError} from '../../lib/publicErrors';
import {Button} from '../Button';

interface Props {
  accountId:string;conversationId:string;executionId:string;state:AgentState;funding:AgentFunding;legacyErrorCode?:string;
  control?:AgentExecutionControl|null;controlAvailability?:'unknown'|'ready'|'unsupported'|'unavailable';
  error?:unknown;busy?:boolean;stopRequested?:boolean;
  onCheck:()=>void;onResume:()=>void;onStop:()=>void;stopLabel?:string;
}
/** Recovery actions use a separate versioned capability query; an unknown external call is never re-sent. */
export function ExecutionRecovery(props:Props){
  const query=useQuery({queryKey:['me',props.accountId,'execution-control',props.executionId,props.state,props.legacyErrorCode],
    queryFn:({signal})=>fetchAgentExecutionControl(props.executionId,props.conversationId,signal),
    enabled:props.controlAvailability===undefined,retry:false});
  const control=props.controlAvailability===undefined?query.data:props.control;
  const matched=control?.executionId===props.executionId&&control.state===props.state?control:null;
  const unsupported=props.controlAvailability==='unsupported'||props.controlAvailability===undefined&&query.isSuccess&&query.data===null;
  const terminal=['succeeded','stopped','failed'].includes(props.state);
  const resume=matched?.actions.canResume===true||unsupported&&props.funding==='byok'&&props.state==='awaiting_reconciliation'&&props.legacyErrorCode==='credential_required';
  const credential=resume&&(matched?.actions.needsCredential===true||!matched);
  const reason=terminal||props.state==='awaiting_reconciliation'?matched?.reason:undefined;
  const failure=reason&&['external_outcome_unknown','authentication','rate_limited','provider_balance_insufficient','network','context_window_exceeded'].includes(reason)
    ?new AgentApiError(reason,400):props.error;
  return <>
    {Boolean(failure)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(failure)}</p>}
    {!terminal&&<div className="mf-runtime-actions">
      <Button disabled={props.busy} onClick={()=>{props.onCheck();if(props.controlAvailability===undefined)void query.refetch();}}>核对原请求</Button>
      {resume&&<Button disabled={props.busy} onClick={props.onResume}>{credential?'补充 API Key':'继续原请求'}</Button>}
      <Button disabled={props.busy} onClick={props.onStop}>{props.stopRequested?'重新确认停止':props.stopLabel??'停止原请求后继续'}</Button>
    </div>}
  </>;
}
