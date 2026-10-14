import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {character} from '../../test/conversations';
import CharacterLibraryDialog from './CharacterLibraryDialog';
it('allows closing a read-only or pending-execution library while blocking role changes',()=>{
  const close=vi.fn();const change=vi.fn();
  render(<CharacterLibraryDialog characters={[character]} busy onClose={close} onSelect={change} onImport={change} onCreate={change} onEdit={change} onDelete={change} />);
  expect(screen.getByRole('button',{name:'关闭'})).toBeEnabled();
  for(const label of ['导入角色卡','创建角色卡','使用角色','编辑','重命名','删除角色'])expect(screen.getByRole('button',{name:label})).toBeDisabled();
  fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledOnce();expect(change).not.toHaveBeenCalled();
});
