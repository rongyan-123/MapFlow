import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import RequestsSection from './RequestsSection';
import {detail,summary} from '../../test/requestObservationFixtures';
const api=vi.hoisted(()=>({fetchAdminRequestObservations:vi.fn(),fetchAdminRequestObservation:vi.fn()}));
vi.mock('../../api/adminClient',()=>api);
beforeEach(()=>{vi.clearAllMocks();api.fetchAdminRequestObservations.mockResolvedValue({items:[summary()],total:1,delivery:{queueDroppedSinceStart:2,writeFailedSinceStart:1,queued:3,capacity:256,persistedSinceStart:120}});api.fetchAdminRequestObservation.mockResolvedValue(detail());});
function open(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RequestsSection accountId="admin" csrfToken="csrf" /></QueryClientProvider>);}
it('opens the saved lifecycle and keeps server evidence, technical details and operations',async()=>{
  open();const button=(await screen.findAllByRole('button',{name:`查看请求 ${summary().requestId}`}))[0];fireEvent.click(button);
  const dialog=await screen.findByRole('dialog',{name:'请求生命周期详情'});await within(dialog).findByText(detail().summary);
  expect(within(dialog).getByRole('list',{name:'请求生命周期'}).children).toHaveLength(detail().stages.length);
  const technical=within(dialog).getAllByText('原始技术数据');expect(technical).toHaveLength(detail().stages.length);
  expect(dialog).toHaveTextContent('invitation.claim_rate_limited');expect(dialog).toHaveTextContent('实际测量');
});
it('applies supported filters and refreshes only the reader endpoint',async()=>{
  open();await screen.findAllByText(summary().summary);fireEvent.change(screen.getByRole('combobox',{name:'请求结果'}),{target:{value:'failed'}});fireEvent.change(screen.getByLabelText('请求 ID'),{target:{value:' request-123 '}});fireEvent.click(screen.getByRole('button',{name:'应用筛选'}));
  await waitFor(()=>expect(api.fetchAdminRequestObservations).toHaveBeenLastCalledWith('csrf',{outcome:'failed',requestId:'request-123',limit:50,offset:0}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'刷新'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'刷新'}));await waitFor(()=>expect(api.fetchAdminRequestObservations.mock.calls.length).toBeGreaterThan(2));
});
