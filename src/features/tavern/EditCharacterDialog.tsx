import { useRef, useState } from 'react';
import { updateCharacter } from './tavernClient';
import { TavernApiError, type Character, type ConversationDetail } from './types';
import { hasControls, utf8Bytes } from './validation';
import { buttonClass, ErrorNotice, inputClass, primaryClass, TavernDialog } from './TavernUi';

export default function EditCharacterDialog({ character, conversation, renameOnly, csrfToken, onSaved, onClose, onConflict }: {
  character: Character; conversation?: ConversationDetail; renameOnly: boolean; csrfToken: string;
  onSaved: (result: { character: Character; conversation: ConversationDetail | null }) => void; onClose: () => void;
  onConflict: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(character.card);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const saving = useRef(false);
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      const card = { ...draft, name: draft.name.trim() };
      if (!card.name || Array.from(card.name).length > 200 || hasControls(card.name)) throw new TavernApiError(400, 'tavern.card_invalid', '角色名称需为 1–200 字，不能包含不可见控制字符。');
      if (utf8Bytes(JSON.stringify(card)) > 512 * 1024) throw new TavernApiError(400, 'tavern.input_too_large', '角色卡内容不能超过 512 KiB。');
      onSaved(await updateCharacter(character.characterId, character.normalizedHash, card, csrfToken,
        conversation ? { conversationId: conversation.conversation.conversationId, expectedRevision: conversation.graph.revision } : undefined));
    } catch (failure) {
      setError(failure instanceof TavernApiError && failure.status === 409
        ? new Error('角色或会话已更新，或正在生成回复。草稿仍在此窗口中，请保留修改内容，稍后重新打开窗口读取最新设定。') : failure);
      if (failure instanceof TavernApiError && failure.status === 409) await onConflict().catch(() => undefined);
    } finally { saving.current = false; setBusy(false); }
  }
  function textField(field: keyof typeof draft, label: string, rows = 3) {
    return <label className="block text-sm text-slate-300">{label}<textarea className={`${inputClass} mt-2`} rows={rows} disabled={busy} value={draft[field] as string}
      onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} /></label>;
  }
  return <TavernDialog title={renameOnly ? '重命名角色卡' : '编辑角色卡'} onClose={onClose} busy={busy}>
    <form className="space-y-4" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <p className="text-sm leading-6 text-slate-400">保存到角色库，供新会话使用。{conversation ? '当前会话从下一轮使用新设定，已有消息和开场白保持。' : '其他已有会话保持原设定。'}编辑角色卡不扣费。</p>
      <label className="block text-sm text-slate-300">角色名称<input className={`${inputClass} mt-2`} disabled={busy} value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
      {!renameOnly && <>
        {textField('description', '角色设定（提示词）', 6)}
        {textField('personality', '性格')}{textField('scenario', '场景')}
        {textField('firstMessage', '开场白（用于新会话）')}
        <details className="space-y-4 rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold">高级设定</summary>
          {textField('exampleDialogue', '示例对话')}{textField('systemPrompt', '系统提示词')}
          {textField('postHistoryInstructions', '历史后指令')}{textField('creatorNotes', '作者备注')}
          <p className="text-xs text-slate-400">世界书、备选开场白和原始文件会保留。</p>
        </details>
      </>}
      <ErrorNotice error={error} />
      <div className="flex gap-3"><button type="submit" className={primaryClass} disabled={busy}>{busy ? '保存中…' : renameOnly ? '保存名称' : '保存修改'}</button>
        <button type="button" className={buttonClass} disabled={busy} onClick={onClose}>取消</button></div>
    </form>
  </TavernDialog>;
}
