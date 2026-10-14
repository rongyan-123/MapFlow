import { render,screen,fireEvent } from '@testing-library/react';
import { beforeEach,expect,it } from 'vitest';
import { useTheme } from './useTheme';
function Control(){const {theme,setTheme}=useTheme();return <select aria-label="主题" value={theme} onChange={event=>setTheme(event.target.value)}><option value="light">浅色</option><option value="dark">深色</option><option value="ivory">米色</option><option value="blue-gray">蓝灰</option></select>;}
beforeEach(()=>localStorage.clear());
it('restores an existing theme and writes a changed theme using the existing key',()=>{
  localStorage.setItem('mapflow.theme','ivory'); render(<Control />);
  expect(screen.getByLabelText('主题')).toHaveValue('ivory');
  fireEvent.change(screen.getByLabelText('主题'),{target:{value:'dark'}});
  expect(localStorage.getItem('mapflow.theme')).toBe('dark');
  expect(document.documentElement.dataset.mapflowTheme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
});
it('uses the new light presentation when no valid stored theme exists',()=>{
  localStorage.setItem('mapflow.theme','broken');render(<Control />);
  expect(screen.getByLabelText('主题')).toHaveValue('light');
  expect(document.documentElement.style.colorScheme).toBe('light');
});
it('keeps the settings picker and shell toggle on the same theme',()=>{
  function Shell(){const {theme,setTheme}=useTheme();return <button onClick={()=>setTheme(theme==='dark'?'light':'dark')}>外壳主题 {theme}</button>;}
  render(<><Shell /><Control /></>);fireEvent.change(screen.getByLabelText('主题'),{target:{value:'dark'}});
  expect(screen.getByRole('button')).toHaveTextContent('外壳主题 dark');fireEvent.click(screen.getByRole('button'));
  expect(screen.getByLabelText('主题')).toHaveValue('light');expect(document.documentElement.dataset.mapflowTheme).toBe('light');
});
