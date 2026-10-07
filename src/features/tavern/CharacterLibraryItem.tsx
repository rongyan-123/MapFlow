import { useEffect, useRef, useState } from 'react';
import type { Character } from './types';
import { CharacterAvatar } from './TavernUi';

export default function CharacterLibraryItem({ character, selected, opening, disabled, actionsDisabled, onSelect, onRename, onEdit, onDelete }: {
  character: Character; selected: boolean; opening: boolean; disabled: boolean; actionsDisabled: boolean;
  onSelect: () => void; onRename: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  function choose(action: () => void) { setOpen(false); trigger.current?.focus(); action(); }
  return <div ref={container} className={`group relative rounded-2xl border transition hover:border-cyan-500 ${selected ? 'border-cyan-600 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>
    <div className="flex items-center">
      <button type="button" aria-label={`选择角色 ${character.card.name}`} aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        disabled={disabled} onClick={onSelect}>
        <CharacterAvatar character={character} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{character.card.name}</span><span className="text-xs text-slate-400">{opening ? '正在开启…' : '点击继续故事'}</span></span>
      </button>
      <button ref={trigger} type="button" aria-label={`角色操作 ${character.card.name}`} aria-haspopup="menu" aria-expanded={open}
        className={`mr-2 rounded-lg px-2 py-2 text-lg text-slate-300 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${open ? 'sm:!opacity-100' : ''}`}
        disabled={actionsDisabled} onClick={() => setOpen(previous => !previous)}>⋯</button>
    </div>
    {open && <div ref={menu} role="menu" aria-label={`${character.card.name}操作`} className="absolute right-2 top-full z-30 mt-1 min-w-32 rounded-xl border border-slate-600 bg-slate-900 p-1 shadow-xl"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
      }}>
      {([{ label: '重命名', action: onRename }, { label: '编辑角色卡', action: onEdit }, { label: '删除', action: onDelete }]).map(item =>
        <button key={item.label} type="button" role="menuitem" className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-700 focus:bg-slate-700 focus:outline-none ${item.label === '删除' ? 'text-rose-300' : 'text-slate-200'}`} onClick={() => choose(item.action)}>{item.label}</button>)}
    </div>}
  </div>;
}
