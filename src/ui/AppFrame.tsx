import { createContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Icon, type IconName } from './Icon';
import { IconButton } from './Button';
import { BrandMark } from './BrandMark';

export const FrameContext = createContext<{ openNavigation: () => void } | null>(null);
export interface NavigationItem { href: string; label: string; shortLabel?: string; icon: IconName; active?: boolean }

export interface AppFrameProps {
  children: ReactNode;
  items: NavigationItem[];
  tools: NavigationItem[];
  accountName: string;
  navigate: (href: string) => void;
  onAccount: () => void;
  onTheme: (source: HTMLElement) => void;
  onHelp: () => void;
  onMarketing: () => void;
  chatMode?: boolean;
}

export function AppFrame({ children, items, tools, accountName, navigate, onAccount, onTheme, onHelp, onMarketing, chatMode = false }: AppFrameProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const update = () => {
      const element = viewport.current;
      if (!element) return;
      const visual = window.visualViewport;
      element.style.setProperty('--mf-viewport-height', `${visual?.height || window.innerHeight}px`);
      element.style.setProperty('--mf-viewport-offset', `${visual?.offsetTop || 0}px`);
      element.dataset.editing = document.activeElement?.matches('input,textarea') ? 'true' : 'false';
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  const follow = (href: string) => { setNavigationOpen(false); navigate(href); };
  const link = (item: NavigationItem) => <a key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={`mf-navigation-link ${item.active ? 'is-active' : ''}`} onClick={event => { event.preventDefault(); follow(item.href); }}><Icon name={item.icon} /><span>{item.label}</span></a>;
  const navigation = <aside className="mf-sidebar" aria-label="全局导航">
    <button className="mf-brand" onClick={() => follow(items[0]?.href ?? '/')}><span className="mf-brand-mark"><BrandMark /></span>MapFlow</button>
    <nav aria-label="业务导航">{items.map(link)}</nav>
    <p className="mf-navigation-caption">工具与账号</p><nav aria-label="账号工具">{tools.map(link)}</nav>
    <div className="mf-sidebar-bottom"><button className="mf-navigation-link" onClick={() => { setNavigationOpen(false); onMarketing(); }}><Icon name="home" />产品首页</button><button className="mf-navigation-link" onClick={() => { setNavigationOpen(false); onHelp(); }}><Icon name="help" />帮助与反馈</button>
      <div className="mf-account"><button className="mf-account-profile" onClick={() => { setNavigationOpen(false); onAccount(); }}><span className="mf-avatar">{accountName.slice(0,1).toUpperCase()}</span><span><strong>{accountName}</strong><small>你的学习空间</small></span></button><IconButton icon="moon" label="切换浅色和深色主题" onClick={event=>onTheme(event.currentTarget)} /></div>
    </div>
  </aside>;
  return <FrameContext.Provider value={{ openNavigation: () => setNavigationOpen(true) }}><div ref={viewport} className={`mf-app ${chatMode ? 'mf-app--chat' : ''}`}>
    {navigation}<main className="mf-main">{children}<nav className="mf-bottom-navigation" aria-label="手机主导航">{items.slice(0,4).map(item => <a key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined} className={item.active ? 'is-active' : ''} onClick={event => { event.preventDefault(); follow(item.href); }}><Icon name={item.icon} /><span>{item.shortLabel ?? item.label}</span></a>)}</nav></main>
    {navigationOpen && <Dialog title="MapFlow" layout="drawer" onClose={() => setNavigationOpen(false)}>{navigation}</Dialog>}
  </div></FrameContext.Provider>;
}
