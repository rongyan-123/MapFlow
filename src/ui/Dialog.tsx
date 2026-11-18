import { useEffect, useLayoutEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { floatingLayout } from './floatingLayout';
import { IconButton } from './Button';

const dialogOpeners = new WeakMap<HTMLElement, HTMLElement | null>();

export interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  layout?: 'dialog' | 'workspace' | 'drawer';
  headerLeading?: ReactNode;
  navigation?: ReactNode;
  navigationRef?: RefObject<HTMLElement>;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ title, children, onClose, dismissible = true, layout = 'dialog', headerLeading, navigation, navigationRef, footer, className = '' }: DialogProps) {
  const floating=layout!=='drawer';
  const labelId = useId();
  const openerRef=useRef<HTMLElement|null>(document.activeElement instanceof HTMLElement?document.activeElement:null);
  const parentDialog = openerRef.current?.closest<HTMLElement>('.mf-dialog');
  const fallbackOpener = useRef(parentDialog ? dialogOpeners.get(parentDialog) : null);
  const anchorRect=useRef(openerRef.current?.getBoundingClientRect());
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
    const opener = openerRef.current;
    if (panel.current) dialogOpeners.set(panel.current, fallbackOpener.current ?? opener);
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer.current && (!floating || element.classList.contains('mf-modal-layer')));
    const inertStates = siblings.map(element => ({ element, inert: element.inert }));
    siblings.forEach(element => { element.inert = true; });
    if(!floating)document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]') ?? [])
      .filter(element => !element.closest('[hidden]') && getComputedStyle(element).display !== 'none');
    (focusable()[0] ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (layer.current?.inert) return;
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
      if(!floating)document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
      else if (fallbackOpener.current?.isConnected) fallbackOpener.current.focus();
    };
  }, []);
  useLayoutEffect(()=>{
    if(!floating||!panel.current||!layer.current)return;
    const element=panel.current;
    const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const place=()=>{
      const visual=window.visualViewport;
      const viewport={width:visual?.width||window.innerWidth,height:visual?.height||window.innerHeight,x:visual?.offsetLeft||0,y:visual?.offsetTop||0};
      const anchor=anchorRect.current;
      const rect=anchor&&anchor.width?anchor:{left:viewport.width/2,right:viewport.width/2,top:viewport.height/3,bottom:viewport.height/3};
      const width=className.includes('model-settings')?540:layout==='workspace'?820:620;
      element.style.width=`${Math.min(width,viewport.width-24)}px`;
      const content=element.querySelector<HTMLElement>('.mf-dialog-content');
      const contentHeight=(content?.scrollHeight??400)+(element.querySelector('.mf-dialog-header')?.clientHeight??66)+(element.querySelector('.mf-dialog-footer')?.clientHeight??0);
      const bounds=floatingLayout(rect,viewport,width,contentHeight,className.includes('model-settings')?'left':'right');
      Object.assign(element.style,{left:`${bounds.left}px`,top:`${bounds.top}px`,height:`${bounds.height}px`,transformOrigin:`${bounds.originX}px ${bounds.originY}px`});
    };
    place();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(place);
    const content=element.querySelector('.mf-dialog-content');if(content)observer?.observe(content);
    window.addEventListener('resize',place);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
    const opening=!reduce()&&element.animate?.([{transform:'scale(.025,.018)',opacity:.3,borderRadius:'90px'},{transform:'scale(1.012,.985)',opacity:1,borderRadius:'20px',offset:.82},{transform:'scale(1)',opacity:1,borderRadius:'16px'}],{duration:420,easing:'cubic-bezier(.22,.8,.22,1)'});
    const inner=element.querySelector<HTMLElement>('.mf-dialog-body');
    const revealing=!reduce()&&inner?.animate?.([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:110,fill:'backwards'});
    const outside=(event:MouseEvent)=>{if(layer.current?.inert||!canDismiss.current||element.contains(event.target as Node))return;close.current();};
    document.addEventListener('mousedown',outside);
    return()=>{
      observer?.disconnect();window.removeEventListener('resize',place);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);document.removeEventListener('mousedown',outside);
      if(!reduce()&&typeof element.animate==='function'){
        const ghost=element.cloneNode(true) as HTMLElement;
        const transform=getComputedStyle(element).transform;
        ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('role');ghost.removeAttribute('id');
        ghost.querySelectorAll('[id]').forEach(child=>child.removeAttribute('id'));
        // Animation-only controls must never join a live radio group or form.
        ghost.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('input,select,textarea,button').forEach(control=>{
          control.removeAttribute('name');control.removeAttribute('form');control.disabled=true;
        });
        ghost.classList.add('mf-floating-exit');ghost.style.pointerEvents='none';ghost.style.zIndex='1000';
        queueMicrotask(()=>{
          // React StrictMode rehearses cleanup without removing the live card.
          if(element.isConnected)return;
          document.body.append(ghost);
          const exit=ghost.animate([{transform:transform==='none'?'scale(1)':transform,opacity:1},{transform:'scale(.025,.018)',opacity:0,borderRadius:'90px'}],{duration:300,easing:'cubic-bezier(.4,0,.7,.2)',fill:'forwards'});
          ghost.querySelector<HTMLElement>('.mf-dialog-body')?.animate?.([{opacity:1},{opacity:0}],{duration:110,fill:'forwards'});
          const fallback=window.setTimeout(()=>ghost.remove(),350);
          exit.finished.then(()=>{clearTimeout(fallback);ghost.remove();},()=>{clearTimeout(fallback);ghost.remove();});
        });
      }
      if(opening)opening.cancel();if(revealing)revealing.cancel();
    };
  },[floating]);
  return createPortal(<div ref={layer} role="presentation" className={`mf-modal-layer mf-modal-layer--${layout} ${floating?'mf-floating-layer':''}`} onMouseDown={event => { if (event.target === event.currentTarget && canDismiss.current) close.current(); }}>
    <section ref={panel} className={`mf-dialog mf-dialog--${layout} ${floating?'mf-floating-card':''} ${className}`} role="dialog" aria-modal={floating?undefined:true} aria-labelledby={labelId} tabIndex={-1}>
      <div className="mf-dialog-header">{headerLeading}<h2 id={labelId}>{title}</h2><IconButton icon="close" label="关闭" disabled={!dismissible} onClick={onClose} /></div>
      <div className="mf-dialog-body">{navigation && <nav ref={navigationRef} className="mf-dialog-navigation">{navigation}</nav>}<div className="mf-dialog-content">{children}</div></div>
      {footer && <div className="mf-dialog-footer">{footer}</div>}
    </section>
  </div>, document.body);
}
