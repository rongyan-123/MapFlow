import type { Navigate } from '../app/useLocation';
import { usePersonalCatalog } from '../domains/maps/useMapCatalog';
import { useMapActions } from '../domains/maps/useMapActions';
import { describePublicError } from '../lib/publicErrors';
import { Button } from './Button';

export function HomeLearningLinks({ accountId, csrfToken, navigate }: { accountId: string; csrfToken: string; navigate: Navigate }) {
  const { catalog } = usePersonalCatalog(accountId);
  const actions = useMapActions({ accountId, csrfToken, onDeleted: () => {}, onLearning: area => navigate(`/learning?area=${encodeURIComponent(area.areaId)}`) });
  const entries = catalog.data?.entries ?? [];
  if (catalog.isPending) return <p role="status" className="mf-home-return mf-muted">正在读取我的学习…</p>;
  if (catalog.error) return <p role="alert" className="mf-home-return mf-status">{describePublicError(catalog.error)} <Button onClick={() => void catalog.refetch()}>重试读取我的学习</Button></p>;
  if (!entries.length) return <div className="mf-row mf-row--between mf-wrap mf-home-return"><Button variant="quiet" onClick={() => navigate('/library')}>去公共书库找地图 →</Button><Button variant="quiet" onClick={() => navigate('/maps')}>我的学习 →</Button></div>;
  return <section className="mf-home-return" aria-label="继续学习"><div className="mf-row mf-row--between"><h2>继续学习</h2><Button variant="quiet" onClick={() => navigate('/maps')}>查看全部 →</Button></div>
    <div className="mf-home-return-grid">{entries.slice(0, 4).map(entry => <article className="mf-card" key={entry.library_entry_id}><div className="mf-row mf-row--between"><div><h3>{entry.tree.title}</h3><p className="mf-muted mf-small">{entry.completed_nodes} / {entry.tree.total_nodes} 个知识点已完成</p></div><Button disabled={actions.learning.isPending} onClick={() => actions.openLearning(undefined, entry.library_entry_id)}>继续学习</Button></div><progress aria-label={`${entry.tree.title}学习进度`} max={100} value={entry.progress_percent ?? 0} /></article>)}</div>
    {!!actions.learning.error && <p role="alert" className="mf-status">{describePublicError(actions.learning.error)}</p>}
  </section>;
}
