import { useEffect } from 'react';

interface LogoutConfirmDialogProps {
  open: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmDialog({
  open,
  pending,
  error,
  onCancel,
  onConfirm,
}: LogoutConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭确认窗口"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="确认退出登录"
        className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-slate-100">确认退出登录？</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          退出后需要再次登录才能访问个人技能树和知识聊天。
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            aria-label="取消退出"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            aria-label="确认退出"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-xl bg-rose-400 px-3 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-300 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? '退出中…' : '确认退出'}
          </button>
        </div>
      </section>
    </div>
  );
}
