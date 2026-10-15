import { render,screen,fireEvent } from '@testing-library/react';
import { beforeEach,expect,it,vi } from 'vitest';
import { THEME_OPTIONS,useTheme } from './useTheme';
function Control(){const {theme,setTheme}=useTheme();return <select aria-label="主题" value={theme} onChange={event=>setTheme(event.target.value)}>{THEME_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>;}
beforeEach(()=>localStorage.clear());
it('restores an existing theme and writes a changed theme using the existing key',()=>{
  localStorage.setItem('mapflow.theme','light'); render(<Control />);
  expect(screen.getByLabelText('主题')).toHaveValue('light');
  fireEvent.change(screen.getByLabelText('主题'),{target:{value:'dark'}});
  expect(localStorage.getItem('mapflow.theme')).toBe('dark');
  expect(document.documentElement.dataset.mapflowTheme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
});
it.each([['ivory','light'],['blue-gray','dark']] as const)('keeps the appearance of legacy %s preferences using canonical %s', (legacy,canonical)=>{
  localStorage.setItem('mapflow.theme',legacy);render(<Control />);
  expect(screen.getByLabelText('主题')).toHaveValue(canonical);
  expect(document.documentElement.dataset.mapflowTheme).toBe(canonical);
  expect(localStorage.getItem('mapflow.theme')).toBe(canonical);
});
it('normalizes legacy preferences received from another tab for every mounted picker',()=>{
  render(<><Control /><Control /></>);
  fireEvent(window,new StorageEvent('storage',{key:'mapflow.theme',newValue:'blue-gray'}));
  expect(screen.getAllByLabelText('主题').every(picker=>(picker as HTMLSelectElement).value==='dark')).toBe(true);
  expect(document.documentElement.style.colorScheme).toBe('dark');
  fireEvent(window,new StorageEvent('storage',{key:'mapflow.theme',newValue:'ivory'}));
  expect(screen.getAllByLabelText('主题').every(picker=>(picker as HTMLSelectElement).value==='light')).toBe(true);
});
it('uses the matching legacy document appearance when storage cannot be read',()=>{
  document.documentElement.dataset.mapflowTheme='blue-gray';
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('Storage blocked','SecurityError');});
  render(<Control />);
  expect(screen.getByLabelText('主题')).toHaveValue('dark');
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
it('keeps browser chrome consistent when the user switches between the two themes',()=>{
  const themeColor=document.createElement('meta');themeColor.name='theme-color';themeColor.content='#f7f2eb';document.head.append(themeColor);
  try{
    render(<Control />);fireEvent.change(screen.getByLabelText('主题'),{target:{value:'dark'}});
    expect(themeColor.content).toBe('#111319');
    fireEvent.change(screen.getByLabelText('主题'),{target:{value:'light'}});
    expect(themeColor.content).toBe('#f7f2eb');
  }finally{themeColor.remove();}
});
