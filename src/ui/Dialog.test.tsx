import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

it('opens a contextual card without blocking or dimming the workspace',()=>{
 const background=document.createElement('button'); background.textContent='页面按钮'; document.body.append(background);background.focus();
 const view=render(<Dialog title="设置" onClose={vi.fn()}>内容</Dialog>);
 expect(screen.getByRole('dialog',{name:'设置'})).not.toHaveAttribute('aria-modal','true');
 expect(background.inert).not.toBe(true);
 expect(document.body.style.overflow).not.toBe('hidden');
 view.unmount();background.remove();
});

it('does not create an exit copy during StrictMode setup or unset a selected radio',async()=>{
  const animate=vi.fn(()=>({cancel:vi.fn(),finished:new Promise<void>(()=>{})}));
  Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
  try{
    const view=render(<StrictMode><Dialog title="资金方式" onClose={()=>{}}><label>余额<input name="funding" type="radio" checked readOnly /></label></Dialog></StrictMode>);
    await act(async()=>{});
    expect(document.querySelector('.mf-floating-exit')).toBeNull();
    expect(screen.getByRole('radio',{name:'余额'})).toBeChecked();
    view.unmount();
    await act(async()=>{});
    const ghost=document.querySelector('.mf-floating-exit');
    expect(ghost).not.toBeNull();
    expect(ghost?.querySelector('[name="funding"]')).toBeNull();
  }finally{delete (HTMLElement.prototype as {animate?:unknown}).animate;document.querySelectorAll('.mf-floating-exit').forEach(element=>element.remove());}
});
