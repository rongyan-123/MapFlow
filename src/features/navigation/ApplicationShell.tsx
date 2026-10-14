import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import IdentityAccess from '../identity/IdentityAccess';
import LogoutConfirmDialog from '../identity/LogoutConfirmDialog';
import ThemeSwitcher from '../theme/ThemeSwitcher';
import WalletBalance from '../wallet/WalletBalance';
import CreditPill from '../credit/CreditPill';
import { readCreditSummary } from '../../api/creditClient';
import AnnouncementsDialog from '../announcements/AnnouncementsDialog';
import FeedbackDialog from '../feedback/FeedbackDialog';
import McpGuideDialog from '../mcp/McpGuideDialog';
import ModelAccessPanel from '../tavern/ModelAccessPanel';
import { useSharedModelSelection } from '../tavern/ModelSelectionContext';
import { TavernDialog } from '../tavern/TavernUi';
import MobileDrawer from './MobileDrawer';
import useIsMobile from '../../lib/useIsMobile';
import { describePublicError } from '../../lib/publicErrors';
import { MobileChatChromeContext, mobileChromeSlots, mobileActionClass, MobileActionIcon, type MobileChromeTargets, type MobileChromeRefs } from './MobileChatChrome';
import './mobileChatChrome.css';
import useMobileViewport from '../../lib/useMobileViewport';
import { DesktopChatChromeProvider } from './DesktopChatChrome';

const ShellContext = createContext(false);
export function useApplicationShell() { return useContext(ShellContext); }
const destinations = [
  { path: '/assistant', label: '全局助手' },
  { path: '/library', label: '公共书库' }, { path: '/maps', label: '我的地图' },
  { path: '/learning', label: '学习聊天' }, { path: '/tavern', label: '独立酒馆' },
] as const;
const itemClass = 'block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';

