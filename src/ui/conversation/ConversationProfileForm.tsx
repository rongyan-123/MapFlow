import { useConversationProfile,type ProfileProps } from '../../domains/conversations/useConversationProfile';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
export default function ConversationProfileForm(props:ProfileProps){
  const state=useConversationProfile(props);const {busy}=state;
  return <form className="mf-stack" onSubmit={event=>{event.preventDefault();void state.save();}}><h3>会话设定</h3><p className="mf-muted mf-small">修改从下一轮生效。已发生的故事和开场白保留在历史中。</p>
    <label className="mf-field">用户称呼<input value={state.userName} disabled={busy} required onChange={event=>state.setUserName(event.target.value)} /></label><label className="mf-field">Persona（可选）<textarea rows={3} value={state.persona} disabled={busy} onChange={event=>state.setPersona(event.target.value)} placeholder="你在故事中的身份、性格或背景" /></label><label className="mf-field">学习词表（可选）<textarea rows={4} value={state.vocabulary} disabled={busy} onChange={event=>state.setVocabulary(event.target.value)} placeholder="每行一个词或短语，可附释义" /></label><small className="mf-muted">最多 50 项，总计 2 KiB；自然融入对话。</small>
    {state.canChangeGreeting?<label className="mf-field">开场白<select value={state.greeting} disabled={busy} onChange={event=>state.setGreeting(event.target.value)}><option value="">保留当前开场白</option>{[props.detail.character.card.firstMessage,...props.detail.character.card.alternateGreetings].map((text,index)=><option key={index} value={index}>{index?`备选开场白 ${index}`:'默认开场白'} · {text.slice(0,60)}</option>)}</select></label>:<p className="mf-muted mf-small">故事已开始，开场白不再替换。</p>}
    {Boolean(state.error)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(state.error)}</p>}<Button type="submit" variant="primary" disabled={busy||!state.userName.trim()}>{busy?'保存中…':'保存会话设定'}</Button>{state.saved&&<p role="status" className="mf-status">会话设定已保存</p>}
  </form>;
}
