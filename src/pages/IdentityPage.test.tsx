import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider } from '../domains/identity/IdentityContext';
import IdentityPage from './IdentityPage';

afterEach(() => vi.unstubAllGlobals());

function show(mode: 'login' | 'register' = 'login', onAuthenticated = vi.fn()) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><IdentityProvider><IdentityPage mode={mode} navigate={vi.fn()} onAuthenticated={onAuthenticated} /></IdentityProvider></QueryClientProvider>);
  return onAuthenticated;
}

it('keeps sign in usable without querying protected application capabilities', async () => {
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (path: string) => { requests.push(path); return new Response('{}', {status:401}); });
  show();
  await screen.findByLabelText('用户名');
  expect(screen.getByRole('button', {name:'登录'})).toBeEnabled();
  expect(requests).not.toContain('/api/capabilities');
  expect(requests).not.toContain('/api/auth/registration-challenge');
});

it('shows a rejected sign in and leaves the user on the form', async () => {
  vi.stubGlobal('fetch', async (path: string) => new Response(JSON.stringify(path==='/api/auth/login'
    ? {error:{code:'identity.authentication_rejected',message:'server diagnostic'}} : {}), {status:401}));
  const authenticated = show();
  await userEvent.type(screen.getByLabelText('用户名'),'learner');
  await userEvent.type(screen.getByLabelText('密码'),'Example!456');
  await userEvent.click(screen.getByRole('button',{name:'登录'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('用户名、密码或会话无效');
  expect(authenticated).not.toHaveBeenCalled();
});

it('submits the server registration question and refreshes it after a rejection', async () => {
  let questions = 0;
  let submitted: Record<string,unknown> | undefined;
  vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
    if(path==='/api/auth/registration-challenge') return new Response(JSON.stringify({challengeId:++questions===1?'question-1':'question-2',question:questions===1?'7 + 5 = ?':'9 - 4 = ?',expiresInSeconds:300}));
    if(path==='/api/auth/register') { submitted=JSON.parse(String(init?.body)); return new Response(JSON.stringify({error:{code:'identity.registration_challenge_rejected',message:'rejected'}}),{status:400}); }
    return new Response('{}',{status:401});
  });
  show('register');
  await screen.findByText('7 + 5 = ?');
  expect(screen.queryByLabelText('邀请码')).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('用户名'),'NewLearner');
  await userEvent.type(screen.getByLabelText('设置密码'),'Secure!River987');
  await userEvent.type(screen.getByLabelText('确认密码'),'Secure!River987');
  await userEvent.type(screen.getByLabelText('邮箱（可选）'),'learner@example.test');
  await userEvent.type(screen.getByLabelText('计算结果'),'12');
  await userEvent.click(screen.getByRole('button',{name:'创建并激活账号'}));
  await waitFor(()=>expect(submitted).toMatchObject({username:'NewLearner',challengeId:'question-1',challengeAnswer:'12',email:'learner@example.test'}));
  await screen.findByText('9 - 4 = ?');
  expect(screen.getByLabelText('用户名')).toHaveValue('NewLearner');
  expect(screen.getByLabelText('计算结果')).toHaveValue('');
});
