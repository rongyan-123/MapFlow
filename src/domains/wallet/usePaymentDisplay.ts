import { describePublicError } from '../../lib/publicErrors';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { updatePaymentDisplay, type PaymentDisplay, type PaymentChannel } from '../../api/walletClient';

export function usePaymentDisplay({ topupId, channel, csrfToken, releasePending: sharedRelease }: { topupId: string; channel: PaymentChannel; csrfToken: string; releasePending?: MutableRefObject<Promise<void>> }) {
  const [display, setDisplay] = useState<PaymentDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const currentWindow = useRef<string | null>(null);
  const fallbackRelease = useRef<Promise<void>>(Promise.resolve());
  const releasePending = sharedRelease ?? fallbackRelease;

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;
    let countdown: number | undefined;
    currentWindow.current = null;
    setDisplay(null); setError(null);
    const leave = async (windowId: string) => {
      try { await updatePaymentDisplay(topupId, { action: 'leave', windowId }, csrfToken); } catch { /* The server deadline still bounds this window. */ }
    };
    async function refresh(action: 'join' | 'poll') {
      if (action === 'join') await releasePending.current;
      if (disposed) return;
      const started = performance.now();
      try {
        const reply = await updatePaymentDisplay(topupId, { action, ...(currentWindow.current ? { windowId: currentWindow.current } : {}) }, csrfToken);
        if (disposed) return;
        currentWindow.current = reply.windowId;
        setDisplay(reply); setError(null);
        if (countdown !== undefined) window.clearInterval(countdown);
        if (reply.status === 'active' && reply.expiresAt) {
          // Server duration plus monotonic browser time; network latency only shortens display.
          const deadline = started + Date.parse(reply.expiresAt) - Date.parse(reply.serverNow);
          const tick = () => {
            const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
            setRemaining(seconds);
            if (!seconds) { setDisplay({ ...reply, status: 'expired', imageUrl: null }); window.clearInterval(countdown); }
          };
          tick(); countdown = window.setInterval(tick, 250);
        }
        if (reply.status === 'active' || reply.status === 'waiting') pollTimer = window.setTimeout(() => void refresh('poll'), 2000);
      } catch (failure) {
        if (disposed) return;
        if (countdown !== undefined) window.clearInterval(countdown);
        setDisplay(null);
        setError(describePublicError(failure));
      }
    }
    void refresh('join');
    return () => {
      disposed = true;
      window.clearTimeout(pollTimer); window.clearInterval(countdown);
      if (currentWindow.current) releasePending.current = leave(currentWindow.current);
    };
  }, [topupId, csrfToken, revision, releasePending]);

  return {display,error,remaining,retry: () => setRevision(value => value + 1)};
}
