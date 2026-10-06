import { useRef, useState } from 'react';
import { readCardImport } from './cardImport';
import { importCharacter } from './tavernClient';
import { TavernApiError, type Character } from './types';
import { hasControls, utf8Bytes } from './validation';
import { ErrorNotice, TavernDialog, inputClass, primaryClass } from './TavernUi';

export default function CreateCharacterDialog({ csrfToken, onCreated, onClose }: {
  csrfToken: string; onCreated: (character: Character) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const savingLock = useRef(false);

  async function save() {
    if (savingLock.current) return;
    savingLock.current = true; setSaving(true); setError(null);
    try {
      const roleName = name.trim();
      const rolePrompt = description.trim();
      if (!roleName) throw new TavernApiError(400, 'tavern.card_invalid', '角色名称不能为空。');
      if (!rolePrompt) throw new TavernApiError(400, 'tavern.card_invalid', '角色设定不能为空。');
      if (Array.from(roleName).length > 200 || utf8Bytes(rolePrompt) > 16384 || utf8Bytes(opening) > 8192) {
        throw new TavernApiError(400, 'tavern.input_too_large', '名称最多 200 字，角色设定最多 16 KiB，开场白最多 8 KiB。');
      }
      if ([roleName, rolePrompt, opening].some(hasControls)) {
        throw new TavernApiError(400, 'tavern.card_invalid', '请移除内容中的不可见控制字符。');
      }
      const source = new File([JSON.stringify({ name: roleName, description: rolePrompt, first_mes: opening })], 'character.json', { type: 'application/json' });
      const imported = await readCardImport(source);
      onCreated(await importCharacter(imported.card, imported.sourceFile, csrfToken));
    } catch (failure) { setError(failure); }
    finally { savingLock.current = false; setSaving(false); }
  }

  return <TavernDialog title="创建角色卡" onClose={onClose} busy={saving}>
    <form className="space-y-4" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <p className="text-sm leading-6 text-slate-400">写下角色的身份、性格和聊天方式。保存到你的私有角色库，创建角色卡不扣费。</p>
      <label className="block text-sm text-slate-300">角色名称<input className={`${inputClass} mt-2`} value={name} onChange={event => setName(event.target.value)} disabled={saving} /></label>
      <label className="block text-sm text-slate-300">角色设定（提示词）<textarea className={`${inputClass} mt-2 min-h-40`} value={description} onChange={event => setDescription(event.target.value)} disabled={saving} placeholder="例如：你是海边的灯塔守望者，用中文与旅行者交谈……" /></label>
      <label className="block text-sm text-slate-300">开场白（可选）<textarea className={`${inputClass} mt-2 min-h-20`} value={opening} onChange={event => setOpening(event.target.value)} disabled={saving} /></label>
      <ErrorNotice error={error} />
      <button type="submit" className={primaryClass} disabled={saving}>{saving ? '正在保存…' : '保存角色卡'}</button>
    </form>
  </TavernDialog>;
}
