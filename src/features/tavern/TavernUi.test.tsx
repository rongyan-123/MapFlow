import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ErrorNotice } from './TavernUi';

afterEach(cleanup);

it('shows a safe fallback instead of an arbitrary exception message', () => {
  render(<ErrorNotice error={new Error('database_field=private host=internal.example sk-private-secret')} />);
  expect(screen.getByRole('alert')).toHaveTextContent('请求暂时失败，请稍后重试。');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private');
});
