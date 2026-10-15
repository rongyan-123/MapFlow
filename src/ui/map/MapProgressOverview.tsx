import { progressPercentForNode, type LearningTreeSnapshot } from '../../types/learning';
import { Icon } from '../Icon';

export default function MapProgressOverview({ snapshot }: { snapshot: LearningTreeSnapshot }) {
  const progressByNode = new Map(snapshot.progress.map(progress => [progress.node_id, progress]));
  const percentages = snapshot.nodes.map(node => progressPercentForNode(progressByNode.get(node.id)));
  const completed = percentages.filter(percent => percent === 100).length;
  const inProgress = percentages.filter(percent => percent > 0 && percent < 100).length;
  const percent = percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : 0;

  return <footer className="mf-map-overview" aria-label="地图学习进度">
    <div className="mf-map-progress-value"><span>整体进度</span><strong>{percent}<small>%</small></strong></div>
    <div className="mf-map-progress-track" role="progressbar" aria-label="整体学习进度"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
    <div className="mf-map-progress-counts">
      <span className="mf-map-count--complete"><Icon name="check" />已完成 {completed}</span>
      <span className="mf-map-count--active"><Icon name="clock" />进行中 {inProgress}</span>
      <span className="mf-map-count--waiting"><i aria-hidden="true" />未开始 {percentages.length - completed - inProgress}</span>
    </div>
  </footer>;
}
