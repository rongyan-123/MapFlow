import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLearningAreas } from '../tavern/tavernClient';
import TavernPage from '../tavern/TavernPage';
import PanelResizeHandle from '../tavern/PanelResizeHandle';
import { buttonClass, ErrorNotice, inputClass } from '../tavern/TavernUi';
import LearningAreaSelector from './LearningAreaSelector';
import useIsMobile from '../../lib/useIsMobile';
const LearningMapPanel = lazy(() => import('./LearningMapPanel'));

interface LearningChatWorkspaceProps {
  accountId: string; csrfToken: string; requestedAreaId?: string | null;
  requestedNode?: { id: string; title: string };
  onSelectArea?: (areaId: string | null) => void;
  onOpenMaps: () => void; onOpenManager?: () => void;
  onNavigateWallet?: () => void; onNavigateModels?: () => void;
  mobileHeaderActions?: ReactNode;
}

export default function LearningChatWorkspace({ accountId, csrfToken, requestedAreaId, requestedNode, onSelectArea, onOpenMaps, onOpenManager,
  onNavigateWallet, onNavigateModels, mobileHeaderActions }: LearningChatWorkspaceProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const storageKey = `mapflow.learning.area.v1.${accountId}`;
  const [areaId, setAreaId] = useState<string | null>(() => {
    if (requestedAreaId) return requestedAreaId;
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [nodeReference, setNodeReference] = useState(requestedNode);
  useEffect(() => { setNodeReference(requestedNode); }, [requestedNode?.id, requestedNode?.title]);
  const areas = useQuery({ queryKey: ['me', accountId, 'learning', 'areas'], queryFn: ({ signal }) => fetchLearningAreas(signal), staleTime: 30_000, retry: false });
  const area = areas.data?.find(item => item.areaId === areaId);
  useEffect(() => { if (requestedAreaId) { setAreaId(requestedAreaId); setMapOpen(false); setManagerOpen(false); } }, [requestedAreaId]);
  useEffect(() => {
    if (!areas.isSuccess) return;
    if (areaId && !area) { setAreaId(null); setMapOpen(false); }
    try { if (area) localStorage.setItem(storageKey, area.areaId); else localStorage.removeItem(storageKey); }
    catch { /* Server membership and histories do not depend on optional browser preferences. */ }
  }, [areaId, area, areas.isSuccess, storageKey]);

  const enter = (nextAreaId: string | null) => { setAreaId(nextAreaId); setMapOpen(false); setNodeReference(undefined); onSelectArea?.(nextAreaId); };
  if (managerOpen) return <section aria-label="学习区管理助手" className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-slate-800 px-3 py-2"><button className={buttonClass} onClick={() => setManagerOpen(false)}>返回学习区列表</button></div>
    <TavernPage management onNavigateConsole={() => setManagerOpen(false)}
      onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels} mobileHeaderActions={mobileHeaderActions} />
  </section>;
  if (areaId && areas.isPending) return <p role="status" className="p-6 text-sm text-slate-400">正在恢复学习区…</p>;
  if (areaId && areas.error) return <div className="p-6"><ErrorNotice error={areas.error} onRetry={() => void areas.refetch()} />
    <button className={buttonClass} onClick={() => enter(null)}>返回学习区列表</button></div>;
  if (!area) return <LearningAreaSelector accountId={accountId} csrfToken={csrfToken}
    onEnterArea={selected => enter(selected.areaId)} onOpenMaps={onOpenMaps} onOpenManager={() => { enter(null); setManagerOpen(true); onOpenManager?.(); }} />;

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <nav aria-label="当前学习区" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
      <button type="button" className={buttonClass} onClick={() => enter(null)}>返回学习区列表</button>
      <label className="min-w-0 flex-1 text-sm"><span className="sr-only">切换学习区</span>
        <select aria-label="切换学习区" value={area.areaId} onChange={event => enter(event.target.value)} className={`${inputClass} max-w-md`}>
          {areas.data?.map(item => <option key={item.areaId} value={item.areaId}>{item.title}{item.available ? '' : '（历史）'}</option>)}
        </select></label>
    </nav>
    {!area.available && <p className="border-b border-slate-800 px-4 py-2 text-xs text-amber-200">地图不可用，当前仅查看历史。</p>}
    <section aria-label="学习工作区" className="learning-workspace relative flex min-h-0 flex-1 overflow-hidden">
      <div data-learning-chat="true" className={`${isMobile && mapOpen ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col lg:flex-none`} style={mapOpen && !isMobile
        ? { width: 'var(--panel-width, 55%)' } as CSSProperties : { width: '100%' }}>
        <TavernPage treeContext={{ libraryEntryId: area.libraryEntryId, title: area.title, available: area.available,
          nodeId: nodeReference?.id, nodeTitle: nodeReference?.title }}
          onNavigateConsole={() => enter(null)} onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels}
          mobileHeaderActions={mobileHeaderActions} onShowMap={area.available ? () => setMapOpen(open => !open) : undefined}
          mapVisible={mapOpen} onOpenCanvas={() => setMapOpen(false)}
          onTreeChanged={() => void queryClient.invalidateQueries({ queryKey: ['me', accountId, 'tree-library', area.libraryEntryId] })} />
      </div>
      {mapOpen && area.available && <>
        <PanelResizeHandle label="调整聊天与地图宽度" storageKey={`mapflow.learning.chat-width.v1.${accountId}`} minWidth={340} remainingWidth={340} />
        <aside data-learning-map="true" aria-label="学习地图" className={`flex min-w-0 flex-1 flex-col border-l border-slate-800 bg-slate-950 ${isMobile ? 'absolute inset-0 z-20' : ''}`}>
          <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-400">正在打开地图…</p>}>
            <LearningMapPanel key={`${accountId}.${area.libraryEntryId}`} accountId={accountId} libraryEntryId={area.libraryEntryId} onClose={() => setMapOpen(false)} />
          </Suspense>
        </aside>
      </>}
    </section>
  </div>;
}
