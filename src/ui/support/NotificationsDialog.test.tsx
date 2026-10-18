import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {NotificationsDialog} from './NotificationsDialog';
afterEach(()=>vi.unstubAllGlobals());
it('keeps messages unread while browsing and reads an announcement only after opening its content',async()=>{
  const posts:unknown[]=[];vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){posts.push(JSON.parse(String(options.body)));return new Response(null,{status:204});}
    if(path.includes('/notifications/announcement'))return new Response(JSON.stringify({notificationId:'announcement:a',title:'新公告',content:'完整公告正文'}));
    return new Response(JSON.stringify({items:[{notificationId:'announcement:a',kind:'announcement',title:'新公告',preview:'公告预览',createdAt:'2026-10-18T09:00:00Z',isRead:false,targetId:'a'}],nextCursor:null}));
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><NotificationsDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} onFeedback={vi.fn()} /></QueryClientProvider>);
  const open=await screen.findByRole('button',{name:'查看公告：新公告'});expect(posts).toEqual([]);fireEvent.click(open);await screen.findByText('完整公告正文');await waitFor(()=>expect(posts).toEqual([{notificationIds:['announcement:a']}]));
});
