import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

const originalTransition = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
const originalAnimate = Object.getOwnPropertyDescriptor(document.documentElement, 'animate');
const finishTransitions: Array<() => void> = [];
beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.mapflowTheme = 'light';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  finishTransitions.splice(0).forEach(finish => finish());
  if (originalTransition) Object.defineProperty(document, 'startViewTransition', originalTransition);
  else Reflect.deleteProperty(document, 'startViewTransition');
  if (originalAnimate) Object.defineProperty(document.documentElement, 'animate', originalAnimate);
  else Reflect.deleteProperty(document.documentElement, 'animate');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  return <button onClick={event => setTheme(theme === 'light' ? 'dark' : 'light', event.currentTarget)}>主题 {theme}</button>;
}
function nativeMotion() {
  const animate = vi.fn((_keyframes: PropertyIndexedKeyframes, _options: KeyframeAnimationOptions) => ({ cancel: vi.fn(), finished: Promise.resolve() }));
  const transitions: Array<{ skipTransition: ReturnType<typeof vi.fn> }> = [];
  const start = vi.fn((update: () => void) => {
    const ready = Promise.resolve().then(update);
    const finished = new Promise<void>(resolve => finishTransitions.push(resolve));
    const transition = { ready, finished, updateCallbackDone: ready, skipTransition: vi.fn() };
    transitions.push(transition);
    return transition;
  });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  Object.defineProperty(document.documentElement, 'animate', { configurable: true, value: animate });
  return { start, animate, transitions };
}

it('shrinks the old theme into the clicked control instead of replacing the screen immediately', async () => {
  const { start, animate } = nativeMotion();
  render(<ThemeButton />);
  const button = screen.getByRole('button');
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ x: 50, y: 30, left: 50, top: 30, width: 40, height: 40, right: 90, bottom: 70, toJSON: () => ({}) });
  fireEvent.click(button);
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  expect(animate.mock.calls[0][0]).toMatchObject({ clipPath: [expect.stringMatching(/^circle\(.+ at 70px 50px\)$/), 'circle(0px at 70px 50px)'] });
  expect(animate.mock.calls[0][1]).toMatchObject({ duration: 600, pseudoElement: '::view-transition-old(root)' });
  expect(document.documentElement.dataset.mapflowTheme).toBe('dark');
  expect(localStorage.getItem('mapflow.theme')).toBe('dark');
});

it('cancels an uncommitted change when a second explicit choice returns to the original theme', async () => {
  const { transitions } = nativeMotion();
  function Picker() {
    const { theme, setTheme } = useTheme();
    return <select aria-label="主题" value={theme} onChange={event => setTheme(event.target.value, event.currentTarget)}><option value="light">米色</option><option value="dark">暗色</option></select>;
  }
  render(<Picker />);
  fireEvent.change(screen.getByLabelText('主题'), { target: { value: 'dark' } });
  fireEvent.change(screen.getByLabelText('主题'), { target: { value: 'light' } });
  await act(async () => {});
  expect(document.documentElement.dataset.mapflowTheme).toBe('light');
  expect(transitions[0].skipTransition).toHaveBeenCalled();
});

it('handles two quick toggle clicks against the latest requested theme', async () => {
  const { start } = nativeMotion();
  function Toggle() {
    const { theme, setTheme } = useTheme();
    return <button onClick={event => setTheme(current => current === 'dark' ? 'light' : 'dark', event.currentTarget)}>切换 {theme}</button>;
  }
  render(<Toggle />);
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByRole('button'));
  await act(async () => {});
  expect(start).toHaveBeenCalledTimes(2);
  expect(document.documentElement.dataset.mapflowTheme).toBe('light');
  expect(localStorage.getItem('mapflow.theme')).toBe('light');
});

it('respects reduced-motion preferences and changes the theme without a snapshot animation', () => {
  const { start, animate } = nativeMotion();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole('button'));
  expect(start).not.toHaveBeenCalled();
  expect(animate).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.mapflowTheme).toBe('dark');
});

it('lets a newer cross-tab preference cancel an older pending local animation', async () => {
  const { transitions } = nativeMotion();
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole('button'));
  fireEvent(window, new StorageEvent('storage', { key: 'mapflow.theme', newValue: 'ivory' }));
  await act(async () => {});
  expect(document.documentElement.dataset.mapflowTheme).toBe('light');
  expect(transitions[0].skipTransition).toHaveBeenCalled();
});

it('still applies the selected theme when the native snapshot API throws', () => {
  const { start } = nativeMotion();
  start.mockImplementation(() => { throw new Error('Snapshot unavailable'); });
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole('button'));
  expect(document.documentElement.dataset.mapflowTheme).toBe('dark');
  expect(localStorage.getItem('mapflow.theme')).toBe('dark');
});

it('releases the completed snapshot animation so later switches cannot retain old overlays', async () => {
  const { animate } = nativeMotion();
  render(<ThemeButton />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  await act(async () => finishTransitions[0]());
  expect(animate.mock.results[0].value.cancel).toHaveBeenCalled();
  expect(document.documentElement.dataset.mapflowThemeTransition).toBeUndefined();
});
