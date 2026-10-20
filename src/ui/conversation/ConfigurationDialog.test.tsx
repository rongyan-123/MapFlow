import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ConfigurationDialog } from './ConfigurationDialog';

it('uses the wheel to reveal overflowing horizontal options without taking over vertical navigation', () => {
  render(<ConfigurationDialog onClose={vi.fn()} content={{ overview: '角色', model: '模型', tools: '工具', profile: '设定', branches: '分支' }} />);
  const navigation = screen.getByRole('navigation');
  Object.defineProperties(navigation, { clientWidth: { value: 320, configurable: true }, scrollWidth: { value: 700, configurable: true } });
  const wheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
  fireEvent(navigation, wheel);
  expect(navigation.scrollLeft).toBe(120);
  expect(wheel.defaultPrevented).toBe(true);

  Object.defineProperty(navigation, 'scrollWidth', { value: 320 });
  navigation.scrollLeft = 0;
  const verticalWheel = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
  fireEvent(navigation, verticalWheel);
  expect(navigation.scrollLeft).toBe(0);
  expect(verticalWheel.defaultPrevented).toBe(false);
});
