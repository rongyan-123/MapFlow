import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export const headerMenuItem = 'block w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';

export default function HeaderMoreMenu({ children, label = '更多', menuLabel = '更多功能' }: { children: ReactNode; label?: string; menuLabel?: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button,a,select')?.focus();
    const clickOutside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', clickOutside);
    return () => document.removeEventListener('pointerdown', clickOutside);
  }, [open]);
  return <div ref={root} className="relative shrink-0" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(current => !current)} className="rounded-xl border border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-3">{label}<span aria-hidden="true" className="ml-1 hidden sm:inline">⌄</span></button>
    <nav id={menuId} ref={panel} hidden={!open} aria-label={menuLabel} className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] w-72 max-w-[calc(100vw-2rem)] space-y-1 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-black/30" onClick={event => { if (event.target instanceof Element && event.target.closest('button,a') && !event.target.closest('[data-keep-menu-open]')) setOpen(false); }}>
      {children}
    </nav>
  </div>;
}
