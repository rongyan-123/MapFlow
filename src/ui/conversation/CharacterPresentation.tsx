import type { Character,CompatibilityWarning } from '../../domains/conversations/types';
export function CharacterAvatar({character,name,previewUrl,large=false}:{character?:Character;name?:string;previewUrl?:string;large?:boolean}){
  const label=name??character?.card.name??'角色';const image=previewUrl??(character?.card.sourceFormat==='png'&&character.avatarUrl?`/api/me/tavern/characters/${encodeURIComponent(character.characterId)}/avatar`:undefined);
  return <span className={`mf-character-avatar ${large?'mf-character-avatar--large':''}`}>{image?<img src={image} alt={label} loading="lazy" />:label.slice(0,1)}</span>;
}
export function CompatibilityReport({warnings,initiallyOpen=warnings.length>0}:{warnings:CompatibilityWarning[];initiallyOpen?:boolean}){
  return <details className="mf-status" open={initiallyOpen||undefined}><summary>兼容性报告 · {warnings.length?`${warnings.length} 项提醒`:'基础文字字段兼容'}</summary>{warnings.length?<ul className="mf-compatibility-list">{warnings.map((warning,index)=><li key={index}><strong>{warning.field}</strong><p>{warning.message}</p></li>)}</ul>:<p>基础文字、开场白与基础世界书可用于聊天。</p>}</details>;
}
