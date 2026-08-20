import { useEffect, type ReactNode } from 'react';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        data-testid="mobile-drawer-overlay"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="功能菜单"
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-xs flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
