import { createContext, useContext, type ReactNode, type RefCallback } from 'react';
import { createPortal } from 'react-dom';

export const mobileChromeSlots = ['title', 'new', 'configuration', 'canvas', 'learning', 'characters', 'history', 'model'] as const;
export type MobileChromeSlot = typeof mobileChromeSlots[number];
export type MobileChromeTargets = Record<MobileChromeSlot, HTMLElement | null>;
export type MobileChromeRefs = Record<MobileChromeSlot, RefCallback<HTMLElement>>;
export interface MobileChatChrome {
  targets: MobileChromeTargets;
  openDrawer: () => void;
  closeDrawer: () => void;
}
export const MobileChatChromeContext = createContext<MobileChatChrome | null>(null);
export function useMobileChatChrome() { return useContext(MobileChatChromeContext); }

export function MobileChromePortal({ slot, children }: { slot: MobileChromeSlot; children: ReactNode }) {
  const target = useMobileChatChrome()?.targets[slot];
  return target ? createPortal(children, target) : null;
}

export const mobileActionClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-800 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-30';
export function MobileActionIcon({ name }: { name: 'menu' | 'new' | 'configuration' | 'canvas' | 'send' | 'stop' }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'menu' && <path d="M4 6h16M4 12h16M4 18h16" />}
    {name === 'new' && <path d="M12 5v14M5 12h14" />}
    {name === 'configuration' && <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" fill="currentColor" /><circle cx="15" cy="17" r="2.5" fill="currentColor" /></>}
    {name === 'canvas' && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 15 4-4 3 3 3-6" /></>}
    {name === 'send' && <path d="M12 19V5m-6 6 6-6 6 6" />}
    {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />}
  </svg>;
}
