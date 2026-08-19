import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { signInForCredit, type CreditSummary } from './creditClient';

interface CreditPillProps {
  credit: CreditSummary | null;
  onSignedIn: () => void;
}

export default function CreditPill({ credit, onSignedIn }: CreditPillProps) {
  const { session } = useIdentity();
  const [notice, setNotice] = useState<string | null>(null);
  const signin = useMutation({
    mutationFn: () => signInForCredit(session?.csrfToken ?? ''),
    onSuccess: (result) => {
      setNotice(`签到成功，获得 ${result.awarded} 积分。`);
      onSignedIn();
    },
  });

  const signedInToday = credit?.signedInToday === true;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={signedInToday ? '今日已签到' : '签到领取积分'}
        disabled={signedInToday || signin.isPending}
        onClick={() => signin.mutate()}
        className="rounded-xl border border-cyan-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {signin.isPending
          ? '签到中…'
          : `积分 ${credit?.balance ?? 0} · ${signedInToday ? '已签到' : '签到'}`}
      </button>
      {notice && <p className="absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-emerald-300">{notice}</p>}
      {signin.error && (
        <p role="alert" className="absolute right-0 top-full z-40 mt-1 whitespace-nowrap rounded-lg border border-rose-700 bg-slate-900 px-3 py-1.5 text-xs text-rose-300">
          {signin.error.message}
        </p>
      )}
    </div>
  );
}
