import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IdentityProvider,SESSION_QUERY_KEY} from '../../domains/identity/IdentityContext';
import AdminPage from './AdminPage';
afterEach(()=>vi.unstubAllGlobals());
const account={accountId:'person-1',username:'用户姓名很长也要完整显示',status:'active',registeredAt:'2026-10-14T10:00:00Z',lastSeenAt:null,byokSessions:1,platformSessions:2,totalTokens:400,platformConsumedUsages:2,activeMinutes:15,creditBalance:10};
function mount(isAdmin:boolean){const requests:Array<[string,RequestInit|undefined]>=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{requests.push([path,options]);if(path==='/api/admin/accounts')return new Response(JSON.stringify({accounts:[account]}));return new Response('{}',{status:503});});const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(SESSION_QUERY_KEY,{account:{playerId:'admin-1',username:'管理员',status:'active',isAdmin},csrfToken:'csrf'});render(<QueryClientProvider client={client}><IdentityProvider><AdminPage navigate={vi.fn()} /></IdentityProvider></QueryClientProvider>);return requests;}
it('does not load administrator data for an ordinary account',()=>{const requests=mount(false);expect(screen.getByText('当前账号没有管理权限。')).toBeVisible();expect(requests.some(([path])=>path.startsWith('/api/admin/'))).toBe(false);});
it('offers the admin-only knowledge section without publishing on navigation',async()=>{
  const requests=mount(true);
  expect(screen.getByRole('option',{name:'助手知识库'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'后台分区'}),{target:{value:'knowledge'}});
  await screen.findByRole('heading',{name:'助手知识库'});
  await waitFor(()=>expect(requests.some(([path])=>path.startsWith('/api/admin/assistant-knowledge/articles'))).toBe(true));
  expect(requests.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
it('switches sections without writes and offers account actions on the mobile record',async()=>{
  const requests=mount(true);fireEvent.change(screen.getByRole('combobox',{name:'后台分区'}),{target:{value:'accounts'}});
  const mobileRecord=await screen.findByRole('article',{name:account.username});expect(within(mobileRecord).getByRole('button',{name:'封禁'})).toBeEnabled();
  fireEvent.click(within(mobileRecord).getByRole('button',{name:'封禁'}));expect(screen.getByRole('dialog',{name:'封禁用户'})).toBeVisible();
  expect(requests.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'确认封禁'}));await waitFor(()=>expect(requests.some(([path,options])=>path.endsWith('/person-1/suspend')&&options?.method==='POST')).toBe(true));
});
