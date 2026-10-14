import { afterEach, expect, it, vi } from 'vitest';
import { fetchRestorePoint, restoreTree } from './treeRestoreClient';
afterEach(()=>vi.unstubAllGlobals());
it('rejects invalid restore metadata and mismatched completion receipts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({snapshotId:null,canRestore:true}))).mockResolvedValueOnce(new Response(JSON.stringify({snapshotId:'other',revision:3}))));
 await expect(fetchRestorePoint('entry')).rejects.toThrow('恢复信息暂时无法读取');
 await expect(restoreTree('entry','expected','csrf')).rejects.toThrow('恢复结果暂时无法确认');
});
it('never exposes untrusted network or server messages',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(new Error('private hostname')).mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'unknown',message:'private sql'}}),{status:500})));
 await expect(fetchRestorePoint('entry')).rejects.toThrow('暂时无法连接，请检查网络后重试。');
 await expect(fetchRestorePoint('entry')).rejects.not.toThrow('private sql');
});
