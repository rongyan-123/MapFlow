import {afterEach,expect,it,vi} from 'vitest';
import {setNodeProgressBatch,cancelNodeProgressBatch} from './treeLibraryClient';
afterEach(()=>vi.unstubAllGlobals());

it('sends all progress changes with one operation identity and propagates request cancellation',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'applied',node_progress:[{node_id:'a',progress_percent:100},{node_id:'b',progress_percent:100}]})));
 vi.stubGlobal('fetch',fetchMock);
 const controller=new AbortController(),changes=[{nodeId:'a',expectedPercent:0,progressPercent:100},{nodeId:'b',expectedPercent:35,progressPercent:100}];
 await expect(setNodeProgressBatch('entry/id',changes,'operation','csrf',controller.signal)).resolves.toMatchObject({status:'applied',node_progress:[{node_id:'a',progress_percent:100},{node_id:'b',progress_percent:100}]});
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tree-library/entry%2Fid/progress/batch',expect.objectContaining({method:'PUT',signal:controller.signal,
  headers:expect.objectContaining({'X-CSRF-Token':'csrf'}),body:JSON.stringify({operationId:'operation',changes})})]);
});

it('asks the server whether cancellation won instead of treating an aborted fetch as a rollback',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'cancelled',node_progress:[{node_id:'b',progress_percent:35}]})));
 vi.stubGlobal('fetch',fetchMock);
 await expect(cancelNodeProgressBatch('entry','operation/id','csrf',new AbortController().signal)).resolves.toMatchObject({status:'cancelled'});
 expect(fetchMock.mock.calls[0]).toEqual(['/api/me/tree-library/entry/progress/batch/operation%2Fid/cancel',expect.objectContaining({method:'POST',headers:expect.objectContaining({'X-CSRF-Token':'csrf'})})]);
});

it('rejects malformed batch results instead of displaying unconfirmed completion',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'applied',node_progress:[{node_id:'a',progress_percent:101}]}))));
 await expect(setNodeProgressBatch('entry',[{nodeId:'a',expectedPercent:0,progressPercent:100}],'operation','csrf',new AbortController().signal)).rejects.toThrow();
});
