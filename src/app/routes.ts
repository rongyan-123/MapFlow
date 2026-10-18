export type PageId = 'landing' | 'assistant' | 'library' | 'maps' | 'learning' | 'tavern' | 'english-world' | 'wallet' | 'models' | 'admin' | 'settings' | 'login' | 'register';
export type EnglishWorldRoute =
  | { view: 'home' | 'words' | 'review' | 'not-found' }
  | { view: 'prepare'; taskId: string }
  | { view: 'world'; worldId: string }
  | { view: 'play'; playthroughId: string; branchId?: string };
export type LegacyView = 'public' | 'personal' | 'learning';
export interface LegacyConsoleState {
  version:1;view:LegacyView;selectedLibraryEntryId?:string|null;selectedPublicTreeId?:string|null;
  selectedNodeId?:string|null;layoutMode?:'relationship'|'blocks';
}

export interface ApplicationRoute {
  page: PageId;
  pathname: string;
  search: string;
  guide: boolean;
  entryId?: string;
  treeId?: string;
  areaId?: string;
  selectedNodeId?:string;
  layoutMode?:'relationship'|'blocks';
  node?: { id: string; title: string };
  englishWorld?: EnglishWorldRoute;
}

function englishWorldRoute(url: URL): EnglishWorldRoute {
  const segments = url.pathname.replace(/\/$/u, '').split('/').slice(2);
  if (!segments.length) return { view: 'home' };
  if (segments.length === 1 && (segments[0] === 'words' || segments[0] === 'review')) return { view: segments[0] };
  const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
  if (segments.length !== 2 || !validId(segments[1])) return { view: 'not-found' };
  if (segments[0] === 'prepare') return { view: 'prepare', taskId: segments[1] };
  if (segments[0] === 'worlds') return { view: 'world', worldId: segments[1] };
  if (segments[0] === 'play') {
    const branchId = url.searchParams.get('branch');
    if (branchId !== null && !validId(branchId)) return { view: 'not-found' };
    return { view: 'play', playthroughId: segments[1], ...(branchId ? { branchId } : {}) };
  }
  return { view: 'not-found' };
}

const pages = new Set<PageId>(['assistant','library','maps','learning','tavern','wallet','models','admin','settings','login','register']);

export function resolveRoute(address: string, remembered?: LegacyView|LegacyConsoleState): ApplicationRoute {
  const url = new URL(address, window.location.origin);
  const legacyView=typeof remembered==='string'?remembered:remembered?.view;
  const legacyState=url.pathname==='/console'&&typeof remembered==='object'?remembered:undefined;
  const candidate = url.pathname.slice(1) as PageId;
  const page: PageId = url.pathname === '/' && url.searchParams.get('marketing') === '1'
    ? 'landing'
    : url.pathname === '/console'
    ? legacyView === 'personal' ? 'maps' : legacyView === 'learning' ? 'learning' : 'library'
    : url.pathname === '/english-world' || url.pathname.startsWith('/english-world/') ? 'english-world'
    : pages.has(candidate) ? candidate : 'assistant';
  const entryId = url.searchParams.get('entry')??(page==='maps'?legacyState?.selectedLibraryEntryId:null);
  const treeId=url.searchParams.get('tree')??(page==='library'?legacyState?.selectedPublicTreeId:null);
  const areaId = url.searchParams.get('area');
  const nodeId = url.searchParams.get('node');
  const nodeTitle = url.searchParams.get('title');
  const sameRememberedMap=page==='maps'?entryId===legacyState?.selectedLibraryEntryId:treeId===legacyState?.selectedPublicTreeId;
  const selectedNodeId=(page==='maps'||page==='library')?(nodeId??(sameRememberedMap?legacyState?.selectedNodeId:null)):null;
  const requestedLayout=url.searchParams.get('layout');
  const layoutMode=requestedLayout==='relationship'||requestedLayout==='blocks'?requestedLayout:legacyState?.layoutMode;
  return {
    page, pathname: url.pathname, search: url.search,
    guide: url.searchParams.get('guide') === '1',
    ...(page === 'english-world' ? { englishWorld: englishWorldRoute(url) } : {}),
    ...(page === 'maps' && entryId ? { entryId } : {}),
    ...(page === 'library' && treeId ? {treeId} : {}),
    ...(selectedNodeId&&selectedNodeId.length<=128&&!selectedNodeId.includes('\0')?{selectedNodeId}:{}),
    ...((page==='maps'||page==='library')&&layoutMode?{layoutMode}:{}),
    ...(page === 'learning' && areaId ? { areaId } : {}),
    ...(page === 'learning' && nodeId && nodeId.length <= 128 && !nodeId.includes('\0') && nodeTitle?.trim() && nodeTitle.length <= 200 && !nodeTitle.includes('\0')
      ? { node: { id: nodeId, title: nodeTitle.trim() } } : {}),
  };
}
