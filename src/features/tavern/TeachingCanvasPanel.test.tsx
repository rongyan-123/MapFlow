import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TeachingCanvasPanel from './TeachingCanvasPanel';

const editor = vi.hoisted(() => ({ props: {} as Record<string, (...arguments_: unknown[]) => void> }));
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: (props: typeof editor.props) => { editor.props = props; return null; },
  convertToExcalidrawElements: (elements: unknown) => elements,
  restoreElements: (elements: unknown) => elements,
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

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
