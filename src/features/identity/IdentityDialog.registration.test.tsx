import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import IdentityDialog from './IdentityDialog';

afterEach(() => vi.unstubAllGlobals());

it('offers direct registration with a server arithmetic question and no invitation field', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    challengeId: '7e6948eb-29f3-496d-8e4a-9d471d2a0ab6', question: '7 + 5 = ?', expiresInSeconds: 300,
  }), { status: 200, headers: { 'content-type': 'application/json' } })));
  render(<IdentityDialog pending={false} requestError={null} onClose={vi.fn()} onResetError={vi.fn()}
    onLogin={vi.fn()} onRegister={vi.fn()} onClaimInvitation={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '注册激活' }));
  expect(await screen.findByText('7 + 5 = ?')).toBeInTheDocument();
  expect(screen.queryByLabelText('邀请码')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '点击领取邀请码' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('计算结果')).toBeInTheDocument();
});

it('submits the answer directly and refreshes a consumed question after rejection', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    challengeId: fetchMock.mock.calls.length === 1 ? 'first-question' : 'second-question',
    question: fetchMock.mock.calls.length === 1 ? '7 + 5 = ?' : '9 - 4 = ?', expiresInSeconds: 300,
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const onRegister = vi.fn().mockRejectedValue(new Error('question rejected'));
  const onClaimInvitation = vi.fn();
  render(<IdentityDialog pending={false} requestError={null} onClose={vi.fn()} onResetError={vi.fn()}
    onLogin={vi.fn()} onRegister={onRegister} onClaimInvitation={onClaimInvitation} />);
  await userEvent.click(screen.getByRole('button', { name: '注册激活' }));
  await screen.findByText('7 + 5 = ?');
  await userEvent.type(screen.getByLabelText('用户名'), 'NewLearner');
  await userEvent.type(screen.getByLabelText('设置密码'), 'Secure!River987');
  await userEvent.type(screen.getByLabelText('确认密码'), 'Secure!River987');
  await userEvent.type(screen.getByLabelText('邮箱（可选）'), 'user@example.test');
  await userEvent.type(screen.getByLabelText('计算结果'), '12');
  await userEvent.click(screen.getByRole('button', { name: '创建并激活账号' }));
  await waitFor(() => expect(onRegister).toHaveBeenCalledWith({
    username: 'NewLearner', password: 'Secure!River987', email: 'user@example.test',
    challengeId: 'first-question', challengeAnswer: '12',
  }));
  await screen.findByText('9 - 4 = ?');
  expect(screen.getByLabelText('计算结果')).toHaveValue('');
  expect(screen.getByLabelText('用户名')).toHaveValue('NewLearner');
  expect(onClaimInvitation).not.toHaveBeenCalled();
});
