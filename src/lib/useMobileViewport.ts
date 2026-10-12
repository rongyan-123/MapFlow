import { useLayoutEffect, useRef } from 'react';

/** Follow the keyboard-visible area without rerendering chat or the map. */
export default function useMobileViewport(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!enabled || !element) return;
    const viewport = window.visualViewport;
    const update = () => {
      element.style.setProperty('--mobile-viewport-height', `${viewport && viewport.height > 0 ? viewport.height : window.innerHeight}px`);
      element.style.setProperty('--mobile-viewport-top', `${Math.max(0, viewport?.offsetTop ?? 0)}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      element.style.removeProperty('--mobile-viewport-height');
      element.style.removeProperty('--mobile-viewport-top');
    };
  }, [enabled]);
  return root;
}
