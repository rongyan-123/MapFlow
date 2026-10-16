import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ExecutionRecovery} from './ExecutionRecovery';
afterEach(()=>vi.unstubAllGlobals());
it('never asks a cash user for a BYOK key when an old server reports a missing platform credential',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'route.not_found'}}),{status:404})));
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <ExecutionRecovery accountId="owner" conversationId="11111111-1111-4111-8111-111111111111" executionId="22222222-2222-4222-8222-222222222222"
      funding="cash" state="awaiting_reconciliation" legacyErrorCode="credential_required" onCheck={vi.fn()} onResume={vi.fn()} onStop={vi.fn()} />
  </QueryClientProvider>);
  await expect(screen.findByRole('button',{name:'补充 API Key'})).rejects.toThrow();
  expect(screen.getByRole('button',{name:'核对原请求'})).toBeVisible();
});
