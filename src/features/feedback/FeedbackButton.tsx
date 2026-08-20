import { useState } from 'react';
import { useIdentity } from '../identity/IdentityContext';
import FeedbackDialog from './FeedbackDialog';

export default function FeedbackButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  if (!session) return null;
  return (
    <>
      <button
        type="button"
        aria-label="意见反馈"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition hover:border-cyan-600 hover:text-white max-lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        意见反馈
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}
