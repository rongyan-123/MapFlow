import { useEffect, useMemo, useState, type UIEvent } from 'react';
import type { SkillTree } from '../../types/learning';
import type { PublicTreeAttribution } from './types';

export type PublicTreeSourceFilter = 'all' | 'user' | 'official';
export type PublicTreeDifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';
export type PublicTreeNodeCountFilter = 'all' | '1-30' | '31-60' | '61+';
export type PublicTreeSort = 'newest' | 'title';

export interface PublicTreeFilters {
  query: string;
  source: PublicTreeSourceFilter;
  difficulty: PublicTreeDifficultyFilter;
  nodeCount: PublicTreeNodeCountFilter;
  sort: PublicTreeSort;
}

interface PublicTreeCatalogPanelProps {
  trees: SkillTree[];
  attributions: Record<string, PublicTreeAttribution>;
  selectedTreeId: string | null;
  onSelect: (treeId: string) => void;
  onCollapse: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  nextPageError?: unknown;
  onLoadMore: () => void;
  initialLoading?: boolean;
  initialError?: unknown;
  onRetry?: () => void;
}

const DEFAULT_FILTERS: PublicTreeFilters = {
  query: '',
  source: 'all',
  difficulty: 'all',
  nodeCount: 'all',
  sort: 'newest',
};

export function filterPublicTrees(
  trees: SkillTree[],
  attributions: Record<string, PublicTreeAttribution>,
  filters: PublicTreeFilters,
): SkillTree[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('zh-CN');
  const filtered = trees.filter((tree) => {
    const attribution = attributions[tree.id];
    const isUserPublished = Boolean(attribution?.publisher_display_name);
    if (filters.source === 'user' && !isUserPublished) return false;
    if (filters.source === 'official' && isUserPublished) return false;
    if (filters.difficulty !== 'all' && normalizeDifficulty(tree.difficulty_level) !== filters.difficulty) return false;
    if (filters.nodeCount === '1-30' && (tree.total_nodes < 1 || tree.total_nodes > 30)) return false;
    if (filters.nodeCount === '31-60' && (tree.total_nodes < 31 || tree.total_nodes > 60)) return false;
    if (filters.nodeCount === '61+' && tree.total_nodes < 61) return false;
    if (!normalizedQuery) return true;
    return [tree.title, tree.topic, attribution?.publisher_display_name ?? '官方地图']
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  });

  return filters.sort === 'title'
    ? [...filtered].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
    : filtered;
}

