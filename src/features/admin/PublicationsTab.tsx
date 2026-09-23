import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAdminPublications, removeAdminPublication } from './adminClient';

export default function PublicationsTab({ csrfToken }: { csrfToken: string }) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'publications'],
    queryFn: () => fetchAdminPublications(csrfToken),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeAdminPublication(id, csrfToken),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin', 'publications'] }),
    onSettled: () => setConfirming(null),
  });
  if (query.isPending) return <p className="py-8 text-center text-sm text-slate-500">正在读取公共树…</p>;
  if (query.isError) return <p role="alert" className="py-8 text-center text-sm text-rose-300">{query.error.message}</p>;
  return <section>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">公共树治理</h2><span className="text-xs text-slate-500">共 {query.data.total} 个版本</span></div>
    {remove.error && <p role="alert" className="mb-3 text-sm text-rose-300">{remove.error.message}</p>}
    <div className="space-y-2">{query.data.items.map(item => <article key={item.publicationId} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4">
      <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-100">{item.title}</p><p className="mt-1 text-xs text-slate-500">发布者 {item.publisherDisplayName} · {item.state} · {new Date(item.publishedAt).toLocaleString('zh-CN')}</p></div>
      {item.state === 'active' && (confirming === item.publicationId
        ? <><button type="button" onClick={() => remove.mutate(item.publicationId)} className="rounded-lg bg-rose-400 px-3 py-2 text-xs font-bold text-rose-950">确认下架</button><button type="button" onClick={() => setConfirming(null)} className="text-xs text-slate-400">取消</button></>
        : <button type="button" onClick={() => setConfirming(item.publicationId)} className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-300">下架</button>)}
    </article>)}</div>
  </section>;
}
