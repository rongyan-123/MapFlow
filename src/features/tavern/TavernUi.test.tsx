import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ErrorNotice, TavernDialog } from './TavernUi';

afterEach(cleanup);

it('locks background scroll while a configuration layer is open and restores it', () => {
  const overflow = document.body.style.overflow;
  const view = render(<TavernDialog title="模型参数" onClose={() => undefined}><input aria-label="参数" /></TavernDialog>);
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('dialog', { name: '模型参数' })).toHaveFocus();
  view.unmount();
  expect(document.body.style.overflow).toBe(overflow);
});

it('shows a safe fallback instead of an arbitrary exception message', () => {
  render(<ErrorNotice error={new Error('database_field=private host=internal.example sk-private-secret')} />);
  expect(screen.getByRole('alert')).toHaveTextContent('请求暂时失败，请稍后重试。');
  expect(screen.getByRole('alert')).not.toHaveTextContent('private');
});
