import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ResizeHandle from './ResizeHandle';

afterEach(()=>{localStorage.clear();vi.unstubAllGlobals();});

it('restores the learners chosen width after temporarily making room for history',()=>{
  let available=1200;let notifyResize!:()=>void;
  vi.stubGlobal('ResizeObserver',class{constructor(notify:()=>void){notifyResize=notify;}observe(){}disconnect(){}});
  const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return new DOMRect(0,0,this.dataset.layout?available:Number.parseFloat(this.style.getPropertyValue('--panel-width'))||800,800);});
  const key='mapflow.layout.canvas.width-regression.map';localStorage.setItem(key,'830');
  const view=render(<div data-layout="true"><div data-testid="map-panel"/><ResizeHandle label="调整地图与聊天宽度" storageKey={key} remainingWidth={320}/></div>);
  const map=screen.getByTestId('map-panel');
  expect(map.style.getPropertyValue('--panel-width')).toBe('830px');
  available=1000;notifyResize();expect(map.style.getPropertyValue('--panel-width')).toBe('680px');
  expect(localStorage.getItem(key)).toBe('830');
  available=1200;notifyResize();expect(map.style.getPropertyValue('--panel-width')).toBe('830px');
  fireEvent.doubleClick(screen.getByRole('separator'));
  available=1000;notifyResize();expect(map.style.getPropertyValue('--panel-width')).toBe('');
  expect(localStorage.getItem(key)).toBeNull();
  view.unmount();bounds.mockRestore();
});
