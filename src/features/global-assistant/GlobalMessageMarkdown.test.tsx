import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import GlobalMessageMarkdown from './GlobalMessageMarkdown';

it('opens genuine site routes only when clicked and keeps external or unsafe links scoped',()=>{
  const navigate=vi.fn();
  render(<GlobalMessageMarkdown navigate={navigate} markdown={'[进入学习](/learning?area=owned) [我的地图](/maps?entry=owned) [外部资料](https://example.com) [内部接口](/api/admin/delete) [跨站](//evil.example) ![追踪](https://evil.example/pixel.png)'} />);
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link',{name:'进入学习'}));expect(navigate).toHaveBeenCalledWith('/learning?area=owned');
  expect(screen.getByRole('link',{name:'外部资料'})).toHaveAttribute('rel','noopener noreferrer');
  expect(screen.queryByRole('link',{name:'内部接口'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'跨站'})).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
