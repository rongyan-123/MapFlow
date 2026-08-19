import { useState } from 'react';
import { useIdentity } from '../identity/IdentityContext';
import AnnouncementsDialog from './AnnouncementsDialog';

export default function AnnouncementsButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  if (!session) return null;
  return (
    <>
      <button
        type="button"
        aria-label="查看公告"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
      >
        公告
      </button>
      {open && <AnnouncementsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
