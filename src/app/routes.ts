export type PageId = 'landing' | 'assistant' | 'library' | 'maps' | 'learning' | 'tavern' | 'wallet' | 'models' | 'admin' | 'settings' | 'login' | 'register';
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
    ...(page === 'maps' && entryId ? { entryId } : {}),
    ...(page === 'library' && treeId ? {treeId} : {}),
    ...(selectedNodeId&&selectedNodeId.length<=128&&!selectedNodeId.includes('\0')?{selectedNodeId}:{}),
    ...((page==='maps'||page==='library')&&layoutMode?{layoutMode}:{}),
    ...(page === 'learning' && areaId ? { areaId } : {}),
    ...(page === 'learning' && nodeId && nodeId.length <= 128 && !nodeId.includes('\0') && nodeTitle?.trim() && nodeTitle.length <= 200 && !nodeTitle.includes('\0')
      ? { node: { id: nodeId, title: nodeTitle.trim() } } : {}),
  };
}
