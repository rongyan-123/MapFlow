import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { renderHook,act,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { useMapActions } from './useMapActions';
afterEach(()=>vi.unstubAllGlobals());
function setup(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const onLearning=vi.fn();const onDeleted=vi.fn();const view=renderHook(()=>useMapActions({accountId:'a',csrfToken:'csrf-a',entryId:'entry-one',onLearning,onDeleted}),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});return {...view,client,onLearning,onDeleted};}
it('starts learning once and ignores a late reply after leaving its source page',async()=>{
  let finish!:(response:Response)=>void;const fetchMock=vi.fn(()=>new Promise<Response>(resolve=>finish=resolve));vi.stubGlobal('fetch',fetchMock);
  const view=setup();
  act(()=>{view.result.current.openLearning();view.result.current.openLearning();});
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0]).toEqual(['/api/me/learning-areas/entry-one',expect.objectContaining({method:'POST',headers:expect.objectContaining({'X-CSRF-Token':'csrf-a'})})]);
  view.unmount();
  await act(async()=>finish(new Response(JSON.stringify({areaId:'area-one',libraryEntryId:'entry-one',title:'地图',available:true,createdAt:'2026-10-14'}))));
  expect(view.onLearning).not.toHaveBeenCalled();
});
it('writes progress to its owned entry and refreshes the account index',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetchMock);
  const view=setup();view.client.setQueryData(['me','a','tree-library'],{entries:[]});
  act(()=>view.result.current.progress.mutate({nodeId:'n-one',percent:37}));
  await waitFor(()=>expect(view.result.current.progress.isSuccess).toBe(true));
  expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tree-library/entry-one/nodes/n-one/progress',expect.objectContaining({method:'PUT',body:JSON.stringify({progressPercent:37}),headers:expect.objectContaining({'X-CSRF-Token':'csrf-a'})})]);
  expect(view.client.getQueryState(['me','a','tree-library'])?.isInvalidated).toBe(true);
});
it('does not navigate away from a new map when deletion of the previous map completes',async()=>{
  let finish!:(response:Response)=>void;vi.stubGlobal('fetch',()=>new Promise<Response>(resolve=>finish=resolve));
  const client=new QueryClient();const onDeleted=vi.fn();
  const view=renderHook(({entryId})=>useMapActions({accountId:'a',csrfToken:'csrf-a',entryId,onLearning:vi.fn(),onDeleted}),{initialProps:{entryId:'entry-one'},wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
  act(()=>view.result.current.removal.mutate());await waitFor(()=>expect(finish).toBeDefined());
  view.rerender({entryId:'entry-two'});await act(async()=>finish(new Response('{}')));
  await waitFor(()=>expect(view.result.current.removal.isPending).toBe(false));expect(onDeleted).not.toHaveBeenCalled();
});
