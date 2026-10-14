import { useCharacterEditor,type CharacterEditorProps } from '../../domains/characters/useCharacterEditor';
import { describePublicError } from '../../lib/publicErrors';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
type Props=CharacterEditorProps&{renameOnly:boolean;onClose:()=>void};
export default function EditCharacterDialog(props:Props){
  const state=useCharacterEditor(props);
  const field=(key:'description'|'personality'|'scenario'|'firstMessage'|'exampleDialogue'|'systemPrompt'|'postHistoryInstructions'|'creatorNotes',label:string,rows=3)=><label className="mf-field" key={key}>{label}<textarea rows={rows} value={state.draft[key]} disabled={state.busy} onChange={event=>state.setDraft(previous=>({...previous,[key]:event.target.value}))} /></label>;
  return <Dialog title={props.renameOnly?'重命名角色卡':'编辑角色卡'} dismissible={!state.busy} onClose={props.onClose}><form className="mf-stack" noValidate onSubmit={event=>{event.preventDefault();void state.save();}}><p className="mf-muted mf-small">保存到角色库，供新会话使用。已有会话保持原设定。</p>{props.conversation&&<label className="mf-row mf-small"><input type="checkbox" checked={state.applyToConversation} disabled={state.busy} onChange={event=>state.setApplyToConversation(event.target.checked)} />同时应用到当前会话（从下一轮生效）</label>}
    <label className="mf-field">角色名称<input value={state.draft.name} disabled={state.busy} onChange={event=>state.setDraft(previous=>({...previous,name:event.target.value}))} /></label>{!props.renameOnly&&<>{field('description','角色设定（提示词）',6)}{field('personality','性格')}{field('scenario','场景')}{field('firstMessage','开场白（用于新会话）')}<details className="mf-status"><summary>高级设定</summary><div className="mf-stack">{field('exampleDialogue','示例对话')}{field('systemPrompt','系统提示词')}{field('postHistoryInstructions','历史后指令')}{field('creatorNotes','作者备注')}<small className="mf-muted">世界书、备选开场白和原始文件会保留。</small></div></details></>}{Boolean(state.error)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(state.error)}</p>}<div className="mf-row"><Button type="submit" variant="primary" disabled={state.busy}>{state.busy?'保存中…':props.renameOnly?'保存名称':'保存修改'}</Button><Button disabled={state.busy} onClick={props.onClose}>取消</Button></div>
  </form></Dialog>;
}
