import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { character, conversation } from '../../test/conversations';
import { HistoryList } from './HistoryList';

it('shows newest conversations first with creation times and numbers that survive searching', () => {
  const oldest = { ...conversation, conversationId: 'old', title: '最早对话', createdAt: '2026-10-18T01:00:00Z' };
  const newest = { ...conversation, conversationId: 'new', title: '最新对话', createdAt: '2026-10-20T09:00:00Z' };
  const middle = { ...conversation, conversationId: 'middle', title: '中间对话', createdAt: '2026-10-19T03:00:00Z' };
  render(<HistoryList items={[oldest, newest, middle]} characters={[character]} current="new" onSelect={vi.fn()} onDelete={vi.fn()} onNew={vi.fn()} />);

  const rows = screen.getAllByRole('listitem');
  expect(rows.map(row => within(row).getByRole('button', { name: /^(最早|最新|中间)对话/ }).querySelector('strong')?.textContent)).toEqual(['最新对话', '中间对话', '最早对话']);
  expect(within(rows[0]).getByText('第 3 段')).toBeVisible();
  expect(within(rows[0]).getByText('当前')).toBeVisible();
  expect(rows.map(row => row.querySelector('time')?.getAttribute('datetime'))).toEqual([newest.createdAt, middle.createdAt, oldest.createdAt]);
  expect(rows[0].querySelector('time')?.textContent).toMatch(/10\/20.*\d{2}:\d{2}/);

  fireEvent.change(screen.getByRole('textbox', { name: '搜索会话' }), { target: { value: '最新' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('第 3 段')).toBeVisible();
});
