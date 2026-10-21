import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor,within,act} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {NotificationsDialog} from './NotificationsDialog';
import {useNotificationCount} from '../../domains/support/useNotifications';
afterEach(()=>vi.unstubAllGlobals());
it('blocks duplicate all-read submissions, keeps unread messages after failure and allows retry',async()=>{
  const item={notificationId:'announcement:a',kind:'announcement',title:'公告',preview:'说明',createdAt:'2026-10-21T09:00:00Z',isRead:false,targetId:'a'};
  let writes=0;let release:(response:Response)=>void=()=>{};
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){
      writes+=1;
      if(writes===1)return new Promise<Response>(resolve=>{release=resolve;});
      item.isRead=true;return new Response(null,{status:204});
    }
    return Response.json(path.endsWith('/count')?{unreadCount:item.isRead?0:1}:{items:[item],nextCursor:null});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  await screen.findByText('公告');const allRead=screen.getByRole('button',{name:'全部已读'});
  await waitFor(()=>expect(allRead).toBeEnabled());
  fireEvent.click(allRead);
  fireEvent.click(allRead);
  await waitFor(()=>expect(allRead).toBeDisabled());
  await waitFor(()=>expect(writes).toBe(1));
  fireEvent.click(allRead);
  await act(async()=>release(new Response(null,{status:503})));
  await screen.findByRole('alert');
  await waitFor(()=>expect(allRead).toBeEnabled());
  expect(screen.getByRole('button',{name:'标记已读'})).toBeEnabled();
  fireEvent.click(allRead);
  await waitFor(()=>expect(allRead).toBeDisabled());
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(writes).toBe(2);
});
it('keeps a message arriving during all-read visible and unread after refreshing the bell',async()=>{
  const messages=[{notificationId:'announcement:old',kind:'announcement',title:'已有公告',preview:'说明',createdAt:'2026-10-21T09:00:00Z',isRead:false,targetId:'old'}];
  let release:()=>void=()=>{};
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){
      const accepted=messages.slice();
      return new Promise<Response>(resolve=>{release=()=>{accepted.forEach(message=>message.isRead=true);resolve(new Response(null,{status:204}));};});
    }
    return Response.json(path.endsWith('/count')?{unreadCount:messages.filter(message=>!message.isRead).length}:{items:messages,nextCursor:null});
  });
  function Counter(){const count=useNotificationCount('owner');return <p>未读消息 {count.data}</p>;}
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><Counter /><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  await screen.findByText('已有公告');fireEvent.click(screen.getByRole('button',{name:'全部已读'}));
  await screen.findByRole('button',{name:'正在标记…'});
  messages.push({notificationId:'announcement:new',kind:'announcement',title:'操作期间新来的公告',preview:'新的说明',createdAt:'2026-10-21T10:00:00Z',isRead:false,targetId:'new'});
  await act(async()=>release());
  const newMessage=(await screen.findByText('操作期间新来的公告')).closest('article')!;
  expect(within(newMessage).getByRole('button',{name:'标记已读'})).toBeEnabled();
  expect(screen.getByText('未读消息 1')).toBeVisible();
});
it('keeps a read message control in place so repeated clicks cannot target the following message',async()=>{
  const items=['first','second'].map(id=>({notificationId:`announcement:${id}`,kind:'announcement',title:id==='first'?'第一条公告':'第二条公告',preview:'平台说明',createdAt:'2026-10-21T09:00:00Z',isRead:false,targetId:id}));
  const writes:unknown[]=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){
      const body=JSON.parse(String(options.body));writes.push(body);
      items.forEach(item=>{if(body.notificationIds.includes(item.notificationId))item.isRead=true;});return new Response(null,{status:204});
    }
    return Response.json(path.endsWith('/count')?{unreadCount:items.filter(item=>!item.isRead).length}:{items,nextCursor:null});
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  const first=(await screen.findByRole('button',{name:'查看公告：第一条公告'})).closest('article')!;
  const second=screen.getByRole('button',{name:'查看公告：第二条公告'}).closest('article')!;
  const originalControl=within(first).getByRole('button',{name:'标记已读'});
  fireEvent.click(originalControl);
  fireEvent.click(originalControl);
  await waitFor(()=>expect(within(first).getByRole('button',{name:'已读'})).toBeDisabled());
  expect(originalControl).toBeInTheDocument();fireEvent.click(originalControl);
  expect(within(second).getByRole('button',{name:'标记已读'})).toBeEnabled();
  expect(writes).toEqual([{notificationIds:['announcement:first']}]);
});
it('marks every existing message read in one action without requiring older pages to be opened',async()=>{
  const messages=Array.from({length:26},(_,index)=>({notificationId:`announcement:a${index}`,kind:'announcement',title:`公告 ${index}`,preview:'平台说明',createdAt:'2026-10-21T09:00:00Z',isRead:false,targetId:`a${index}`}));
  const writes:Array<{path:string;body:unknown}>=[];const queries:string[]=[];
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){
      writes.push({path,body:JSON.parse(String(options.body))});
      if(path!=='/api/me/notifications/read-all')return new Response(null,{status:400});
      messages.forEach(message=>message.isRead=true);return new Response(null,{status:204});
    }
    queries.push(path);
    if(path.endsWith('/count'))return Response.json({unreadCount:messages.filter(message=>!message.isRead).length});
    return Response.json({items:messages.slice(0,20),nextCursor:'older'});
  });
  function Counter(){const count=useNotificationCount('owner');return <p>未读消息 {count.data}</p>;}
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><Counter /><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  await screen.findByText('未读消息 26');
  fireEvent.click(screen.getByRole('button',{name:'全部已读'}));
  await screen.findByText('未读消息 0');
  expect(writes).toEqual([{path:'/api/me/notifications/read-all',body:{kind:'all'}}]);
  expect(queries.some(path=>path.includes('cursor='))).toBe(false);
  expect(screen.getByRole('button',{name:'查看更多消息'})).toBeVisible();
  expect(screen.getByRole('button',{name:'全部已读'})).toBeDisabled();
});
it('keeps messages unread while browsing and reads an announcement only after opening its content',async()=>{
  const posts:unknown[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){posts.push(JSON.parse(String(options.body)));return new Response(null,{status:204});}
    if(path.includes('/notifications/announcement'))return new Response(JSON.stringify({notificationId:'announcement:a',title:'新公告',content:'完整公告正文'}));
    return new Response(JSON.stringify({items:[{notificationId:'announcement:a',kind:'announcement',title:'新公告',preview:'公告预览',createdAt:'2026-10-18T09:00:00Z',isRead:false,targetId:'a'}],nextCursor:null}));
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  const open=await screen.findByRole('button',{name:'查看公告：新公告'});expect(posts).toEqual([]);fireEvent.click(open);await screen.findByText('完整公告正文');await waitFor(()=>expect(posts).toEqual([{notificationIds:['announcement:a']}]));
});
