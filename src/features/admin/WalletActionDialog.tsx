import { useEffect, useRef, useState, type ReactNode } from 'react';

export const walletButton = 'rounded-xl border border-slate-700 px-3.5 py-2 text-sm font-medium transition hover:border-cyan-500 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40';
export const walletInput = 'mt-2 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-50';
export const walletPrimaryButton = `${walletButton} border-cyan-300/70 bg-cyan-300 text-slate-950 hover:bg-cyan-200 hover:text-slate-950`;

interface WalletActionDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  noteLabel?: string;
  noteRequired?: boolean;
  needsPassword?: boolean;
  onConfirm: (confirmation: { password: string; note: string }) => Promise<void>;
  onClose: () => void;
}

export default function WalletActionDialog({ title, children, confirmLabel, noteLabel = '备注（选填）', noteRequired = false, needsPassword = true, onConfirm, onClose }: WalletActionDialogProps) {
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lock.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),button:not(:disabled)');
      if (!focusable?.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, []);

  async function confirm() {
    if (lock.current) return;
    if (noteRequired && !note.trim()) { setError(`请填写${noteLabel}。`); return; }
    if (needsPassword && !password) { setError('请输入管理员登录密码。'); return; }
    lock.current = true;
    setBusy(true);
    setError(null);
    const confirmation = { password, note: note.trim() };
    setPassword('');
    try { await onConfirm(confirmation); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !lock.current) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={title} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-300">{children}</div>
      <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void confirm(); }}>
        {needsPassword && <label className="block text-sm text-slate-300">管理员登录密码<input type="password" autoComplete="off" aria-label="管理员登录密码" className={walletInput} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>}
        <label className="block text-sm text-slate-300">{noteLabel}<textarea aria-label={noteLabel} className={`${walletInput} resize-y`} rows={2} maxLength={240} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
        {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-1"><button type="button" className={walletButton} disabled={busy} onClick={onClose}>取消</button><button type="submit" className={walletPrimaryButton} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button></div>
      </form>
    </div>
  </div>;
}