export default function ApplicationShell({ activePath, onNavigate, children }: {
  activePath: string; onNavigate: (path: string) => void; children: ReactNode;
}) {
  const { session, generationCapabilities, logout, logoutPending, logoutError } = useIdentity();
  const isMobile = useIsMobile();
  const viewportRoot = useMobileViewport(isMobile && !!session);
  const sharedModel = useSharedModelSelection();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileTargets, setMobileTargets] = useState<MobileChromeTargets>(() => Object.fromEntries(mobileChromeSlots.map(slot => [slot, null])) as MobileChromeTargets);
  const mobileRefs = useMemo(() => Object.fromEntries(mobileChromeSlots.map(slot => [slot, (element: HTMLElement | null) => {
    setMobileTargets(previous => previous[slot] === element ? previous : { ...previous, [slot]: element });
  }])) as MobileChromeRefs, []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const mobileChrome = useMemo(() => isMobile ? { targets: mobileTargets, openDrawer, closeDrawer } : null, [isMobile, mobileTargets, openDrawer, closeDrawer]);
  const [dialog, setDialog] = useState<'model' | 'guide' | 'announcements' | 'feedback' | 'logout' | null>(null);
  const credit = useQuery({ queryKey: ['me', session?.account.playerId, 'credit'], queryFn: readCreditSummary,
    enabled: !!session && generationCapabilities?.platformFundedEnabled === true, staleTime: 30_000, retry: false });
  if (!session) return null;
  function navigate(path: string) { setDrawerOpen(false); setDialog(null); onNavigate(path); }
  function openDialog(next: typeof dialog) { setDrawerOpen(false); setDialog(next); }
  const navigation = <>
    <div className="flex shrink-0 items-center justify-between px-3 py-4">
      <span className="text-lg font-bold tracking-tight text-cyan-200">MapFlow</span>
      {isMobile && <button aria-label="关闭功能菜单" className={itemClass + ' !w-auto'} onClick={() => setDrawerOpen(false)}>×</button>}
    </div>
    <nav aria-label="业务导航" className="space-y-1 px-2">
      {destinations.map(destination => <button key={destination.path} type="button" aria-current={activePath === destination.path ? 'page' : undefined}
        className={`${itemClass} ${activePath === destination.path ? '!bg-cyan-300 !font-semibold !text-slate-950' : ''}`}
        onClick={() => navigate(destination.path)}>{destination.label}</button>)}
    </nav>
    {isMobile && <div className="mobile-scene-selections space-y-4 px-2 pt-4">
      {(['learning', 'history', 'characters', 'model'] as const).map(slot => <div key={slot} ref={mobileRefs[slot]} />)}
    </div>}
    <nav aria-label="辅助功能" className="mt-auto space-y-3 px-2 pt-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="border-t border-slate-800 pt-3"><p className="px-3 pb-1 text-xs text-slate-500">模型与额度</p>
        <button className={itemClass} onClick={() => openDialog('model')}>模型配置</button>
        <button className={itemClass} onClick={() => navigate('/models')}>模型价格</button>
        <WalletBalance accountId={session.account.playerId} onClick={() => navigate('/wallet')} />
        {generationCapabilities?.platformFundedEnabled === true && <div className="px-3 pt-2"><CreditPill credit={credit.data ?? null} onSignedIn={() => {
          void credit.refetch(); void queryClient.invalidateQueries({ queryKey: ['me', session.account.playerId, 'platform-generation-entitlements'] });
        }} /></div>}
      </div>
      <div className="border-t border-slate-800 pt-3"><p className="px-3 pb-1 text-xs text-slate-500">帮助与设置</p>
        <button className={itemClass} onClick={() => navigate('/library?guide=1')}>查看引导</button>
        <button className={itemClass} aria-label="如何在自己的 Agent 里连接 MapFlow" onClick={() => openDialog('guide')}>Agent 接入教程</button>
        <button className={itemClass} onClick={() => openDialog('announcements')}>公告</button>
        <button className={itemClass} onClick={() => openDialog('feedback')}>意见反馈</button>
        <a className={itemClass} href="/?marketing=1" aria-label="查看产品首页">产品首页</a>
        {session.account.isAdmin && <button className={itemClass} aria-current={activePath === '/admin' ? 'page' : undefined} onClick={() => navigate('/admin')}>管理面板</button>}
        <div className="px-3 py-2"><ThemeSwitcher /></div>
      </div>
      <IdentityAccess onRequestLogout={() => openDialog('logout')} />
    </nav>
  </>;
  return <ShellContext.Provider value={true}><MobileChatChromeContext.Provider value={mobileChrome}>
    <div ref={viewportRoot} data-mobile={isMobile} className="application-shell flex h-dvh min-h-0 overflow-hidden bg-slate-950 text-slate-100">
      {!isMobile && <aside aria-label="全局导航" className="application-navigation flex w-52 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950">{navigation}</aside>}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile && <header className="mobile-chat-toolbar border-slate-800 bg-slate-950" role="toolbar" aria-label="对话操作">
          <button type="button" aria-label="打开功能菜单" aria-expanded={drawerOpen} onClick={openDrawer} className={mobileActionClass}><MobileActionIcon name="menu" /></button>
          <div ref={mobileRefs.title} className="mobile-chat-title" data-fallback-title={destinations.find(destination => destination.path === activePath)?.label ?? 'MapFlow'} />
          <div ref={mobileRefs.new} className="mobile-chat-action" />
          <div ref={mobileRefs.configuration} className="mobile-chat-action" />
          <div ref={mobileRefs.canvas} className="mobile-chat-action" />
        </header>}
        <DesktopChatChromeProvider disabled={isMobile}><div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div></DesktopChatChromeProvider>
      </div>
      <MobileDrawer open={isMobile && drawerOpen} onClose={() => setDrawerOpen(false)}>{navigation}</MobileDrawer>
    </div>
    {dialog === 'model' && sharedModel && <TavernDialog title="模型配置" onClose={() => setDialog(null)}>
      <ModelAccessPanel accountId={session.account.playerId} csrfToken={session.csrfToken} modelSelection={sharedModel.selection}
        onModelSelectionChange={sharedModel.change} onNavigateWallet={() => navigate('/wallet')} />
    </TavernDialog>}
    {dialog === 'guide' && <McpGuideDialog onClose={() => setDialog(null)} />}
    {dialog === 'announcements' && <AnnouncementsDialog onClose={() => setDialog(null)} />}
    {dialog === 'feedback' && <FeedbackDialog onClose={() => setDialog(null)} />}
    <LogoutConfirmDialog open={dialog === 'logout'} pending={logoutPending} error={logoutError ? describePublicError(logoutError) : null}
      onCancel={() => setDialog(null)} onConfirm={() => void logout().catch(() => undefined)} />
  </MobileChatChromeContext.Provider></ShellContext.Provider>;
}
