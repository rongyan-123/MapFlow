interface AnnouncementDialogProps {
  announcementId: string;
  title: string;
  content: string;
  remaining: number;
  pending?: boolean;
  onDismiss: () => void;
  onClose: () => void;
}

export default function AnnouncementDialog({
  announcementId,
  title,
  content,
  remaining,
  pending = false,
  onDismiss,
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
        <div className="mt-4 flex justify-end">
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
