import { useEffect } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';

export default function CompletionCelebration({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return <div className="mf-map-celebration">
    <div className="mf-map-celebration-rays" aria-hidden="true" />
    <div className="mf-map-celebration-sweep" aria-hidden="true" />
    <div className="mf-map-celebration-card">
      <div role="status" aria-live="polite"><span className="mf-map-celebration-mark" aria-hidden="true"><Icon name="check" /></span>
        <p className="mf-map-celebration-kicker">又向前走了一步</p><h2>此间事了</h2><p className="mf-map-celebration-title">{title}</p></div>
      <Button variant="quiet" onClick={onDismiss}>收下这一步</Button>
    </div>
  </div>;
}
