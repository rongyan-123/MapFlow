import { useCharacterCreation } from '../../domains/characters/useCharacterCreation';
import type { Character } from '../../domains/conversations/types';
import { describePublicError } from '../../lib/publicErrors';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
export default function CreateCharacterDialog(props:{csrfToken:string;onCreated:(character:Character)=>void;onClose:()=>void}){
  const state=useCharacterCreation(props);
  return <Dialog title="创建角色卡" onClose={props.onClose} dismissible={!state.saving}><form className="mf-stack" noValidate onSubmit={event=>{event.preventDefault();void state.save();}}><p className="mf-muted mf-small">写下角色的身份、性格和聊天方式。角色保存到你的私有角色库，创建角色不扣费。</p>
    <label className="mf-field">角色名称<input value={state.name} disabled={state.saving} onChange={event=>state.setName(event.target.value)} /></label><label className="mf-field">角色设定（提示词）<textarea rows={6} value={state.description} disabled={state.saving} onChange={event=>state.setDescription(event.target.value)} placeholder="角色的身份、性格与说话方式" /></label><label className="mf-field">开场白（可选）<textarea rows={3} value={state.opening} disabled={state.saving} onChange={event=>state.setOpening(event.target.value)} /></label>{Boolean(state.error)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(state.error)}</p>}<Button type="submit" variant="primary" disabled={state.saving}>{state.saving?'正在保存…':'保存角色卡'}</Button>
  </form></Dialog>;
}
