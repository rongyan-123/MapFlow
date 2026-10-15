import './brand-art.css';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`mf-brand-symbol ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 27.5 28.5 9v30.5L7 58V27.5Z" fill="currentColor" opacity=".78" />
      <path d="m28.5 39.5 25-21.5v31.5L38 42.4c-4.6 3.9-9.5 2.3-9.5-2.9Z" fill="currentColor" opacity=".48" />
      <path d="m28.5 39.5 10.7-9.2 14.3 19.2L38 42.4c-4.6 3.9-9.5 2.3-9.5-2.9Z" fill="currentColor" />
      <path d="M28.5 9v30.5L7 58" stroke="currentColor" strokeWidth=".7" strokeLinejoin="round" opacity=".3" />
    </svg>
  );
}
