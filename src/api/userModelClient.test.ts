import {afterEach,expect,it,vi} from 'vitest';
import {readUserModelCatalog} from './userModelClient';
afterEach(()=>vi.unstubAllGlobals());
it('reads the BYOK catalog independently of any generation session',async()=>{
  const profile={id:'model-1',provider:'custom',contextWindow:32000,baseUrl:'https://models.example/v1',settings:[{name:'reasoning',kind:'switch',options:[]}]};const fetchMock=vi.fn(async()=>new Response(JSON.stringify([profile])));vi.stubGlobal('fetch',fetchMock);expect(await readUserModelCatalog()).toEqual([profile]);expect(fetchMock.mock.calls).toHaveLength(1);
});
it('rejects invalid model capabilities without displaying provider diagnostics',async()=>{vi.stubGlobal('fetch',async()=>new Response(JSON.stringify([{id:'model-1',provider:'custom',contextWindow:-1,baseUrl:'https://models.example/v1',settings:[]}])));await expect(readUserModelCatalog()).rejects.toMatchObject({code:'model_catalog.invalid_response'});});
