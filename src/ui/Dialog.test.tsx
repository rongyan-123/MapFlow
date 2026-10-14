import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

it('keeps a settings form mounted when focus cycles inside the dialog', () => {
  render(<Dialog title="会话配置" onClose={vi.fn()}><input aria-label="草稿" /><button>保存</button></Dialog>);
  const field = screen.getByRole('textbox', { name: '草稿' });
  fireEvent.change(field, { target: { value: '尚未发送的内容' } });
  screen.getByRole('button', { name: '保存' }).focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
  expect(field).toHaveValue('尚未发送的内容');
});

it('returns focus to the opener when the dialog is removed', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const view = render(<Dialog title="设置" onClose={vi.fn()}><p>设置内容</p></Dialog>);
  expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
  view.unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});

it('does not dismiss a pending operation with Escape or a backdrop click', () => {
  const close = vi.fn();
  render(<Dialog title="正在保存" dismissible={false} onClose={close}>正在保存</Dialog>);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
  expect(close).not.toHaveBeenCalled();
});

it('calls the supplied close action for Escape', () => {
  const close = vi.fn();
  render(<Dialog title="地图预览" onClose={close}>地图</Dialog>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
