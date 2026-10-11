import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import ManagementMapGeneration from './ManagementMapGeneration';

const input={topic:'Rust',role:'开发者',goalDescription:'独立开发工具',learnerContextSummary:'会 Python'};
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear();});
it('opens the real generation form only after reviewing an owned prepared requirement', async()=>{
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
    calls.push(url);
    return new Response(JSON.stringify(url.includes('map-generation-draft')?{draft:{draftId:'draft-1',input}}:{models:[]}));
  }));
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ManagementMapGeneration accountId="account-1" conversationId="conversation-1" csrfToken="csrf"
    capabilities={{enabled:true,platformFundedEnabled:false,models:['deepseek-v4-flash'],thinkingModes:['disabled'],reasoningEfforts:['low']}} credit={null} onComplete={vi.fn()}/></QueryClientProvider>);
  await screen.findByText('Rust');
  expect(screen.queryByRole('textbox',{name:'想学习什么知识？'})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'核对需求并生成地图'}));
  expect(await screen.findByRole('textbox',{name:'想学习什么知识？'})).toHaveValue('Rust');
  expect(screen.getByRole('textbox',{name:'希望最终达到什么目标？'})).toHaveValue(input.goalDescription);
  expect(calls.some(url=>url.includes('/tree-generations')||url.includes('/platform-tree-generations'))).toBe(false);
});
