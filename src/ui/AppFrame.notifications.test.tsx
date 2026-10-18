import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {AppFrame} from './AppFrame';
import {PageHeader} from './PageHeader';
it('exposes the unread message bell near the account and in the mobile header',()=>{
  const open=vi.fn();render(<AppFrame items={[]} tools={[]} accountName="用户" navigate={vi.fn()} onAccount={vi.fn()} onTheme={vi.fn()} onHelp={vi.fn()} onMarketing={vi.fn()} onNotifications={open} unreadCount={2}><PageHeader title="学习聊天" /></AppFrame>);
  const bells=screen.getAllByRole('button',{name:'消息，2 条未读'});expect(bells.length).toBeGreaterThanOrEqual(1);fireEvent.click(bells[0]);expect(open).toHaveBeenCalledTimes(1);
});
