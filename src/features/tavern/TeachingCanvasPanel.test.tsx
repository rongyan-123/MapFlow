import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TeachingCanvasPanel from './TeachingCanvasPanel';

const editor = vi.hoisted(() => ({ props: {} as Record<string, (...arguments_: unknown[]) => void> }));
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: (props: typeof editor.props) => { editor.props = props; return null; },
  convertToExcalidrawElements: (elements: unknown) => elements,
  restoreElements: (elements: unknown) => elements,
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

it('fits the saved diagram after the editor has loaded its elements and viewport', () => {
  vi.useFakeTimers();
  const elements = [{ id: 'lesson', type: 'rectangle', x: 0, y: 0, width: 900, height: 100 }];
  const onChange = vi.fn();
  render(<TeachingCanvasPanel document={{ revision: 1, enabled: true, elements }} busy={false} saving={false} wide
    onSave={async () => {}} onChange={onChange} onClose={() => {}} onWidth={() => {}} />);
  const scrollToContent = vi.fn();
  act(() => {
    editor.props.excalidrawAPI({ scrollToContent, getSceneElements: () => [] });
    vi.advanceTimersByTime(20);
  });
  expect(scrollToContent).not.toHaveBeenCalled();
  act(() => {
    editor.props.onChange(elements, { isLoading: false, width: 680, height: 800 });
    vi.advanceTimersByTime(20);
  });
  expect(scrollToContent).toHaveBeenCalledWith(elements, { fitToContent: true, animate: false });
  act(() => { editor.props.onChange(elements, { isLoading: false, width: 680, height: 800 }); vi.advanceTimersByTime(20); });
  expect(scrollToContent).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
});

it('offers an opaque shortcuts dialog with two bindings and ignores keys typed in inputs', () => {
  const tool=vi.fn();
  render(<TeachingCanvasPanel document={{revision:1,enabled:true,elements:[]}} busy={false} saving={false} wide
    onSave={async()=>{}} onChange={()=>{}} onClose={()=>{}} onWidth={()=>{}} />);
  act(()=>editor.props.excalidrawAPI({setActiveTool:tool}));
  fireEvent.click(screen.getByRole('button',{name:'快捷键'}));
  const dialog=screen.getByRole('dialog',{name:'画布快捷键'});
  expect(dialog).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'矩形：主要绑定'}));
  fireEvent.keyDown(dialog,{key:'j',code:'KeyJ'});
  expect(screen.getByRole('button',{name:'矩形：主要绑定'})).toHaveTextContent('J');
  expect(screen.getByRole('button',{name:'矩形：备用绑定'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'箭头：主要绑定'}));
  fireEvent.keyDown(dialog,{key:'j',code:'KeyJ'});
  expect(screen.getByRole('alert')).toHaveTextContent('已绑定到“矩形”');
  fireEvent.click(screen.getByRole('button',{name:'关闭画布快捷键'}));
  const canvas = document.querySelector('.teaching-canvas') || document.querySelector('section');
  expect(canvas).not.toBeNull();
  fireEvent.keyDown(canvas!,{key:'j',code:'KeyJ'});
  expect(tool).toHaveBeenCalledWith({type:'rectangle'});tool.mockClear();
  const input=document.createElement('input');document.body.append(input);input.focus();
  fireEvent.keyDown(input,{key:'j',code:'KeyJ'});expect(tool).not.toHaveBeenCalled();input.remove();
  fireEvent.click(screen.getByRole('button',{name:'快捷键'}));
  fireEvent.click(screen.getByRole('button',{name:'恢复默认绑定'}));
  expect(screen.getByRole('button',{name:'矩形：主要绑定'})).toHaveTextContent('R');
  expect(JSON.parse(localStorage.getItem('mapflow.canvas.shortcuts.v1.local')!)).toMatchObject({rectangle:['KeyR','Digit2']});
});
