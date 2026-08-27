interface AnnouncementDialogProps {
  announcementId: string;
  title: string;
  content: string;
  remaining: number;
  pending?: boolean;
  bulkPending?: boolean;
  error?: string | null;
  onDismiss: () => void;
  onDismissAll?: () => void;
  onClose: () => void;
}

export default function AnnouncementDialog({
  announcementId,
  title,
  content,
  remaining,
  pending = false,
  bulkPending = false,
  error = null,
  onDismiss,
  onDismissAll,
  onClose,
}: AnnouncementDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-dialog-title"
        className="w-full max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
          公告 · 剩余 {remaining} 条未读
        </p>
        <h2 id="announcement-dialog-title" className="mt-1 text-base font-semibold text-white">
          {title}
        </h2>
        <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">
          {content}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-xs leading-5 text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {remaining > 1 && onDismissAll && (
            <button
              type="button"
              aria-label="关闭全部公告"
              disabled={pending}
              onClick={onDismissAll}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/70 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkPending ? '关闭中…' : '关闭全部'}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onDismiss}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? '标记中…' : '知道了'}
          </button>
        </div>
      </section>
    </div>
  );
}
