import {useRef,useState} from 'react';
import {readCardImport} from './cardImport';
import {importCharacter} from '../../api/tavernClient';
import {TavernApiError,type Character} from '../conversations/types';
import {hasControls,utf8Bytes} from '../conversations/validation';
export function useCharacterCreation({csrfToken,onCreated}:{csrfToken:string;onCreated:(character:Character)=>void}){
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

  return {name,setName,description,setDescription,opening,setOpening,saving,error,save};
}
