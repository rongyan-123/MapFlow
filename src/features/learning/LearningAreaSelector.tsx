import type { LearningArea } from '../tavern/types';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLearningArea, fetchLearningAreas } from '../tavern/tavernClient';
import { fetchPersonalLibrary } from '../tree-library/treeLibraryClient';
import { ErrorNotice, buttonClass, inputClass, primaryClass } from '../tavern/TavernUi';

interface LearningAreaSelectorProps {
  accountId: string; csrfToken: string;
  onEnterArea: (area: LearningArea) => void;
  onOpenMaps: () => void; onOpenManager: () => void;
}

export default function LearningAreaSelector({ accountId, csrfToken, onEnterArea, onOpenMaps, onOpenManager }: LearningAreaSelectorProps) {
  const queryClient = useQueryClient();
  const areasKey = ['me', accountId, 'learning', 'areas'] as const;
  const areas = useQuery({ queryKey: areasKey, queryFn: ({ signal }) => fetchLearningAreas(signal), staleTime: 30_000 });
  const library = useQuery({ queryKey: ['me', accountId, 'tree-library'], queryFn: fetchPersonalLibrary });
  const [search, setSearch] = useState('');
  const [selectedMap, setSelectedMap] = useState('');
  const creation = useMutation({ mutationFn: (entry: string) => createLearningArea(entry, csrfToken), onSuccess: async area => {
    await queryClient.cancelQueries({ queryKey: areasKey, exact: true });
    queryClient.setQueryData<LearningArea[]>(areasKey, previous => [area, ...(previous ?? []).filter(item => item.areaId !== area.areaId)]);
    onEnterArea(area);
  } });
  const visibleAreas = (areas.data ?? []).filter(area => area.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const ready = areas.isSuccess && library.isSuccess;

  return <section aria-label="学习区选择" className="min-h-0 flex-1 overflow-y-auto bg-slate-950 px-5 py-8 sm:px-10 sm:py-12">
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold tracking-[0.2em] text-cyan-300">LEARNING SPACE</p>
          <h1 className="mt-3 text-3xl font-bold">从一个学习区开始</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">每张个人地图都有自己的学习区。可以用不同角色一起学习，各段对话独立保存。</p></div>
        <button type="button" className={buttonClass} disabled={creation.isPending} onClick={onOpenManager}>打开管理助手</button>
      </div>
      <ErrorNotice error={areas.error} onRetry={() => void areas.refetch()} />
      <ErrorNotice error={library.error} onRetry={() => void library.refetch()} />
      {!ready && !areas.error && !library.error && <p role="status" className="text-sm text-slate-400">正在读取学习区…</p>}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="font-semibold">新建学习区</h2>
        <p className="mt-2 text-sm text-slate-400">选择已有的个人地图，创建时不会生成新地图或发送消息。</p>
        {ready && library.data.entries.length === 0 ? <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className="text-sm text-slate-400">还没有个人地图，可以先加入书库中的地图或创建自己的地图。</p>
          <button type="button" className={primaryClass} onClick={onOpenMaps}>前往我的地图</button>
        </div> : <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={event => {
          event.preventDefault();
          if (!ready || !selectedMap || creation.isPending) return;
          const existing = areas.data.find(area => area.libraryEntryId === selectedMap && area.available);
          if (existing) onEnterArea(existing); else creation.mutate(selectedMap);
        }}>
          <label className="min-w-0 flex-1"><span className="sr-only">选择个人地图</span>
            <select className={inputClass} value={selectedMap} disabled={!ready || creation.isPending} onChange={event => { setSelectedMap(event.target.value); creation.reset(); }}>
              <option value="">选择个人地图</option>
              {library.data?.entries.map(entry => <option key={entry.library_entry_id} value={entry.library_entry_id}>{entry.tree.title}</option>)}
            </select></label>
          <button type="submit" className={primaryClass} disabled={!ready || !selectedMap || creation.isPending}>{creation.isPending ? '创建中…' : '新建学习区'}</button>
        </form>}
        <div className="mt-3"><ErrorNotice error={creation.error} /></div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-semibold">我的学习区</h2>
          <input type="search" aria-label="搜索学习区" placeholder="搜索学习区…" value={search} onChange={event => setSearch(event.target.value)} className={`${inputClass} sm:max-w-xs`} /></div>
        {areas.isSuccess && visibleAreas.length === 0 && <p className="py-8 text-center text-sm text-slate-500">{search.trim() ? '没有找到匹配的学习区。' : '还没有学习区，选择一张个人地图开始吧。'}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleAreas.map(area => <article key={area.areaId} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="break-words text-lg font-semibold">{area.title}</h3>
            <p className="text-sm text-slate-400">{area.available ? '围绕这张地图学习，保存角色对话与教学画布。' : '地图不可用，仍可查看历史'}</p>
            <button type="button" disabled={creation.isPending} className={`${area.available ? primaryClass : buttonClass} mt-auto self-start`} aria-label={area.available ? `进入 ${area.title}` : `查看 ${area.title} 历史`} onClick={() => onEnterArea(area)}>{area.available ? '进入学习区 →' : '查看历史 →'}</button>
          </article>)}
        </div>
      </div>
    </div>
  </section>;
}
