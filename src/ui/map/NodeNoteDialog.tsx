import { useNodeNote,type NoteOwner } from '../../domains/notes/useNodeNote';
import { noteDraftKey } from '../../domains/notes/noteDrafts';
import { describePublicError } from '../../lib/publicErrors';
import SafeMarkdown from '../SafeMarkdown';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
type Props=NoteOwner&{nodeTitle:string};
export default function NodeNoteDialog(props:Props){return <NoteEditor key={noteDraftKey(props.accountId,props.libraryEntryId,props.nodeId)} {...props} />;}
function NoteEditor(props:Props){
  const state=useNodeNote(props);const {note,markdown,dirty,writing}=state;
  return <Dialog title={`${props.nodeTitle}的节点笔记`} onClose={state.close} dismissible={!writing} className="mf-note-dialog"
    footer={note.data && <><span className="mf-muted mf-small">{markdown.length.toLocaleString()} / 30,000</span><div className="mf-row">{note.data.has_note && <Button variant="danger" disabled={writing} onClick={state.remove}>删除笔记</Button>}<Button variant="primary" disabled={writing||!markdown.trim()||!dirty} onClick={state.save}>保存笔记</Button></div></>}>
    {note.isPending?<p role="status" className="mf-status">正在读取笔记…</p>:note.error?<div role="alert" className="mf-status mf-status--error">{describePublicError(note.error)} <Button onClick={()=>void note.refetch()}>重试读取</Button></div>:<div className="mf-stack"><div className="mf-row mf-row--between"><div className="mf-row"><Button aria-pressed={!state.preview} onClick={()=>state.setPreview(false)}>编辑</Button><Button aria-pressed={state.preview} onClick={()=>state.setPreview(true)}>预览</Button></div><small className="mf-muted">版本 {note.data?.version??0}</small></div>
      {state.currentDraft && state.currentDraft.baseVersion!==note.data?.version && dirty && <details className="mf-status mf-status--warning"><summary>服务器笔记有更新，展开核对</summary><SafeMarkdown markdown={note.data?.markdown??''} /></details>}
      {state.preview?<SafeMarkdown markdown={markdown} />:<label className="mf-field"><span className="mf-sr-only">Markdown 笔记</span><textarea aria-label="Markdown 笔记" className="mf-note-input" value={markdown} disabled={writing} maxLength={30000} onChange={event=>state.change(event.target.value)} placeholder="写下理解、易错点和复习提示…" /></label>}
      {state.message && <p role="status" className="mf-status">{state.message}</p>}
    </div>}
  </Dialog>;
}
