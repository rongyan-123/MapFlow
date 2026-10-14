import type { SVGProps } from 'react';

const paths = {
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM7 9h9M7 13h6',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15',
  book: 'M12 5C9 2 4 3 3 4v15c3-2 6-1 9 1 3-2 6-3 9-1V4c-3-2-6-1-9 1ZM12 5v15',
  learn: 'm2 8 10-5 10 5-10 5L2 8ZM6 10v6c4 4 8 4 12 0v-6M22 8v8',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  plus: 'M12 4v16M4 12h16',
  arrow: 'M12 19V5m-6 6 6-6 6 6',
  right: 'M5 12h14m-5-5 5 5-5 5',
  down: 'm6 9 6 6 6-6',
  back: 'M19 12H5m5-5-5 5 5 5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Zm-1 5.5 5 5',
  settings: 'M4 6h16M4 12h16M4 18h16M7 4v4m8 2v4m-7 2v4',
  wallet: 'M6 5h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM16 10h5v6h-5v-6Z',
  moon: 'M20.5 13.1A8.5 8.5 0 0 1 10.9 3.5a8.5 8.5 0 1 0 9.6 9.6Z',
  shield: 'm12 3 8 3v7c0 4-5 7-8 8-3-1-8-4-8-8V6l8-3Zm-4 9 3 3 5-6',
  home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16',
  check: 'm5 12 4 4L19 6',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  stop: 'M6 6h12v12H6V6Z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  edit: 'm15 4 5 5M4 20l2-7L17 2l5 5-11 11-7 2Z',
  copy: 'M9 8h12v13H9V8ZM3 16V3h12',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = '', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" className={`mf-icon ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
