import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { submitFeedback } from './feedbackClient';

export default function FeedbackButton() {
  const { session } = useIdentity();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: () => submitFeedback(content, session?.csrfToken ?? ''),
    onSuccess: () => {
      setDone(true);
      setContent('');
    },
  });

  if (!session) return null;

  const close = () => {
    if (submit.isPending) return;
    setOpen(false);
    setDone(false);
    submit.reset();
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    submit.mutate();
  };

  return (
    <>
      <button
        type="button"
        aria-label="意见反馈"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg transition hover:border-cyan-600 hover:text-white"
      >
        意见反馈
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 id="feedback-dialog-title" className="text-base font-semibold text-white">
              意见反馈
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              功能建议、遇到的问题，或者任何想说的话。
            </p>
            {done ? (
              <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                已收到你的反馈，感谢！
              </p>
            ) : (
              <form onSubmit={submitForm} className="mt-4">
                <textarea
                  autoFocus
                  aria-label="反馈内容"
                  required
                  maxLength={2000}
                  rows={5}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="写点什么…"
                />
                {submit.error && (
                  <p role="alert" className="mt-2 text-xs text-rose-300">
                    {submit.error.message}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submit.isPending || !content.trim()}
                    className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submit.isPending ? '提交中…' : '提交反馈'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
