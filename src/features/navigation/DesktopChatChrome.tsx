import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefCallback } from 'react';
import { createPortal } from 'react-dom';
import HeaderMoreMenu from './HeaderMoreMenu';
import './desktopChatChrome.css';

const slots = ['history', 'title', 'learning', 'model', 'map', 'new', 'canvas', 'configuration', 'more'] as const;
type DesktopSlot = typeof slots[number];
type Targets = Record<DesktopSlot, HTMLElement | null>;
interface DesktopChrome { targets: Targets; active: boolean; registerTitle: () => () => void }
const Context = createContext<DesktopChrome | null>(null);
export const useDesktopChatChrome = () => useContext(Context);

export function DesktopChatChromeProvider({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const toolbar = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(() => Math.max(0, window.innerWidth - 208));
  const [titles, setTitles] = useState(0);
  const [rowTargets, setRowTargets] = useState<Targets>(() => Object.fromEntries(slots.map(slot => [slot, null])) as Targets);
  const [menuTargets, setMenuTargets] = useState<Partial<Targets>>({});
  const rowRefs = useMemo(() => Object.fromEntries(slots.map(slot => [slot, (element: HTMLElement | null) => {
    setRowTargets(previous => previous[slot] === element ? previous : { ...previous, [slot]: element });
  }])) as Record<DesktopSlot, RefCallback<HTMLElement>>, []);
  const menuRefs = useMemo(() => Object.fromEntries(['model', 'learning', 'map'].map(slot => [slot, (element: HTMLElement | null) => {
    setMenuTargets(previous => previous[slot as DesktopSlot] === element ? previous : { ...previous, [slot]: element });
  }])) as Record<'model' | 'learning' | 'map', RefCallback<HTMLElement>>, []);
  const registerTitle = useCallback(() => { setTitles(count => count + 1); return () => setTitles(count => Math.max(0, count - 1)); }, []);
  useLayoutEffect(() => {
    if (disabled) return;
    const measure = () => setWidth(toolbar.current?.getBoundingClientRect().width || Math.max(0, window.innerWidth - 208));
    measure(); window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (toolbar.current) observer?.observe(toolbar.current);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [disabled, titles]);
  const targets = useMemo(() => ({ ...rowTargets,
    model: width >= 1180 ? rowTargets.model : menuTargets.model ?? null,
    learning: width >= 800 ? rowTargets.learning : menuTargets.learning ?? null,
    map: width >= 460 ? rowTargets.map : menuTargets.map ?? null,
  }), [rowTargets, menuTargets, width]);
  const chrome = useMemo(() => ({ targets, active: titles > 0, registerTitle }), [targets, titles, registerTitle]);
  return <Context.Provider value={disabled ? null : chrome}>
    {!disabled && <header ref={toolbar} hidden={!chrome.active} role="toolbar" aria-label="对话操作" data-compact={width < 800}
      className="desktop-chat-toolbar border-b border-slate-800 bg-slate-950">
      <div ref={rowRefs.history} className="desktop-chat-action" />
      <div ref={rowRefs.title} className="desktop-chat-title" />
      <div ref={rowRefs.learning} className="desktop-chat-slot" />
      <div ref={rowRefs.model} className="desktop-chat-slot" />
      <div ref={rowRefs.map} className="desktop-chat-slot" />
      <div ref={rowRefs.new} className="desktop-chat-action" />
      <div ref={rowRefs.canvas} className="desktop-chat-action" />
      <div ref={rowRefs.configuration} className="desktop-chat-action" />
      <HeaderMoreMenu compact label="更多会话操作" menuLabel="会话更多操作">
        <div ref={rowRefs.more} />
        <section className="desktop-chat-menu-section" data-keep-menu-open><p>模型与资金</p><div ref={menuRefs.model} /></section>
        <section className="desktop-chat-menu-section" data-keep-menu-open><p>学习区</p><div ref={menuRefs.learning} /></section>
        <section className="desktop-chat-menu-section"><div ref={menuRefs.map} /></section>
      </HeaderMoreMenu>
    </header>}
    {children}
  </Context.Provider>;
}

export function DesktopChromePortal({ slot, children }: { slot: DesktopSlot; children: ReactNode }) {
  const chrome = useDesktopChatChrome();
  const register = chrome?.registerTitle;
  useEffect(() => slot === 'title' ? register?.() : undefined, [slot, register]);
  const target = chrome?.targets[slot];
  return target ? createPortal(children, target) : null;
}
