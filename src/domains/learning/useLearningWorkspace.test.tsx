import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useLearningWorkspace} from './useLearningWorkspace';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
const area={areaId:'owned-map',libraryEntryId:'owned-map',title:'我的学习路线',available:true,createdAt:'2026-10-14T10:00:00Z'};
function mount(requestedAreaId?:string){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return renderHook(()=>useLearningWorkspace('player-1','csrf',requestedAreaId),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});}
it('checks server membership before requesting an area conversation or map',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);return new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[area]}:{entries:[]}));});
  const view=mount('foreign-map');await waitFor(()=>expect(view.result.current.areas.isSuccess).toBe(true));
  expect(view.result.current.area).toBeUndefined();expect(paths).not.toContain('/api/me/tree-library/foreign-map');
});
it('allows viewing unavailable area history while preventing creation and map access',async()=>{
  const paths:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{paths.push(path);return new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[{...area,available:false}]}:{entries:[]}));});
  const view=mount();await waitFor(()=>expect(view.result.current.areas.isSuccess).toBe(true));act(()=>view.result.current.select('owned-map'));
  expect(view.result.current.area?.available).toBe(false);expect(view.result.current.canCreate).toBe(false);
  expect(paths.every(path=>!path.endsWith('/owned-map'))).toBe(true);
});
it('restores the remembered area only after checking the account-owned server list',async()=>{
  localStorage.setItem('mapflow.learning.area.v1.player-1','owned-map');
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[area]}:{entries:[]})));
  const view=mount();await waitFor(()=>expect(view.result.current.areas.isSuccess).toBe(true));
  expect(view.result.current.area?.areaId).toBe('owned-map');
  act(()=>view.result.current.select(null));expect(view.result.current.area).toBeUndefined();expect(localStorage.getItem('mapflow.learning.area.v1.player-1')).toBeNull();
});
it('prefers an explicit area over the remembered area and clears when returning to the list',async()=>{
  localStorage.setItem('mapflow.learning.area.v1.player-1','stale-map');
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[area]}:{entries:[]})));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const view=renderHook(({requested})=>useLearningWorkspace('player-1','csrf',requested),{initialProps:{requested:'owned-map' as string|undefined},wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
  await waitFor(()=>expect(view.result.current.area?.areaId).toBe('owned-map'));
  view.rerender({requested:undefined});expect(view.result.current.area).toBeUndefined();
});

it('remembers only explicit map choices per account and area across refresh and address navigation',async()=>{
  const secondArea={...area,areaId:'second-map',libraryEntryId:'second-map'};
  vi.stubGlobal('fetch',async(path:string)=>new Response(JSON.stringify(path.endsWith('/learning-areas')?{areas:[area,secondArea]}:{entries:[]})));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const wrapper=({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view=renderHook(({account,requested})=>useLearningWorkspace(account,'csrf',requested),{initialProps:{account:'player-1',requested:'owned-map'},wrapper});
  await waitFor(()=>expect(view.result.current.area?.areaId).toBe('owned-map'));
  expect(view.result.current.mapVisible).toBe(false);
  expect(Object.keys(localStorage).filter(key=>key.includes('mapflow.ui.'))).toEqual([]);
  act(()=>view.result.current.setMapVisible(true));
  view.unmount();
  const refreshed=renderHook(({account,requested})=>useLearningWorkspace(account,'csrf',requested),{initialProps:{account:'player-1',requested:'owned-map'},wrapper});
  await waitFor(()=>expect(refreshed.result.current.area?.areaId).toBe('owned-map'));
  expect(refreshed.result.current.mapVisible).toBe(true);
  refreshed.rerender({account:'player-1',requested:'second-map'});
  expect(refreshed.result.current.mapVisible).toBe(false);
  refreshed.rerender({account:'player-1',requested:'owned-map'});
  expect(refreshed.result.current.mapVisible).toBe(true);
  refreshed.rerender({account:'player-2',requested:'owned-map'});
  expect(refreshed.result.current.mapVisible).toBe(false);
  refreshed.rerender({account:'player-1',requested:'owned-map'});
  act(()=>refreshed.result.current.setMapVisible(false));
  refreshed.unmount();
  const closed=mount('owned-map');
  await waitFor(()=>expect(closed.result.current.area?.areaId).toBe('owned-map'));
  expect(closed.result.current.mapVisible).toBe(false);
});
