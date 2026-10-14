import type { useConversationExecution } from '../../domains/conversations/useConversationExecution';
import { continuationRoot } from '../../domains/conversations/useConversationExecution';
import type { AgentCompletion } from '../../api/agentExecutionClient';
import type { GenerationProcessEvent } from '../../domains/conversations/types';
import { formatAmountMicros } from '../../api/walletClient';
import { formatCreditAmount } from '../../api/creditClient';
import type { Navigate } from '../../app/useLocation';
import SafeMarkdown from '../SafeMarkdown';
import { CharacterAvatar } from './CharacterPresentation';
import AgentMapResults from './AgentMapResults';
type State=ReturnType<typeof useConversationExecution>;
const toolNames:Record<string,string>={read_canvas:'读取画布',apply_canvas_patch:'绘图',read_skill_tree:'读取地图概览',read_tree_overview:'读取地图概览',find_tree_nodes:'查找知识点',read_tree_node:'读取节点资料',read_node_relations:'读取节点关系',web_search:'搜索资料',personal_tree_mutation:'修改地图',map_draft_begin:'规划学习地图',map_draft_apply:'整理学习地图',map_draft_publish:'保存学习地图'};
export function ProcessInfo({events,live=false}:{events:GenerationProcessEvent[];live?:boolean}){
  const reasoning=events.flatMap(event=>event.type==='reasoning'?[event.text]:[]).join('');const tools=events.filter((event):event is Extract<GenerationProcessEvent,{type:'tool'}>=>event.type==='tool');const latest=tools[tools.length-1];
  if(!reasoning&&!latest)return null;
  return <div className="mf-process-info">{reasoning&&<details><summary>思考过程</summary><pre>{reasoning}</pre></details>}{latest&&<p role="status">{live&&latest.state==='started'?'正在':''}{toolNames[latest.name]??'执行工具'}{latest.state==='completed'?' · 已完成':latest.state==='failed'?' · 未完成':''}</p>}{!live&&tools.length>2&&<details><summary>工具过程</summary><ol>{tools.map((tool,index)=><li key={index}>{toolNames[tool.name]??'工具'} · {tool.state==='completed'?'完成':tool.state==='failed'?'失败':'开始'}</li>)}</ol></details>}</div>;
}
function UsageSummary({completion}:{completion:AgentCompletion}){
  const pending=['pending_evidence','pending_posting'].includes(completion.settlement.status);
  const fee=pending?'结果已保存，费用待核对。':completion.settlement.cashMicros!==null?`本次费用 ¥${formatAmountMicros(completion.settlement.cashMicros)}`:completion.settlement.pointUnits!==null?`本次消耗 ${formatCreditAmount(completion.settlement.pointUnits/1_000_000)} 积分`:'未扣本站额度。';
  return <details className="mf-usage"><summary>{fee} <span>用量明细</span></summary>{completion.usage&&<p>输入 {completion.usage.inputTokens} · 输出 {completion.usage.outputTokens} Token</p>}{completion.settlement.balanceMicros!==null&&<p>现金余额 ¥{formatAmountMicros(completion.settlement.balanceMicros)}</p>}</details>;
}
function Message({text,author,user,character}:{text:string;author:string;user:boolean;character?:State['detail']['character']}){
  return <article className={`mf-message ${user?'mf-message--user':''}`}>{!user&&<CharacterAvatar name={author} character={character} />}<div><p className={user?'mf-sr-only':'mf-message-author'}>{author}</p><SafeMarkdown markdown={text} /></div></article>;
}
export function ConversationMessages({state,accountId,csrfToken,navigate,welcome=false}:{state:State;accountId:string;csrfToken:string;navigate:Navigate;welcome?:boolean}){
  const {detail}=state;const completion=state.nativeSnapshot?.completion;const completionInHistory=!!completion&&detail.graph.messages.some(message=>message.messageId===completion.messageId);
  const attached=(messageId:string,rootId:string)=>messageId===rootId||state.activeMessages.some(message=>message.messageId===messageId&&message.origin==='continue'&&continuationRoot(message,state.messagesById,state.roleChangeAnchors)===rootId);
  return <>
    {(detail.roleChanges??[]).filter(change=>change.afterMessageId===null).map(change=><p key={change.changeId} className="mf-role-change">已切换角色：{change.characterName}</p>)}
    {state.displayMessages.filter(message=>!welcome||detail.conversation.scene==='tavern'||message.origin!=='opening').map(message=><div key={message.messageId}>
      <ProcessInfo events={detail.generations.filter(generation=>generation.outputMessageId===message.messageId).flatMap(generation=>generation.process??[])} />
      <Message text={message.content} user={message.role==='user'} author={message.role==='user'?detail.conversation.userName:message.role==='system'?'系统':state.historicalAuthors.get(message.messageId)??'历史角色'} character={message.characterId===detail.character.characterId?detail.character:undefined} />
      {(detail.agentResults??[]).filter(result=>attached(result.messageId,message.messageId)).map(saved=>{const receipt=completion?.executionId===saved.executionId?completion:saved;return <div key={receipt.executionId}><AgentMapResults completion={receipt} accountId={accountId} csrfToken={csrfToken} onNavigate={navigate} /><UsageSummary completion={receipt} /></div>;})}
      {(detail.cashCharges??[]).filter(charge=>attached(charge.outputMessageId,message.messageId)&&!(detail.agentResults??[]).some(receipt=>receipt.generationId===charge.generationId)).map(charge=><details className="mf-usage" key={charge.generationId}><summary>本次费用 ¥{formatAmountMicros(charge.amountMicros)}</summary><p>现金余额 ¥{formatAmountMicros(charge.balanceAfterMicros)}</p></details>)}
      {(detail.roleChanges??[]).filter(change=>change.afterMessageId&&attached(change.afterMessageId,message.messageId)).map(change=><p className="mf-role-change" key={change.changeId}>已切换角色：{change.characterName}</p>)}
    </div>)}
    {!completionInHistory&&(state.draft||completion||state.busy)&&<><ProcessInfo events={state.process} live={state.busy} /><Message user={false} text={completion?.answer??state.draft} author={detail.character.card.name} character={detail.character} />{state.busy&&<p className="mf-thinking" role="status"><span className="mf-spinner" />正在生成…</p>}{completion&&<><AgentMapResults completion={completion} accountId={accountId} csrfToken={csrfToken} onNavigate={navigate} /><UsageSummary completion={completion} /></>}</>}
    <div ref={state.bottom} />
  </>;
}
