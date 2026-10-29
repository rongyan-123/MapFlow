import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { SceneModelsProvider,useSceneModels } from './SceneModelContext';
import { readLegacyScenePreference } from './scenePreferences';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
function Probe(){const state=useSceneModels()!;return <><output>{JSON.stringify(state.entries)}</output><button disabled={!state.ready} onClick={()=>void state.save('study_plan',1,{...readLegacyScenePreference('a'),funding:'byok',model:'plan-only'},'memory-only')}>保存计划模型</button></>;}
it('migrates once, saves one purpose and never serializes a credential',async()=>{
  const requests:{path:string;body:unknown}[]=[];let saved={};
  vi.stubGlobal('fetch',async(path:string,init?:RequestInit)=>{const body=init?.body?JSON.parse(String(init.body)):null;requests.push({path,body});if(path.endsWith('/migrate'))saved=Object.fromEntries(['management','learning','tavern','study_plan'].map(purpose=>[purpose,{version:1,settings:body.settings}]));else if(init?.method==='PUT'){const entry={version:2,settings:body.settings};saved={...saved,study_plan:entry};return Response.json(entry);}return Response.json(saved);});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><SceneModelsProvider accountId="a" csrfToken="csrf"><Probe /></SceneModelsProvider></QueryClientProvider>);
  await waitFor(()=>expect(screen.getByRole('button')).toBeEnabled());fireEvent.click(screen.getByRole('button'));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('plan-only'));
  expect(requests.filter(request=>request.path.endsWith('/migrate'))).toHaveLength(1);
  expect(requests.filter(request=>request.path.endsWith('/study_plan'))).toHaveLength(1);
  expect(JSON.stringify(requests)).not.toContain('memory-only');
  expect(JSON.stringify(saved)).toContain('plan-only');
});
