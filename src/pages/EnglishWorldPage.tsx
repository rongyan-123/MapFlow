import type { EnglishWorldRoute } from '../app/routes';
import { useState } from 'react';
import { useIdentity } from '../domains/identity/IdentityContext';
import { useWorldFunding } from '../domains/englishWorld/funding';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import ModelSettings from '../ui/conversation/ModelSettings';
import { WorldHome } from '../ui/englishWorld/WorldHome';
import { WorldPreparation } from '../ui/englishWorld/WorldPreparation';
import { WorldDetail } from '../ui/englishWorld/WorldDetail';
import { PlayWorkspace } from '../ui/englishWorld/PlayWorkspace';
import { WordLibrary } from '../ui/englishWorld/WordLibrary';
import { ReviewWorkspace } from '../ui/englishWorld/ReviewWorkspace';
import '../ui/englishWorld/english-world.css';

export default function EnglishWorldPage({ route, navigate }: { route: EnglishWorldRoute; navigate: (href: string) => void }) {
  const { session } = useIdentity();
  const model = useWorldFunding();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!session) return <p role="alert">请先登录后进入英语世界。</p>;
  const context = { accountId: session.account.playerId, csrfToken: session.csrfToken, navigate, funding: model.selection, apiKey: model.apiKey, openModels: () => setSettingsOpen(true) };
  return <div className="ew-root"><PageHeader title="英语世界" actions={<Button onClick={() => setSettingsOpen(true)}>模型与资金</Button>} />
    {route.view !== 'play' && <nav className="ew-tabs" aria-label="英语世界导航">{[['home', '我的世界', '/english-world'], ['words', '我的词库', '/english-world/words'], ['review', '复习', '/english-world/review']].map(([view, label, href]) => <a href={href} key={view} aria-current={route.view === view || view === 'home' && ['world', 'prepare'].includes(route.view) ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(href); }}>{label}</a>)}</nav>}
    {route.view === 'home' ? <WorldHome {...context} /> : route.view === 'prepare' ? <WorldPreparation key={route.taskId} context={context} taskId={route.taskId} /> : route.view === 'world' ? <WorldDetail key={route.worldId} context={context} worldId={route.worldId} /> : route.view === 'play' ? <PlayWorkspace key={route.playthroughId + '.' + route.branchId} context={context} playthroughId={route.playthroughId} branchId={route.branchId} /> : route.view === 'words' ? <WordLibrary context={context} /> : route.view === 'review' ? <ReviewWorkspace context={context} /> : <div className="mf-content"><div className="mf-page ew-empty"><h2>这个地址暂时无法打开。</h2><Button onClick={() => navigate('/english-world')}>返回我的世界</Button></div></div>}
    {settingsOpen && <Dialog title="模型与资金" onClose={() => setSettingsOpen(false)}><ModelSettings accountId={context.accountId} csrfToken={context.csrfToken} onWallet={() => navigate('/wallet')} /></Dialog>}
  </div>;
}
