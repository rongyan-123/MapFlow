import type { AgentCompletion } from '../../api/agentExecutionClient';
import { useMapResults } from '../../domains/maps/useMapResults';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Icon } from '../Icon';
function navigate(address:string){window.history.pushState({},'',address);window.dispatchEvent(new PopStateEvent('popstate'));}
export default function AgentMapResults(props:{completion:AgentCompletion;accountId:string;csrfToken:string;onNavigate?:(address:string)=>void}){
  const onNavigate=props.onNavigate??navigate;const {joining,error,learn}=useMapResults({...props,onNavigate});
  if(!props.completion.maps.length)return null;
  return <section aria-label="已保存的地图" className="mf-map-results">{props.completion.maps.map(map=><article className="mf-map-result" key={map.libraryEntryId}>
    <div className="mf-map-result-title"><span className="mf-pill mf-pill--green"><Icon name="check" />地图已保存</span><h3>{map.title}</h3></div>
    <div className="mf-map-result-actions"><Button aria-label={`查看 ${map.title}`} onClick={()=>onNavigate(`/maps?entry=${encodeURIComponent(map.libraryEntryId)}`)}>查看地图</Button><Button variant="primary" aria-label={`学习 ${map.title}`} disabled={joining!==null} onClick={()=>void learn(map.libraryEntryId)}>{joining===map.libraryEntryId?'正在进入…':'进入学习'}</Button></div>
  </article>)}{Boolean(error) && <p role="alert" className="mf-status mf-status--error">{describePublicError(error)}</p>}</section>;
}
