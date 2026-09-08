import { getTreeGuide } from './learningEntry';
import type { SkillTree } from '../../types/learning';

interface TreeIntroductionProps {
  tree: SkillTree;
  onBack: () => void;
  onStartExploring: (question: string) => void;
  onPreviewMap: () => void;
}

export default function TreeIntroduction({
  tree,
  onBack,
  onStartExploring,
  onPreviewMap,
}: TreeIntroductionProps) {
  const guide = getTreeGuide(tree);

  return (
    <section
      data-testid="tree-introduction"
      className="mapflow-introduction"
      aria-labelledby="tree-introduction-title"
    >
      <div className="mapflow-introduction__inner">
        <button
          type="button"
          aria-label="返回工作台"
          onClick={onBack}
          className="mapflow-back-link"
        >
          ← 返回工作台
        </button>

        <div className="mapflow-introduction__heading">
          <h1 id="tree-introduction-title">{guide.displayTitle}</h1>
          <p>{guide.summary}</p>
        </div>

        <div className="mapflow-introduction__facts">
          <InfoBlock title="适合谁" detail={guide.audience} />
          <InfoBlock title="需要基础" detail={guide.prerequisites.join(' · ')} />
        </div>

        <section className="mapflow-recommended" aria-labelledby="recommended-start-title">
          <div className="mapflow-recommended__heading">
            <p>推荐起点</p>
            <h2 id="recommended-start-title">
              {guide.recommendedNodeTitle ?? '从地图中选择一个节点'}
            </h2>
          </div>
          <p className="mapflow-recommended__question">{guide.question}</p>
          <div className="mapflow-introduction__actions">
            <button
              type="button"
              onClick={() => onStartExploring(guide.question)}
              className="mapflow-console-primary-button"
            >
              开始探索
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={onPreviewMap}
              className="mapflow-console-secondary-button"
            >
              先看地图
            </button>
          </div>
          <p className="mapflow-recommended__note">
            地图可直接浏览，加入后记录个人进度。
          </p>
        </section>
      </div>
    </section>
  );
}

function InfoBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mapflow-info-block">
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
