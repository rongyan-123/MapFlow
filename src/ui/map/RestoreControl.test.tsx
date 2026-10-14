import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TreeRestoreControl from './RestoreControl';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const json = (value: unknown, status=200) => new Response(JSON.stringify(value), {status});
function mount() { const restored=vi.fn(); render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
  <TreeRestoreControl accountId="a1" libraryEntryId="entry/one" csrfToken="csrf" onRestored={restored}/></QueryClientProvider>); return restored; }
it('requires explicit confirmation, sends scoped snapshot and refreshes only after success',async()=>{
 const fetchMock=vi.fn().mockResolvedValueOnce(json({snapshotId:'s1',revision:2,canRestore:true})).mockResolvedValueOnce(json({snapshotId:'s1',revision:3})); vi.stubGlobal('fetch',fetchMock);
 const restored=mount(); const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'恢复最近一次修改'}));
 await screen.findByRole('button',{name:'确认恢复地图、笔记和进度'});
 expect(fetchMock).toHaveBeenCalledTimes(1); expect(restored).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'确认恢复地图、笔记和进度'}));
 await vi.waitFor(()=>expect(restored).toHaveBeenCalledTimes(1));
 expect(fetchMock.mock.calls[1][0]).toBe('/api/me/tree-library/entry%2Fone/restore');
 expect(fetchMock.mock.calls[1][1]).toMatchObject({method:'POST',body:JSON.stringify({snapshotId:'s1'}),headers:expect.objectContaining({'X-CSRF-Token':'csrf'})});
});
it('keeps content and hides raw failures when restore conflicts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(json({snapshotId:'s1',revision:2,canRestore:true})).mockResolvedValueOnce(json({error:{code:'tree_library.restore_conflict',message:'secret postgres stack'}},409)));
 const restored=mount(); const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:'恢复最近一次修改'}));
 await user.click(await screen.findByRole('button',{name:'确认恢复地图、笔记和进度'}));
 expect(await screen.findByRole('alert')).not.toHaveTextContent('secret postgres'); expect(restored).not.toHaveBeenCalled();
});
it('does not enable restoration after later changes',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({snapshotId:'s1',revision:2,canRestore:false})));
 mount(); await userEvent.click(screen.getByRole('button',{name:'恢复最近一次修改'}));
 expect(await screen.findByText('地图或笔记已有后续修改，不能恢复。')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'确认恢复地图、笔记和进度'})).not.toBeInTheDocument();
});
