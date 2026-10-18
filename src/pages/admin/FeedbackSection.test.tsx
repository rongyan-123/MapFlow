import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FeedbackSection} from './AdminRecords';
afterEach(()=>vi.unstubAllGlobals());
it('lets the administrator open and reply to feedback without editing its original text',async()=>{
  const posts:unknown[]=[];let answered=false;const summary={feedbackId:'feedback-1',username:'用户甲',content:'手机按钮太小',createdAt:'2026-10-18T09:00:00Z',replyCount:0};
  vi.stubGlobal('fetch',async(path:string,options?:RequestInit)=>{
    if(options?.method==='POST'){posts.push(JSON.parse(String(options.body)));answered=true;return new Response(JSON.stringify({replyId:'reply-1',content:'已加大点击区域。',createdAt:'2026-10-18T10:00:00Z'}),{status:201});}
    if(path==='/api/admin/feedback/feedback-1')return new Response(JSON.stringify({...summary,replyCount:answered?1:0,replies:answered?[{replyId:'reply-1',content:'已加大点击区域。',createdAt:'2026-10-18T10:00:00Z'}]:[],nextCursor:null}));
    return new Response(JSON.stringify({items:[summary],nextCursor:null,total:1}));
  });
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><FeedbackSection accountId="admin" csrfToken="csrf" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:/查看反馈/}));fireEvent.change(await screen.findByRole('textbox',{name:'回复用户'}),{target:{value:'已加大点击区域。'}});fireEvent.click(screen.getByRole('button',{name:'发送回复'}));
  await screen.findByText('回复已发送。');expect(screen.getByText('手机按钮太小')).toBeVisible();expect(posts).toEqual([{content:'已加大点击区域。',requestId:expect.any(String)}]);
});
