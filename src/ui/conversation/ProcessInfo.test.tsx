import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProcessInfo } from './ConversationMessages';

it('explains a map stream interruption and clears the ongoing message after stop',()=>{
  const events=[{type:'tool' as const,name:'map_stream_recovery',state:'started' as const}];
  const {rerender}=render(<ProcessInfo events={events} live />);
  expect(screen.getByRole('status')).toHaveTextContent('连接中断，正在重新连接并继续原地图');
  rerender(<ProcessInfo events={events} live={false} />);
  expect(screen.getByRole('status')).not.toHaveTextContent('正在');
});
