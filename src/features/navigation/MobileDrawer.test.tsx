import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MobileDrawer from './MobileDrawer';

describe('MobileDrawer', () => {
  it('open 时渲染内容，按 Esc 关闭', () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer open onClose={onClose}>
        <button type="button">抽屉条目</button>
      </MobileDrawer>,
    );
    expect(screen.getByRole('dialog', { name: '功能菜单' })).toBeInTheDocument();
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
