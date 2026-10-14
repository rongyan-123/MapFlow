import {Button} from './Button';
import {describePublicError} from '../lib/publicErrors';
export function QueryStatus({pending,error,retry}:{pending?:boolean;error?:unknown;retry?:()=>void}){return <>{pending&&<p role="status" className="mf-status">正在读取…</p>}{!!error&&<p role="alert" className="mf-status mf-status--error">{typeof error==='string'?error:describePublicError(error)} {retry&&<Button onClick={retry}>重新读取</Button>}</p>}</>;}