export function PublicTreeCatalogPanel({
  trees,
  attributions,
  selectedTreeId,
  onSelect,
  onCollapse,
  hasNextPage,
  isFetchingNextPage,
  nextPageError,
  onLoadMore,
  initialLoading = false,
  initialError,
  onRetry,
}: PublicTreeCatalogPanelProps) {
  const [filters, setFilters] = useState<PublicTreeFilters>(DEFAULT_FILTERS);
  const visibleTrees = useMemo(
    () => filterPublicTrees(trees, attributions, filters),
    [attributions, filters, trees],
  );
  const discoveryQueryActive = Boolean(
    filters.query.trim() ||
    filters.source !== 'all' ||
    filters.difficulty !== 'all' ||
    filters.nodeCount !== 'all' ||
    filters.sort !== 'newest',
  );

  useEffect(() => {
    if (!discoveryQueryActive || !hasNextPage || isFetchingNextPage) return;
    const timer = window.setTimeout(onLoadMore, 180);
    return () => window.clearTimeout(timer);
  }, [discoveryQueryActive, hasNextPage, isFetchingNextPage, onLoadMore, trees.length]);

  const updateFilter = <Key extends keyof PublicTreeFilters>(
    key: Key,
    value: PublicTreeFilters[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 280
    ) {
      onLoadMore();
    }
  };

  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col bg-slate-950/95"
    >
      <div className="shrink-0 border-b border-slate-800/80 bg-slate-950/95 p-4 shadow-[0_12px_35px_rgba(2,6,23,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400/70"><span>PUBLIC ATLAS</span><span className="ml-2 text-slate-500">公共树池</span></p>
            <h2 className="mt-1 text-lg font-bold text-slate-100">发现下一张学习地图</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">搜索社区与官方路线，右侧即时查看完整地图。</p>
          </div>
          <button type="button" aria-label="收起公共树库" onClick={onCollapse} className="hidden rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-cyan-400/60 hover:text-cyan-200 lg:block">收起</button>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-sm focus-within:border-cyan-400/70 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.08)]">
          <span aria-hidden="true" className="text-cyan-400">⌕</span>
          <span className="sr-only">搜索公共地图</span>
          <input
            aria-label="搜索公共地图"
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="搜索标题、主题或发布者"
            className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          />
          {filters.query && <button type="button" aria-label="清除搜索" onClick={() => updateFilter('query', '')} className="text-slate-500 hover:text-slate-200">×</button>}
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <CatalogSelect label="来源" value={filters.source} onChange={(value) => updateFilter('source', value as PublicTreeSourceFilter)}>
            <option value="all">全部来源</option><option value="user">用户发布</option><option value="official">官方地图</option>
          </CatalogSelect>
          <CatalogSelect label="难度" value={filters.difficulty} onChange={(value) => updateFilter('difficulty', value as PublicTreeDifficultyFilter)}>
            <option value="all">全部难度</option><option value="beginner">入门</option><option value="intermediate">中级</option><option value="advanced">高级</option>
          </CatalogSelect>
          <CatalogSelect label="节点规模" value={filters.nodeCount} onChange={(value) => updateFilter('nodeCount', value as PublicTreeNodeCountFilter)}>
            <option value="all">全部规模</option><option value="1-30">1–30 节点</option><option value="31-60">31–60 节点</option><option value="61+">61+ 节点</option>
          </CatalogSelect>
          <CatalogSelect label="地图排序" value={filters.sort} onChange={(value) => updateFilter('sort', value as PublicTreeSort)}>
            <option value="newest">最新发布</option><option value="title">按标题</option><option disabled value="heat">热度（即将上线）</option>
          </CatalogSelect>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500" role="status">
          <span>{hasNextPage ? `已找到 ${visibleTrees.length} 张，继续浏览可加载更多` : `共 ${visibleTrees.length} 张地图`}</span>
          {(filters.query || filters.source !== 'all' || filters.difficulty !== 'all' || filters.nodeCount !== 'all' || filters.sort !== 'newest') && (
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="font-semibold text-cyan-300 hover:text-cyan-100">清除筛选</button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:pb-5" onScroll={handleScroll}>
        {initialLoading && trees.length === 0 ? (
          <CatalogMessage>正在读取公共技能树…</CatalogMessage>
        ) : initialError && trees.length === 0 ? (
          <CatalogMessage>
            <span className="block font-semibold text-amber-100">公共技能树暂时无法读取</span>
            {onRetry && <button type="button" aria-label="重新读取公共树库" onClick={onRetry} className="mt-3 rounded-lg border border-amber-300/40 px-3 py-1.5 text-amber-100">重新读取</button>}
          </CatalogMessage>
        ) : visibleTrees.length ? (
          <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
            {visibleTrees.map((tree) => (
              <PublicTreeCatalogCard key={tree.id} tree={tree} attribution={attributions[tree.id]} selected={tree.id === selectedTreeId} onSelect={() => onSelect(tree.id)} />
            ))}
          </div>
        ) : (
          <CatalogMessage>{trees.length ? '没有符合条件的地图。' : '当前还没有可浏览的公共技能树。'}</CatalogMessage>
        )}

        {hasNextPage && (
          <button type="button" onClick={onLoadMore} disabled={isFetchingNextPage} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/60 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60">
            {isFetchingNextPage ? '正在加载更多地图…' : nextPageError ? '继续加载失败，点击重试' : '加载更多地图'}
          </button>
        )}
      </div>
    </div>
  );
}

function PublicTreeCatalogCard({ tree, attribution, selected, onSelect }: { tree: SkillTree; attribution?: PublicTreeAttribution; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-label={`查看 ${tree.title}`}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={`group relative min-h-32 overflow-hidden rounded-2xl border p-4 text-left transition duration-200 ${selected ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.15)]' : 'border-slate-800 bg-gradient-to-br from-slate-900/95 to-slate-900/55 hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-slate-900'}`}
    >
      <span aria-hidden="true" className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-400/5 blur-2xl transition group-hover:bg-cyan-400/10" />
      <span className="relative block min-h-12 text-sm font-bold leading-6 text-slate-100 line-clamp-2">{tree.title}</span>
      <span className="relative mt-2 block truncate text-xs text-cyan-300/80">{tree.topic}</span>
      <span className="relative mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        <span className="rounded-md border border-slate-700/80 bg-slate-950/50 px-1.5 py-0.5">{attribution?.publisher_display_name ? `发布者 ${attribution.publisher_display_name}` : '官方地图'}</span>
        <span>{tree.total_nodes} 节点</span>
        <span>·</span>
        <span>{difficultyLabel(tree.difficulty_level)}</span>
      </span>
    </button>
  );
}

function CatalogSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[11px] text-slate-500">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full cursor-pointer bg-transparent text-xs font-medium text-slate-300 outline-none">{children}</select>
    </label>
  );
}

function CatalogMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm leading-6 text-slate-500">{children}</div>;
}

function normalizeDifficulty(value: string): PublicTreeDifficultyFilter {
  const normalized = value.trim().toLowerCase();
  if (['beginner', 'easy', '入门', '初级'].includes(normalized)) return 'beginner';
  if (['advanced', 'hard', '高级', '困难'].includes(normalized)) return 'advanced';
  return 'intermediate';
}

export function difficultyLabel(value: string): string {
  const normalized = normalizeDifficulty(value);
  return normalized === 'beginner' ? '入门' : normalized === 'advanced' ? '高级' : '中级';
}
