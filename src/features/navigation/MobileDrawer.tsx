import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  desktopVisible?: boolean;
}

export default function MobileDrawer({ open, onClose, children, desktopVisible = false }: MobileDrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer.current);
    const previousInert = background.map(element => element.hasAttribute('inert'));
    document.body.style.overflow = 'hidden';
    background.forEach(element => element.setAttribute('inert', ''));
    function focusable() {
      return Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]') ?? [])
        .filter(element => !element.closest('[hidden]') && (!element.closest('details:not([open])') || element.tagName === 'SUMMARY'));
    }
    (focusable()[0] ?? panel.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => { if (!previousInert[index]) element.removeAttribute('inert'); });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div ref={layer} className={`mobile-drawer-layer fixed inset-0 z-[2147483647] ${desktopVisible ? '' : 'lg:hidden'}`}>
      <div
        data-testid="mobile-drawer-overlay"
        className="absolute inset-0 bg-slate-950/70"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel} tabIndex={-1} role="dialog"
        aria-modal="true"
        aria-label="功能菜单"
        className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>, document.body
  );
}
