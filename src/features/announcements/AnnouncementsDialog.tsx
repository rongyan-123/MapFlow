import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { getAnnouncements } from './announcementsClient';

export default function AnnouncementsDialog({ onClose }: { onClose: () => void }) {
  const { session } = useIdentity();
  const query = useQuery({
    queryKey: ['announcements', session?.account.playerId ?? null],
    queryFn: getAnnouncements,
    staleTime: 30 * 1000,
  });

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
        aria-labelledby="announcements-dialog-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              MapFlow
            </p>
            <h2 id="announcements-dialog-title" className="mt-1 text-base font-semibold text-white">
              全部公告
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭公告列表"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {query.isPending ? (
            <p className="py-8 text-center text-sm text-slate-500">正在读取公告…</p>
          ) : query.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-rose-300">
              {query.error.message}
            </p>
          ) : query.data?.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">暂无公告。</p>
          ) : (
            query.data?.items.map((item) => (
              <article
                key={item.announcementId}
                className="mb-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.isRead
                        ? 'border border-slate-700 text-slate-500'
                        : 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                    }`}
                  >
                    {item.isRead ? '已读' : '未读'}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                  {item.content}
                </p>
                <p className="mt-2 text-[10px] text-slate-600">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
