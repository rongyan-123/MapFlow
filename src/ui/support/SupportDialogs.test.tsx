import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AnnouncementsDialog,FeedbackDialog} from './SupportDialogs';
afterEach(()=>vi.unstubAllGlobals());
const wrap=({children}:{children:React.ReactNode})=><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
it('keeps a failed feedback draft editable and declares success only after the receipt',async()=>{
  const bodies:string[]=[];let fail=true;vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{bodies.push(String(options?.body));return new Response('{}',{status:fail?503:200});});
  render(<FeedbackDialog csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});fireEvent.change(screen.getByRole('textbox',{name:'反馈内容'}),{target:{value:'手机上的工具按钮挤在一起。'}});fireEvent.click(screen.getByRole('button',{name:'提交反馈'}));
  await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'反馈内容'})).toHaveValue('手机上的工具按钮挤在一起。');fail=false;
  fireEvent.click(screen.getByRole('button',{name:'提交反馈'}));await screen.findByText('反馈已提交。');expect(bodies).toHaveLength(2);
});
it('does not mark announcements read when simply browsing the list',async()=>{
  const requests:Array<RequestInit|undefined>=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{requests.push(options);return new Response(JSON.stringify({items:[{announcementId:'a',title:'新公告',content:'实际内容',createdAt:'2026-10-14T10:00:00Z',isRead:false}],unreadIds:['a']}));});
  render(<AnnouncementsDialog accountId="player" csrfToken="csrf" onClose={vi.fn()} />,{wrapper:wrap});await screen.findByText('实际内容');
  expect(requests.every(request=>request?.method!=='POST')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'标记已读'}));await waitFor(()=>expect(requests.some(request=>request?.method==='POST')).toBe(true));
});
