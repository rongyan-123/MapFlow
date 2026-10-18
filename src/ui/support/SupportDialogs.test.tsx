import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AnnouncementsDialog,FeedbackDialog} from './SupportDialogs';
import {useNotificationCount} from '../../domains/support/useNotifications';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
const wrap=({children}:{children:React.ReactNode})=><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
it('lets a returning user see submitted feedback and its waiting state',async()=>{
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({items:[{feedbackId:'feedback-1',username:'用户',content:'希望手机按钮再大一些',createdAt:'2026-10-18T09:00:00Z',replyCount:0}],nextCursor:null})));
  render(<FeedbackDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});
  fireEvent.click(screen.getByRole('tab',{name:'已反馈'}));
  await screen.findByText('希望手机按钮再大一些');
  expect(screen.getByText('等待回复')).toBeVisible();
});
it('keeps a failed feedback draft editable and declares success only after the receipt',async()=>{
  const bodies:string[]=[];let fail=true;vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{if(options?.method!=='POST')return new Response(JSON.stringify({items:[],nextCursor:null}));bodies.push(String(options.body));return new Response(JSON.stringify({feedbackId:'created',username:'用户',content:'手机上的工具按钮挤在一起。',createdAt:'2026-10-18T09:00:00Z',replyCount:0}),{status:fail?503:201});});
  render(<FeedbackDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});fireEvent.change(screen.getByRole('textbox',{name:'反馈内容'}),{target:{value:'手机上的工具按钮挤在一起。'}});fireEvent.click(screen.getByRole('button',{name:'提交反馈'}));
  await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'反馈内容'})).toHaveValue('手机上的工具按钮挤在一起。');fail=false;
  fireEvent.click(screen.getByRole('button',{name:'提交反馈'}));await screen.findByText('反馈已提交。');expect(bodies).toHaveLength(2);expect(JSON.parse(bodies[0]).requestId).toEqual(expect.any(String));expect(JSON.parse(bodies[1]).requestId).toBe(JSON.parse(bodies[0]).requestId);
});
it('opens a reply inside feedback and marks only the displayed replies as read',async()=>{
  const readBodies:unknown[]=[];const summary={feedbackId:'feedback-1',username:'用户',content:'希望手机按钮再大一些',createdAt:'2026-10-18T09:00:00Z',replyCount:2};
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(options?.method==='POST'){readBodies.push(JSON.parse(String(options.body)));return new Response(null,{status:204});}if(path.startsWith('/api/me/feedback/feedback-1'))return new Response(JSON.stringify({...summary,replies:[{replyId:'reply-1',content:'这次已加大点击区域。',createdAt:'2026-10-18T10:00:00Z'}],nextCursor:'older'}));return new Response(JSON.stringify({items:[summary],nextCursor:null}));});
  render(<FeedbackDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});fireEvent.click(screen.getByRole('tab',{name:'已反馈'}));
  fireEvent.click(await screen.findByRole('button',{name:/查看反馈与 2 条回复/}));await screen.findByText('这次已加大点击区域。');
  await waitFor(()=>expect(readBodies).toEqual([{notificationIds:['feedback_reply:reply-1']}]));
  expect(screen.getByRole('button',{name:'查看更早回复'})).toBeVisible();
});
it('can reopen a long feedback thread without sending an oversized read request',async()=>{
  const sizes:number[]=[];const summary={feedbackId:'thread',username:'用户',content:'持续跟进的问题',createdAt:'2026-10-18T09:00:00Z',replyCount:21};
  const replies=Array.from({length:21},(_,index)=>({replyId:'r'+index,content:'第'+index+'条回复',createdAt:'2026-10-18T10:00:00Z'}));
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(options?.method==='POST'){const ids=JSON.parse(String(options.body)).notificationIds;sizes.push(ids.length);return new Response(null,{status:ids.length>20?400:204});}const older=path.includes('cursor=older');return new Response(JSON.stringify({...summary,replies:older?replies.slice(20):replies.slice(0,20),nextCursor:older?null:'older'}));});
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const view=()=> <QueryClientProvider client={client}><FeedbackDialog accountId="owner" csrfToken="csrf" initialFeedbackId="thread" onClose={vi.fn()} /></QueryClientProvider>;
  const first=render(view());await screen.findByText('第0条回复');fireEvent.click(screen.getByRole('button',{name:'查看更早回复'}));await screen.findByText('第20条回复');await waitFor(()=>expect(sizes.length).toBe(2));first.unmount();
  render(view());await screen.findByText('第20条回复');await waitFor(()=>expect(sizes.length).toBeGreaterThan(2));expect(sizes.every(size=>size<=20)).toBe(true);
});
it('does not mark announcements read when simply browsing the list',async()=>{
  const requests:Array<RequestInit|undefined>=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{requests.push(options);return new Response(JSON.stringify({items:[{announcementId:'a',title:'新公告',content:'实际内容',createdAt:'2026-10-14T10:00:00Z',isRead:false}],unreadIds:['a']}));});
  render(<AnnouncementsDialog accountId="player" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});await screen.findByText('实际内容');
  expect(requests.every(request=>request?.method!=='POST')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'标记已读'}));await waitFor(()=>expect(requests.some(request=>request?.method==='POST')).toBe(true));
});
it('updates the bell count after an announcement is read through the existing announcement entry',async()=>{
  let unread=true;vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(options?.method==='POST'){unread=false;return new Response(null,{status:204});}if(path.endsWith('/count'))return new Response(JSON.stringify({unreadCount:unread?1:0}));return new Response(JSON.stringify({items:[{announcementId:'a',title:'公告',content:'正文',createdAt:'2026-10-18T10:00:00Z',isRead:!unread}],unreadIds:unread?['a']:[]}));});
  function Counter(){const count=useNotificationCount('player');return <p>未读消息 {count.data}</p>;}
  render(<><Counter /><AnnouncementsDialog accountId="player" csrfToken="csrf" onClose={vi.fn()} /></>,{wrapper:wrap});await screen.findByText('未读消息 1');fireEvent.click(await screen.findByRole('button',{name:'标记已读'}));await screen.findByText('未读消息 0');
});
it('refreshes waiting feedback while the user keeps the feedback list open',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval']});let replyCount=0;
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({items:[{feedbackId:'f',username:'用户',content:'等待处理的建议',createdAt:'2026-10-18T10:00:00Z',replyCount}],nextCursor:null})));
  render(<FeedbackDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});fireEvent.click(screen.getByRole('tab',{name:'已反馈'}));await screen.findByText('等待回复');replyCount=1;
  await act(async()=>{vi.advanceTimersByTime(30_000);});await screen.findByText('已回复');
});
it('confirms a saved feedback submission even when the unread counter cannot finish loading',async()=>{
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{if(path.endsWith('/count'))return new Promise<Response>(()=>{});if(options?.method==='POST')return new Response(JSON.stringify({feedbackId:'f',username:'用户',content:'一条建议',createdAt:'2026-10-18T10:00:00Z',replyCount:0}),{status:201});return new Response(JSON.stringify({items:[],nextCursor:null}));});
  function Counter(){useNotificationCount('owner');return null;}
  render(<><Counter /><FeedbackDialog accountId="owner" csrfToken="csrf" onClose={vi.fn()} /></>,{wrapper:wrap});fireEvent.change(screen.getByRole('textbox',{name:'反馈内容'}),{target:{value:'一条建议'}});fireEvent.click(screen.getByRole('button',{name:'提交反馈'}));await screen.findByText('反馈已提交。');
});
