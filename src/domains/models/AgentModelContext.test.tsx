import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { AgentModelProvider,useAgentModelConfiguration } from './AgentModelContext';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
const cash={profileId:'33333333-3333-4333-8333-333333333333',profileVersion:3,modelId:'real-model',displayName:'真实模型',contextWindow:128000,maxOutputTokens:8000};
function Control(){const state=useAgentModelConfiguration();return <><output>{state.options.modelLabel}</output><select aria-label="资金" value={state.options.funding} onChange={event=>state.change({funding:event.target.value as 'cash'|'points'|'byok'})}><option value="cash">现金</option><option value="points">积分</option><option value="byok">自填</option></select></>;}
function mount(accountId='a'){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><AgentModelProvider accountId={accountId}><Control /></AgentModelProvider></QueryClientProvider>);}
it('uses the live default profile version and preserves the funding preference',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({cash:[cash],defaultCash:cash,points:null})));mount();await screen.findByText('真实模型');expect(screen.getByLabelText('资金')).toHaveValue('cash');
  fireEvent.change(screen.getByLabelText('资金'),{target:{value:'byok'}});
  expect(JSON.parse(localStorage.getItem('mapflow.agent.selection.v1.a')!)).toMatchObject({funding:'byok'});
  expect(localStorage.getItem('mapflow.agent.selection.v1.a')).not.toMatch(/apiKey/i);
});
it('reads each account preference independently',async()=>{
  localStorage.setItem('mapflow.agent.selection.v1.other',JSON.stringify({funding:'points',profileId:'',contextWindow:''}));
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({cash:[cash],defaultCash:cash,points:null})));mount('a');await screen.findByText('真实模型');expect(screen.getByLabelText('资金')).toHaveValue('cash');
});
it('does not silently substitute the default when the explicitly selected paid model is no longer open',async()=>{
  localStorage.setItem('mapflow.agent.selection.v1.a',JSON.stringify({funding:'cash',profileId:'retired',contextWindow:''}));
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({cash:[cash],defaultCash:cash,points:null})));mount('a');
  await screen.findByLabelText('资金');
  await new Promise(resolve=>setTimeout(resolve,30));
  expect(screen.queryByText('真实模型')).not.toBeInTheDocument();
  expect(screen.getByLabelText('资金')).toHaveValue('cash');
});
