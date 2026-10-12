import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MobileDrawer from './MobileDrawer';

describe('MobileDrawer', () => {
  it('打开时锁定背景并限制焦点，关闭后恢复触发器与滚动', async () => {
    const user = userEvent.setup();
    const content = (open: boolean) => <><button type="button">菜单触发器</button>
      <MobileDrawer open={open} onClose={() => undefined}>
        <button type="button">第一个条目</button><button type="button">最后一个条目</button>
      </MobileDrawer></>;
    const originalOverflow = document.body.style.overflow;
    const view = render(content(false));
    screen.getByRole('button', { name: '菜单触发器' }).focus();
    view.rerender(content(true));
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: '第一个条目' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: '最后一个条目' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '第一个条目' })).toHaveFocus();
    view.rerender(content(false));
    expect(screen.getByRole('button', { name: '菜单触发器' })).toHaveFocus();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });
  it('open 时渲染内容，按 Esc 关闭', () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer open onClose={onClose}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );
    const dialog = screen.getByRole('dialog', { name: '功能菜单' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('overflow-y-auto');
    expect(screen.getByRole('button', { name: '抽屉条目' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩关闭', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MobileDrawer open onClose={onClose}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );

    await user.click(screen.getByTestId('mobile-drawer-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close 时不渲染内容', () => {
    render(
      <MobileDrawer open={false} onClose={() => undefined}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
