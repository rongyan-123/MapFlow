import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminFeedback } from './adminClient';

const PAGE_SIZE = 20;

export default function FeedbackTab({ csrfToken }: { csrfToken: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['admin', 'feedback', offset],
    queryFn: () => fetchAdminFeedback(csrfToken, PAGE_SIZE, offset),
    retry: false,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">用户反馈</h2>
        <p className="text-xs text-slate-500">共 {query.data?.total ?? 0} 条</p>
      </div>
      {query.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">正在读取反馈…</p>
      ) : query.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-rose-300">
          {query.error.message}
        </p>
      ) : query.data?.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">暂无反馈。</p>
      ) : (
        <div className="space-y-2">
          {query.data?.items.map((item) => (
            <article
              key={item.feedbackId}
              className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-cyan-300">{item.username}</span>
                <span className="text-[10px] text-slate-600">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {item.content}
              </p>
            </article>
          ))}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={(query.data?.total ?? 0) <= offset + PAGE_SIZE}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
