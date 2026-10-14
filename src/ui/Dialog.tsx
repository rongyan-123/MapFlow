import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

export interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  layout?: 'dialog' | 'workspace' | 'drawer';
  navigation?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ title, children, onClose, dismissible = true, layout = 'dialog', navigation, footer, className = '' }: DialogProps) {
  const labelId = useId();
  const panel = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const canDismiss = useRef(dismissible);
  close.current = onClose;
  canDismiss.current = dismissible;
  useEffect(()=>{
    const update=()=>{const viewport=window.visualViewport;layer.current?.style.setProperty('--mf-viewport-height',`${viewport?.height||window.innerHeight}px`);layer.current?.style.setProperty('--mf-viewport-offset',`${viewport?.offsetTop||0}px`);};
    update();window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
    return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);};
  },[]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer.current);
    const inertStates = siblings.map(element => ({ element, inert: element.inert }));
    siblings.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]') ?? [])
      .filter(element => !element.closest('[hidden]') && getComputedStyle(element).display !== 'none');
    (focusable()[0] ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canDismiss.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      inertStates.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return createPortal(<div ref={layer} role="presentation" className={`mf-modal-layer mf-modal-layer--${layout}`} onMouseDown={event => { if (event.target === event.currentTarget && canDismiss.current) close.current(); }}>
    <section ref={panel} className={`mf-dialog mf-dialog--${layout} ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>
      <div className="mf-dialog-header"><h2 id={labelId}>{title}</h2><IconButton icon="close" label="关闭" disabled={!dismissible} onClick={onClose} /></div>
      <div className="mf-dialog-body">{navigation && <nav className="mf-dialog-navigation">{navigation}</nav>}<div className="mf-dialog-content">{children}</div></div>
      {footer && <div className="mf-dialog-footer">{footer}</div>}
    </section>
  </div>, document.body);
}
