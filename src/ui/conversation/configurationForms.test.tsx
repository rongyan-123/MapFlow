import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { detail } from '../../test/conversations';
import ByokForm from './ByokForm';
import ConversationProfileForm from './ConversationProfileForm';
afterEach(()=>vi.unstubAllGlobals());
it('requires a complete user model draft and keeps the key in the supplied memory binding',()=>{
  const onChange=vi.fn();render(<ByokForm selection={{provider:'custom',apiKey:'',baseUrl:'',model:'',settings:{},historyBytes:32768}} onChange={onChange} csrfToken="csrf" />);
  fireEvent.click(screen.getByRole('button',{name:'保存配置'}));expect(screen.getByRole('alert')).toHaveTextContent('尚未填写 API Key');expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('API Key'),{target:{value:' private-key '}});fireEvent.change(screen.getByLabelText('API URL'),{target:{value:'https://example.test/v1'}});fireEvent.change(screen.getByLabelText('上游模型'),{target:{value:'real-model'}});
  fireEvent.click(screen.getByRole('button',{name:'保存配置'}));expect(onChange).toHaveBeenCalledWith(expect.objectContaining({provider:'custom',apiKey:'private-key',model:'real-model'}));
});
it('saves the conversation profile at the displayed revision without replacing a started opening',async()=>{
  const requests:RequestInit[]=[];vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{requests.push(options!);return new Response(JSON.stringify(detail));});
  const updated=vi.fn();const client=new QueryClient();render(<QueryClientProvider client={client}><ConversationProfileForm detail={detail} csrfToken="csrf" onUpdated={updated} onConflict={async()=>{}} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('用户称呼'),{target:{value:'新的称呼'}});fireEvent.change(screen.getByLabelText('学习词表（可选）'),{target:{value:'shelter — 避难所'}});fireEvent.click(screen.getByRole('button',{name:'保存会话设定'}));
  await waitFor(()=>expect(updated).toHaveBeenCalled());const submitted=JSON.parse(String(requests[0].body));expect(submitted).toMatchObject({expectedRevision:1,userName:'新的称呼',vocabulary:[{term:'shelter',meaning:'避难所'}]});expect(submitted).not.toHaveProperty('greetingIndex');expect(requests[0].headers).toMatchObject({'X-CSRF-Token':'csrf'});
});
