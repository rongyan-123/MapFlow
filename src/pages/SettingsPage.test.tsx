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
it('confirms logout and preserves the session when the confirmation is cancelled',async()=>{
  const requests:string[]=[];vi.stubGlobal('fetch',async(path:string)=>{requests.push(path);return new Response(JSON.stringify(path==='/api/auth/session'?session:path==='/api/credit/me'?{balance:2,signedInToday:false,freeRemaining:0,pricePerTree:1}:{}));});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><IdentityProvider><SettingsPage navigate={vi.fn()} /></IdentityProvider></QueryClientProvider>);
  await screen.findByText('learner');fireEvent.click(screen.getByRole('button',{name:'退出登录'}));
  expect(screen.getByRole('dialog',{name:'退出登录'})).toBeVisible();expect(requests).not.toContain('/api/auth/logout');
  fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByText('learner')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'退出登录'}));fireEvent.click(screen.getByRole('button',{name:'确认退出'}));
  await waitFor(()=>expect(requests.filter(path=>path==='/api/auth/logout')).toHaveLength(1));client.clear();
});
