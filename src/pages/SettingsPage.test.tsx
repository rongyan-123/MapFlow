import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { IdentityProvider } from '../domains/identity/IdentityContext';
import SettingsPage from './SettingsPage';
afterEach(()=>vi.unstubAllGlobals());
const session={account:{playerId:'account-a',username:'learner',status:'active',isAdmin:false},csrfToken:'csrf-a'};
it('shows the account without offering administrative access and signs in with its CSRF',async()=>{
  const requests: Array<[string,RequestInit|undefined]>=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    requests.push([path,options]);
    if(path==='/api/auth/session')return new Response(JSON.stringify(session));
    if(path==='/api/credit/me')return new Response(JSON.stringify({balance:2,signedInToday:false,freeRemaining:0,pricePerTree:1}));
    if(path==='/api/credit/signin')return new Response(JSON.stringify({balance:3,awarded:1}));
    return new Response('{}',{status:503});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><IdentityProvider><SettingsPage navigate={vi.fn()} /></IdentityProvider></QueryClientProvider>);
  await screen.findByText('learner');
  expect(screen.queryByRole('button',{name:'管理后台'})).not.toBeInTheDocument();
  await screen.findByRole('button',{name:'签到领取积分'});
  fireEvent.click(screen.getByRole('button',{name:'签到领取积分'}));
  await waitFor(()=>expect(requests.some(([path])=>path==='/api/credit/signin')).toBe(true));
  expect(requests.find(([path])=>path==='/api/credit/signin')?.[1]?.headers).toMatchObject({'X-CSRF-Token':'csrf-a'});
  client.clear();
});
