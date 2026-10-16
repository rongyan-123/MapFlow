import type { Character } from '../../domains/conversations/types';

export interface CharacterSelection {
  characterId: string | null;
  onSelect: (character: Character) => void;
  disabled: boolean;
}

export function CharacterSelector({ characters, characterId, onSelect, disabled, compact = false }: CharacterSelection & { characters: Character[]; compact?: boolean }) {
  const unavailable = !!characterId && !characters.some(character => character.characterId === characterId);
  return <label className={`mf-field mf-character-selector${compact ? ' mf-character-selector--compact' : ''}`}>
    <span className={compact ? 'mf-sr-only' : undefined}>{compact ? '切换智能体' : '当前智能体'}</span>
    <select value={characterId ?? ''} disabled={disabled || !characters.length} onChange={event => {
      const selected = characters.find(character => character.characterId === event.target.value);
      if (selected) onSelect(selected);
    }}>
      <option value="" disabled>选择智能体</option>
      {unavailable && <option value={characterId!} disabled>历史角色（已移出角色库）</option>}
      {characters.map(character => <option key={character.characterId} value={character.characterId}>{character.card.name}</option>)}
    </select>
  </label>;
}
