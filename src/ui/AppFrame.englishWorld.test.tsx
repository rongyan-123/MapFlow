import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppFrame } from './AppFrame';

it('keeps the first four mobile destinations and reaches English World through More', () => {
  const navigate = vi.fn();
  const items = ['assistant', 'library', 'maps', 'learning', 'tavern', 'english-world'].map((page, index) => ({ href: '/' + page, label: ['助手', '书库', '地图', '学习', '独立酒馆', '英语世界'][index], icon: 'book' as const, active: page === 'english-world' }));
  render(<AppFrame items={items} tools={[]} accountName="玩家" navigate={navigate} onAccount={vi.fn()} onTheme={vi.fn()} onHelp={vi.fn()} onMarketing={vi.fn()}><p>英语世界</p></AppFrame>);
  const mobile = within(screen.getByRole('navigation', { name: '手机主导航' }));
  expect(mobile.getAllByRole('link')).toHaveLength(4);
  const more = mobile.getByRole('button', { name: '更多' });
  expect(more).toHaveAttribute('aria-current', 'page');
  fireEvent.click(more);
  const drawer = screen.getByRole('dialog');
  const englishWorld = within(drawer).getByRole('link', { name: '英语世界' });
  expect(englishWorld).toHaveAttribute('aria-current', 'page');
  expect(within(drawer).getByRole('link', { name: '独立酒馆' })).toBeVisible();
  fireEvent.click(englishWorld);
  expect(navigate).toHaveBeenCalledWith('/english-world');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
