import {afterEach,expect,it,vi} from 'vitest';
import {fetchAgentModelConfiguration,activateAgentModelProfile,saveAgentModelProfile,fetchAgentSettlementAttention,reviewAgentSettlement} from './agentModelClient';
import {configurationFixture} from '../test/agentModelFixture';
afterEach(()=>vi.unstubAllGlobals());
it('reviews the selected evidence version with CSRF and no model credentials',async()=>{
 const executionId='01a14370-3646-7603-a29c-69dcc8bc6e49';
 const result={executionId,outcome:'acknowledged',checkedAt:'2026-10-16T00:00:00Z',reason:'本版本记录已核对，原始依据继续保留。'};
 const fetch=vi.fn().mockResolvedValue(Response.json(result));vi.stubGlobal('fetch',fetch);
 const input={action:'acknowledge_audit' as const,expectedAttentionKey:'a'.repeat(64),note:'已核对停止请求，上游未知状态保留。'};
 expect(await reviewAgentSettlement(executionId,input,'csrf-fixture')).toEqual(result);
 expect(fetch.mock.calls[0]).toEqual([`/api/admin/agent-settlements/${executionId}/review`,expect.objectContaining({
   method:'POST',credentials:'same-origin',body:JSON.stringify(input),headers:expect.objectContaining({'X-CSRF-Token':'csrf-fixture'})
 })]);
});
it('reads administrator settlement pages without keys and rejects unexpected secret-bearing fields',async()=>{
 const page={pending:[],nextBefore:null,totalCount:0};
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(page)));vi.stubGlobal('fetch',fetch);
 expect(await fetchAgentSettlementAttention()).toEqual(page);
 expect(fetch.mock.calls[0]).toEqual(['/api/admin/agent-settlements',expect.objectContaining({credentials:'same-origin'})]);
 fetch.mockResolvedValue(new Response(JSON.stringify({...page,apiKey:'must not be displayed'})));
 await expect(fetchAgentSettlementAttention()).rejects.toThrow();
});
it('uses a CSRF protected activation with the stored epoch and never sends keys on reads',async()=>{
  const fetch=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify(configurationFixture()),{headers:{'content-type':'application/json'}})));vi.stubGlobal('fetch',fetch);
  await fetchAgentModelConfiguration();
  const activation={funding:'points' as const,profileId:'points-test',profileVersion:2,expectedEpoch:3};
  await activateAgentModelProfile(activation,'csrf-fixture');
  expect(fetch.mock.calls[0]![0]).toBe('/api/admin/agent-models');
  expect(fetch.mock.calls[1]).toEqual(['/api/admin/agent-models/active',expect.objectContaining({method:'PUT',
    body:JSON.stringify(activation),headers:expect.objectContaining({'X-CSRF-Token':'csrf-fixture'})})]);
});
it('rejects secret-bearing or malformed configuration responses instead of displaying them',async()=>{
  const value=configurationFixture();Object.assign(value.profiles[0]!.snapshot,{apiKey:'leaked-fixture-key'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
  await expect(fetchAgentModelConfiguration()).rejects.toThrow();
  await expect(saveAgentModelProfile({profile:configurationFixture().profiles[0]!},'csrf')).rejects.toThrow();
});
