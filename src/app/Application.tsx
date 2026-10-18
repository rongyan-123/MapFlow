import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {useIdentity} from '../domains/identity/IdentityContext';
import {useTheme} from '../domains/identity/useTheme';
import {AgentModelProvider} from '../domains/models/AgentModelContext';
import {ModelSelectionProvider} from '../domains/models/ModelSelectionContext';
import {clearAccountNoteDrafts} from '../domains/notes/noteDrafts';
import {useLocation} from './useLocation';
import {readLegacyConsoleState} from './consoleState';
import {AppFrame,type NavigationItem} from '../ui/AppFrame';
import {Dialog} from '../ui/Dialog';
import {Button} from '../ui/Button';
import {AnnouncementsDialog,FeedbackDialog} from '../ui/support/SupportDialogs';
import {NotificationsDialog} from '../ui/support/NotificationsDialog';
import {useNotificationCount} from '../domains/support/useNotifications';
import AgentGuideDialog from '../ui/support/AgentGuideDialog';
import LearningGuideDialog from '../ui/support/LearningGuideDialog';
import IdentityPage from '../pages/IdentityPage';
import LandingPage from '../pages/LandingPage';
const AssistantPage=lazy(()=>import('../pages/AssistantPage'));
const LibraryPage=lazy(()=>import('../pages/LibraryPage'));
const MapsPage=lazy(()=>import('../pages/MapsPage'));
const LearningPage=lazy(()=>import('../pages/LearningPage'));
const TavernPage=lazy(()=>import('../pages/TavernPage'));
const EnglishWorldPage=lazy(()=>import('../pages/EnglishWorldPage'));
const WalletPage=lazy(()=>import('../pages/WalletPage'));
const ModelsPage=lazy(()=>import('../pages/ModelsPage'));
const SettingsPage=lazy(()=>import('../pages/SettingsPage'));
const AdminPage=lazy(()=>import('../pages/admin/AdminPage'));
function safeReturnTarget(search:string,fallback:string){const requested=new URLSearchParams(search).get('next');if(!requested)return fallback;try{const target=new URL(requested,window.location.origin);return target.origin===window.location.origin&&target.pathname!=='/login'&&target.pathname!=='/register'?target.pathname+target.search:'/assistant';}catch{return '/assistant';}}
type SupportModal='help'|'feedback'|'announcements'|'notifications'|'agent'|'guide'|null;
export default function Application(){
  const identity=useIdentity();const {session}=identity;const accountId=session?.account.playerId;const {route,navigate}=useLocation(readLegacyConsoleState(accountId));const {setTheme}=useTheme();const [modal,setModal]=useState<SupportModal>(null);const previousAccount=useRef<string>();const [feedbackTarget,setFeedbackTarget]=useState<string>();const notifications=useNotificationCount(accountId);
  useEffect(()=>{if(previousAccount.current&&previousAccount.current!==accountId){clearAccountNoteDrafts(previousAccount.current);setModal(null);setFeedbackTarget(undefined);}previousAccount.current=accountId;},[accountId]);
  useEffect(()=>{if(route.guide)setModal('guide');},[route.guide,accountId]);
  function closeSupport(){setModal(null);if(route.guide){const query=new URLSearchParams(route.search);query.delete('guide');navigate(route.pathname+(query.size?'?'+query:''),true);}}
  const support=<>{modal==='help'&&<Dialog title="帮助与反馈" onClose={closeSupport}><div className="mf-stack"><p>从一张地图开始，或让助手帮你规划。</p><Button onClick={()=>setModal('guide')}>查看使用引导</Button><Button onClick={()=>setModal('agent')}>Agent 接入教程</Button>{session&&<><Button onClick={()=>setModal('announcements')}>查看公告</Button><Button onClick={()=>{setFeedbackTarget(undefined);setModal('feedback');}}>意见反馈</Button></>}</div></Dialog>}{modal==='guide'&&<LearningGuideDialog navigate={navigate} onClose={closeSupport} />}{modal==='agent'&&<AgentGuideDialog onClose={closeSupport} />}{modal==='feedback'&&session&&<FeedbackDialog key={session.account.playerId} initialFeedbackId={feedbackTarget} accountId={session.account.playerId} csrfToken={session.csrfToken} onClose={closeSupport} />}{modal==='notifications'&&session&&<NotificationsDialog accountId={session.account.playerId} csrfToken={session.csrfToken} onClose={closeSupport} onFeedback={id=>{setFeedbackTarget(id);setModal('feedback');}} />}{modal==='announcements'&&session&&<AnnouncementsDialog accountId={session.account.playerId} csrfToken={session.csrfToken} onClose={closeSupport} />}</>;
  if(identity.sessionPending)return <div className="mf-entry-loading" role="status">正在打开你的学习空间…</div>;
  if(route.page==='landing'||(!session&&route.pathname==='/'&&!route.search))return <><LandingPage session={session} navigate={navigate} onHelp={()=>setModal('help')} />{support}</>;
  if(!session||route.page==='login'||route.page==='register'){
    const currentDestination=route.page==='login'||route.page==='register'?safeReturnTarget(route.search,'/assistant'):route.pathname+route.search;
    const identityNavigate=(destination:string)=>navigate(destination==='/login'||destination==='/register'?`${destination}?next=${encodeURIComponent(currentDestination)}`:destination);
    return <IdentityPage mode={route.page==='register'?'register':'login'} navigate={identityNavigate} onAuthenticated={()=>navigate(currentDestination,true)} />;
  }
  const items:NavigationItem[]=[{href:'/assistant',label:'全局助手',shortLabel:'助手',icon:'chat'},{href:'/library',label:'公共书库',shortLabel:'书库',icon:'book'},{href:'/maps',label:'我的地图',shortLabel:'地图',icon:'map'},{href:'/learning',label:'学习聊天',shortLabel:'学习',icon:'learn'},{href:'/tavern',label:'独立酒馆',icon:'spark'},{href:'/english-world',label:'英语世界',icon:'book'}].map(item=>({...item,active:route.page===item.href.slice(1)} as NavigationItem));
  const tools:NavigationItem[]=[{href:'/wallet',label:'我的额度',icon:'wallet'},{href:'/models',label:'模型与价格',icon:'settings'},{href:'/settings',label:'账号与设置',icon:'user'},...(session.account.isAdmin?[{href:'/admin',label:'管理后台',icon:'admin' as const}]:[])].map(item=>({...item,active:route.page===item.href.slice(1)} as NavigationItem));
  const back=()=>navigate('/assistant');
  const page=route.page==='assistant'?<AssistantPage navigate={navigate} />:route.page==='library'?<LibraryPage navigate={navigate} treeId={route.treeId} initialNodeId={route.selectedNodeId} initialLayout={route.layoutMode} />:route.page==='maps'?<MapsPage navigate={navigate} entryId={route.entryId} initialNodeId={route.selectedNodeId} initialLayout={route.layoutMode} />:route.page==='learning'?<LearningPage navigate={navigate} areaId={route.areaId} node={route.node} />:route.page==='tavern'?<TavernPage navigate={navigate} />:route.page==='english-world'?<EnglishWorldPage navigate={navigate} route={route.englishWorld??{view:'home'}} />:route.page==='wallet'?<WalletPage accountId={accountId!} csrfToken={session.csrfToken} onBack={back} onNavigateModels={()=>navigate('/models')} />:route.page==='models'?<ModelsPage accountId={accountId!} onBack={back} onNavigateTavern={back} onNavigateWallet={()=>navigate('/wallet')} />:route.page==='admin'?<AdminPage navigate={navigate} />:<SettingsPage navigate={navigate} />;
  return <AgentModelProvider key={accountId} accountId={accountId!}><ModelSelectionProvider accountId={accountId!}><AppFrame items={items} tools={tools} accountName={session.account.username} navigate={navigate} onAccount={()=>navigate('/settings')} onTheme={source=>setTheme(current=>current==='dark'?'light':'dark',source)} onHelp={()=>setModal('help')} onMarketing={()=>navigate('/?marketing=1')} onNotifications={()=>setModal('notifications')} unreadCount={notifications.data} chatMode={['assistant','tavern'].includes(route.page)||(route.page==='learning'&&!!route.areaId)||(route.page==='english-world'&&route.englishWorld?.view==='play')}><Suspense fallback={<p role="status" className="mf-status">正在打开页面…</p>}>{page}</Suspense></AppFrame>{support}</ModelSelectionProvider></AgentModelProvider>;
}
