import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminAnnouncement,
  deleteAdminAnnouncement,
  fetchAdminAnnouncements,
} from './adminClient';

export default function AnnouncementsTab({ csrfToken }: { csrfToken: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => fetchAdminAnnouncements(csrfToken),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => createAdminAnnouncement(title.trim(), content.trim(), csrfToken),
    onSuccess: () => {
      setTitle('');
      setContent('');
      setLocalError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
  const remove = useMutation({
    mutationFn: (announcementId: string) =>
      deleteAdminAnnouncement(announcementId, csrfToken),
    // 无论成败都退出确认态：失败由顶部横幅提示，成功由列表刷新体现。
    onSettled: () => setConfirmingId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setLocalError('标题与内容都不能为空。');
      return;
    }
    setLocalError(null);
    create.mutate();
  };

  return (
    <section>
      {remove.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-sm leading-6 text-rose-300"
        >
          {readableError(remove.error)}
        </p>
      )}
      <form
        onSubmit={submitForm}
        className="mb-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4"
      >
        <h2 className="text-sm font-semibold text-slate-100">发布公告</h2>
        <input
          aria-label="公告标题"
          required
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="标题（100 字以内）"
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
        />
        <textarea
          aria-label="公告内容"
          required
          maxLength={5000}
          rows={4}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="内容（5000 字以内）"
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
        />
        {localError && <p className="mt-2 text-xs text-rose-300">{localError}</p>}
        {create.error && (
          <p role="alert" className="mt-2 text-xs text-rose-300">
            {create.error.message}
          </p>
        )}
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-3 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {create.isPending ? '发布中…' : '发布'}
        </button>
      </form>

      {query.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">正在读取公告…</p>
      ) : query.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-rose-300">
          {query.error.message}
        </p>
      ) : query.data?.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">暂无公告。</p>
      ) : (
        <div className="space-y-2">
          {query.data?.map((item) => (
            <article
              key={item.announcementId}
              className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-[10px] text-slate-600">
                    {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.readCount} 人已读
                  </p>
                </div>
                {confirmingId === item.announcementId ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-rose-300">确认删除？</span>
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(item.announcementId)}
                      className="rounded-lg bg-rose-500/80 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
                    >
                      {remove.isPending ? '删除中…' : '确认删除'}
                    </button>
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-50"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(item.announcementId)}
                    className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/10"
                  >
                    删除
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '管理服务暂时不可用，请稍后再试。';
}
