import type { ReactNode } from 'react';
import type { Character } from '../../domains/conversations/types';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { CharacterAvatar } from './CharacterPresentation';
import { CharacterCardSources } from './CharacterCardSources';

export default function CharacterLibraryDialog({characters,selected,busy,changingRole=false,feedback,onSelect,onImport,onBrowseOfficial,onCreate,onEdit,onDelete,onClose}:{characters:Character[];selected?:string;busy:boolean;changingRole?:boolean;feedback?:ReactNode;onSelect:(character:Character)=>void;onImport:()=>void;onBrowseOfficial:()=>void;onCreate:()=>void;onEdit:(character:Character,renameOnly:boolean)=>void;onDelete:(character:Character)=>void;onClose:()=>void}){
  return <Dialog title="角色库" className="mf-character-library" onClose={onClose} dismissible={!changingRole}>
    <div className="mf-stack">
      <div className="mf-row mf-wrap"><Button variant="primary" disabled={busy} onClick={onImport}>导入角色卡</Button><Button disabled={busy} onClick={onCreate}>创建角色卡</Button></div>
      {feedback}
      <div className="mf-character-library-layout">
        <section className="mf-stack" aria-label="我的角色">
          <h3 className="mf-character-library-heading">我的角色 <span className="mf-muted mf-small">{characters.length}</span></h3>
          {!characters.length?<p className="mf-status">角色库还为空。导入一张角色卡，或创建自己的角色。</p>:characters.map(character=><article className="mf-character-record" key={character.characterId}>
            <div className="mf-row"><CharacterAvatar character={character} /><div><h3>{character.card.name}</h3><p className="mf-muted mf-small">{character.card.description.slice(0,140)}</p></div></div>
            <div className="mf-row mf-wrap"><Button variant={selected===character.characterId?'primary':'secondary'} disabled={busy} onClick={()=>onSelect(character)}>{selected===character.characterId?'当前角色':'使用角色'}</Button><Button variant="quiet" disabled={busy} onClick={()=>onEdit(character,false)}>编辑</Button><Button variant="quiet" disabled={busy} onClick={()=>onEdit(character,true)}>重命名</Button><Button variant="danger" disabled={busy} onClick={()=>onDelete(character)}>删除角色</Button></div>
          </article>)}
        </section>
        <CharacterCardSources onBrowseOfficial={onBrowseOfficial} busy={busy} />
      </div>
    </div>
  </Dialog>;
}
