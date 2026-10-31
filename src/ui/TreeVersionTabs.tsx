import { Button } from './Button';

export function TreeVersionTabs({ version, onChange }: { version: 1 | 2; onChange: (version: 1 | 2) => void }) {
  return <div className="mf-row mf-wrap mf-tree-version-tabs" role="tablist" aria-label="地图版本">
    {([2, 1] as const).map(value => <Button key={value} role="tab" aria-selected={version === value}
      tabIndex={version === value ? 0 : -1} variant={version === value ? 'primary' : 'secondary'}
      onClick={() => onChange(value)} onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault(); onChange(value === 2 ? 1 : 2);
        const sibling = value === 2 ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
        if (sibling instanceof HTMLElement) sibling.focus();
      }}>{value === 2 ? '新版本树（高质量）' : '旧版本树（低质量）'}</Button>)}
  </div>;
}
