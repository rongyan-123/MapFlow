import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import GlobalMessageBody from './GlobalMessageBody';

const binding={conversationId:'11111111-1111-4111-8111-111111111111',bindingVersion:1};
const message={messageId:'22222222-2222-4222-8222-222222222222',parentMessageId:null,role:'assistant' as const,origin:'model' as const,characterId:null,content:'😀前',bodyRef:{totalChars:6,nextOffset:2}};
afterEach(()=>vi.unstubAllGlobals());
it('expands every page of a long message without silently truncating or splitting Unicode offsets',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...binding,messageId:message.messageId,content:'中间',offset:2,nextOffset:4,totalChars:6})))
    .mockResolvedValueOnce(new Response(JSON.stringify({...binding,messageId:message.messageId,content:'结尾',offset:4,nextOffset:null,totalChars:6})));
  vi.stubGlobal('fetch',fetch);
  render(<GlobalMessageBody message={message} binding={binding} navigate={vi.fn()} />);
  expect(screen.getByText('正文已加载 2 / 6 字')).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'展开后续正文'}));
  expect(await screen.findByText('😀前中间')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'展开后续正文'}));
  expect(await screen.findByText('😀前中间结尾')).toBeVisible();
  expect(screen.queryByRole('button',{name:'展开后续正文'})).not.toBeInTheDocument();
  expect(fetch.mock.calls.map(([path])=>path)).toEqual([`/api/me/global-assistant/messages/${message.messageId}/body?offset=2&limit=8192`,`/api/me/global-assistant/messages/${message.messageId}/body?offset=4&limit=8192`]);
});
it('keeps the visible prefix on failure and ignores a body response from a replaced message binding',async()=>{
  let finish:(response:Response)=>void=()=>{};
  const fetch=vi.fn().mockRejectedValueOnce(new Error('private upstream diagnostic')).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
  const view=render(<GlobalMessageBody message={message} binding={binding} navigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'展开后续正文'}));
  await screen.findByRole('alert');expect(screen.getByText('😀前')).toBeVisible();expect(screen.queryByText('private upstream diagnostic')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'展开后续正文'}));
  view.rerender(<GlobalMessageBody message={{...message,content:'新绑定',bodyRef:undefined}} binding={{...binding,bindingVersion:2}} navigate={vi.fn()} />);
  await act(async()=>{finish(new Response(JSON.stringify({...binding,messageId:message.messageId,content:'旧后缀',offset:2,nextOffset:5,totalChars:6})));});
  expect(screen.getByText('新绑定')).toBeVisible();expect(screen.queryByText(/旧后缀/)).not.toBeInTheDocument();
});
