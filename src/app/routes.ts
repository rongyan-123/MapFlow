export type PageId = 'landing' | 'assistant' | 'library' | 'maps' | 'learning' | 'tavern' | 'wallet' | 'models' | 'admin' | 'settings' | 'login' | 'register';
export type LegacyView = 'public' | 'personal' | 'learning';

export interface ApplicationRoute {
  page: PageId;
  pathname: string;
  search: string;
  guide: boolean;
  entryId?: string;
  areaId?: string;
  node?: { id: string; title: string };
}

const pages = new Set<PageId>(['assistant','library','maps','learning','tavern','wallet','models','admin','settings','login','register']);

export function resolveRoute(address: string, legacyView?: LegacyView): ApplicationRoute {
  const url = new URL(address, window.location.origin);
  const candidate = url.pathname.slice(1) as PageId;
  const page: PageId = url.pathname === '/' && url.searchParams.get('marketing') === '1'
    ? 'landing'
    : url.pathname === '/console'
    ? legacyView === 'personal' ? 'maps' : legacyView === 'learning' ? 'learning' : 'library'
    : pages.has(candidate) ? candidate : 'assistant';
  const entryId = url.searchParams.get('entry');
  const areaId = url.searchParams.get('area');
  const nodeId = url.searchParams.get('node');
  const nodeTitle = url.searchParams.get('title');
  return {
    page, pathname: url.pathname, search: url.search,
    guide: url.searchParams.get('guide') === '1',
    ...(page === 'maps' && entryId ? { entryId } : {}),
    ...(page === 'learning' && areaId ? { areaId } : {}),
    ...(page === 'learning' && nodeId && nodeId.length <= 128 && !nodeId.includes('\0') && nodeTitle?.trim() && nodeTitle.length <= 200 && !nodeTitle.includes('\0')
      ? { node: { id: nodeId, title: nodeTitle.trim() } } : {}),
  };
}
