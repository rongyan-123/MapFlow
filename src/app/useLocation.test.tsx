import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useLocation } from './useLocation';

afterEach(() => window.history.replaceState({}, '', '/'));

function NavigationExample() {
  const { route, navigate } = useLocation();
  return <><output aria-label="页面">{route.page}</output><output aria-label="地图">{route.entryId}</output>
    <button onClick={() => navigate('/maps?entry=map-one')}>打开地图</button>
    <button onClick={() => navigate('https://outside.invalid/maps')}>外部地址</button></>;
}

it('changes the visible page and preserves the selected map when a link is followed', () => {
  window.history.replaceState({}, '', '/assistant');
  render(<NavigationExample />);
  fireEvent.click(screen.getByRole('button', { name: '打开地图' }));
  expect(screen.getByLabelText('页面')).toHaveTextContent('maps');
  expect(screen.getByLabelText('地图')).toHaveTextContent('map-one');
  expect(window.location.pathname).toBe('/maps');
});

it('restores the visible page when browser navigation emits popstate', () => {
  window.history.replaceState({}, '', '/maps?entry=map-one');
  render(<NavigationExample />);
  act(() => { window.history.replaceState({}, '', '/library'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.getByLabelText('页面')).toHaveTextContent('library');
});

it('does not put an external address into the internal application history', () => {
  window.history.replaceState({}, '', '/assistant');
  render(<NavigationExample />);
  fireEvent.click(screen.getByRole('button', { name: '外部地址' }));
  expect(screen.getByLabelText('页面')).toHaveTextContent('assistant');
  expect(window.location.pathname).toBe('/assistant');
});
