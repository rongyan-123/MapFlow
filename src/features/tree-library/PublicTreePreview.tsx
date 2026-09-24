import type { SkillTree } from '../../types/learning';
import type { PublicTreeAttribution } from './types';
import { difficultyLabel } from './PublicTreeCatalogPanel';

export function PublicTreePreviewHeader({ tree, attribution, joining, joinError, catalogCollapsed, onJoin, onExpandCatalog }: { tree: SkillTree; attribution?: PublicTreeAttribution; joining: boolean; joinError?: unknown; catalogCollapsed: boolean; onJoin: () => void; onExpandCatalog: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-slate-800/90 bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        {catalogCollapsed && <button type="button" aria-label="展开公共树库" onClick={onExpandCatalog} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-cyan-400/60 hover:text-cyan-200 lg:flex">›</button>}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-100 sm:text-base">{tree.title}</p>
          <p className="mt-1 truncate text-[11px] text-slate-500">{tree.topic} · {attribution?.publisher_display_name ? `发布者 ${attribution.publisher_display_name}` : '官方地图'} · {tree.total_nodes} 节点 · {difficultyLabel(tree.difficulty_level)}</p>
          {Boolean(joinError) && <p role="alert" className="mt-1 text-[11px] text-rose-300">加入失败，请稍后重试。</p>}
        </div>
      </div>
      <button type="button" aria-label="加入我的学习" disabled={joining} onClick={onJoin} className="shrink-0 rounded-xl border border-cyan-100/80 bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)] transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60 sm:text-sm">{joining ? '正在加入…' : '＋ 加入我的学习'}</button>
    </div>
  );
}

export function PublicTreeEmptyPreview({ onExpandCatalog }: { onExpandCatalog: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(8,145,178,0.08),transparent_48%)] px-6 text-center">
      <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(34,211,238,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/5 text-2xl text-cyan-300 shadow-[0_0_38px_rgba(34,211,238,0.1)]">⌘</div>
        <h2 className="mt-5 text-xl font-bold text-slate-200">选择一张地图查看路线</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">节点会在你选择地图后加载。可以先用左侧搜索和筛选找到想学的方向。</p>
        <button type="button" onClick={onExpandCatalog} className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 lg:hidden">浏览公共地图</button>
      </div>
    </div>
  );
}
