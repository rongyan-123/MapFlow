import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { describePublicError } from '../../lib/publicErrors';
import { createTopup, declarePaid, declareUnpaid, parseAmountFen, readWallet, type PaymentChannel, type Topup } from '../../api/walletClient';

export function useWallet(accountId: string, csrfToken: string) {
  const queryClient = useQueryClient();
  const walletKey = ['me', accountId, 'wallet'] as const;
  const [activeTopup, setActiveTopup] = useState<Topup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now);
  const wallet = useQuery({ queryKey: walletKey, queryFn: readWallet, retry: false,
    refetchInterval: activeTopup ? 2_000 : 15_000 });
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<PaymentChannel>('wechat');
  const selectedChannel = wallet.data?.channels.some(item => item.channel === channel)
    ? channel : wallet.data?.channels[0]?.channel ?? channel;
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [paidExitVisible, setPaidExitVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCreate = useRef<{ requestId: string; amountFen: number; channel: PaymentChannel } | null>(null);
  const lock = useRef(false);
  const paymentDisplayRelease = useRef<Promise<void>>(Promise.resolve());
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const paymentDialogRef = useRef<HTMLDivElement>(null);
  const paymentReturnFocusRef = useRef<HTMLElement | null>(null);
  const paymentExpired = !!activeTopup?.paymentExpiresAt && Date.parse(activeTopup.paymentExpiresAt) <= clockNow;
  useEffect(() => {
    if (!activeTopup?.paymentExpiresAt) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTopup?.topupId]);
  useEffect(() => {
    const current = wallet.data?.topups.find(item => item.topupId === activeTopup?.topupId);
    if (current?.status === 'credited') {
      setActiveTopup(null); setChoiceOpen(false); setNotice('充值已到账');
    }
  }, [wallet.data, activeTopup?.topupId]);
  useEffect(() => {
    if (!activeTopup) return;
    const dialog = paymentDialogRef.current;
    if (!dialog) return;
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!lock.current) setChoiceOpen(true);
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)'));
      const focusedIndex = controls.findIndex(control => control === document.activeElement);
      if (controls.length === 0) { event.preventDefault(); dialog.focus(); return; }
      if (focusedIndex === -1 || (event.shiftKey && focusedIndex === 0) || (!event.shiftKey && focusedIndex === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    };
    document.addEventListener('focusin', containFocus);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activeTopup?.topupId]);
  useEffect(() => {
    if (activeTopup) {
      // The same button position can become a payment declaration after a view change.
      paymentDialogRef.current?.focus();
    } else if (!busy && paymentReturnFocusRef.current) {
      const restoreTarget = [paymentReturnFocusRef.current, createButtonRef.current, backButtonRef.current]
        .find(element => element?.isConnected && !element.matches(':disabled'));
      restoreTarget?.focus();
      paymentReturnFocusRef.current = null;
    }
  }, [activeTopup?.topupId, choiceOpen, busy]);
  useEffect(() => { if (!activeTopup || choiceOpen) return; setPaidExitVisible(false); const timer = window.setTimeout(() => setPaidExitVisible(true), 5000); return () => window.clearTimeout(timer); }, [activeTopup?.topupId, choiceOpen]);
  useEffect(() => { setActiveTopup(null); setChoiceOpen(false); setError(null); setNotice(null); pendingCreate.current = null; paymentReturnFocusRef.current = null; }, [accountId]);
  async function create() {
    if (lock.current || activeTopup) return;
    const amountFen = parseAmountFen(amount);
    if (amountFen === null) { setError('请输入 0.01–10,000 元，最多两位小数。'); return; }
    if (!wallet.data?.channels.some(item => item.channel === selectedChannel && item.qrCodeId)) { setError('当前渠道收款码不可用，请选择其他渠道。'); return; }
    const input = pendingCreate.current?.amountFen === amountFen && pendingCreate.current.channel === selectedChannel
      ? pendingCreate.current : { requestId: crypto.randomUUID(), amountFen, channel: selectedChannel };
    paymentReturnFocusRef.current = createButtonRef.current;
    pendingCreate.current = input; lock.current = true; setBusy(true); setError(null); setNotice(null);
    try { const created = await createTopup(input, csrfToken); pendingCreate.current = null; setActiveTopup(created); setChoiceOpen(false); await queryClient.invalidateQueries({ queryKey: walletKey }); }
    catch (failure) { setError(describePublicError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function declare(paid: boolean) {
    if (!activeTopup || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await (paid ? declarePaid(activeTopup.topupId, csrfToken) : declareUnpaid(activeTopup.topupId, csrfToken)); setActiveTopup(null); setChoiceOpen(false); await queryClient.invalidateQueries({ queryKey: walletKey }); }
    catch (failure) { setError(describePublicError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return {wallet,activeTopup,setActiveTopup,notice,amount,setAmount,selectedChannel,setChannel,choiceOpen,setChoiceOpen,paidExitVisible,busy,error,setError,pendingCreate,paymentDisplayRelease,createButtonRef,backButtonRef,paymentDialogRef,paymentReturnFocusRef,paymentExpired,create,declare};
}
