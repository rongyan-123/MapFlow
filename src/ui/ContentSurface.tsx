import { Dialog, type DialogProps } from './Dialog';

/** Reuse the same live content in a page/panel or a contextual card. */
export function ContentSurface({ embedded = false, ...props }: DialogProps & { embedded?: boolean }) {
  if (!embedded) return <Dialog {...props} />;
  return <section className={`mf-embedded-surface ${props.className ?? ''}`} aria-label={props.title}>
    {props.navigation}
    <div className="mf-embedded-content">{props.children}</div>
    {props.footer && <div className="mf-embedded-footer">{props.footer}</div>}
  </section>;
}
