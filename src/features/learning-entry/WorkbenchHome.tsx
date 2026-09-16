import { getTreeGuide } from './learningEntry';
import type { PersonalLibraryEntry } from '../tree-library/types';
import type { SkillTree } from '../../types/learning';

interface WorkbenchHomeProps {
  mode: 'public' | 'personal';
  publicTrees: SkillTree[];
  personalEntries: PersonalLibraryEntry[];
  personalLibraryPending?: boolean;
  personalLibraryError?: string | null;
  onRetryPersonalLibrary?: () => void;
  onOpenPublicTree: (treeId: string) => void;
  onContinuePersonalTree: (libraryEntryId: string) => void;
  onCreateTree: () => void;
  createTreeDisabled?: boolean;
  createTreeLabel?: string;
}

export default function WorkbenchHome({
  mode,
  publicTrees,
  personalEntries,
  personalLibraryPending = false,
  personalLibraryError = null,
  onRetryPersonalLibrary,
  onOpenPublicTree,
  onContinuePersonalTree,
  onCreateTree,
  createTreeDisabled = false,
  createTreeLabel = '创建自己的地图',
}: WorkbenchHomeProps) {
  const hasPersonalTrees = personalEntries.length > 0;
  const showPersonalEmptyState =
    mode === 'personal' &&
    !personalLibraryPending &&
    !personalLibraryError &&
    !hasPersonalTrees;

  return (
    <main data-testid="workbench-home" className="mapflow-workbench">
      <div className="mapflow-workbench__inner">
        <header className="mapflow-workbench__heading">
          <div>
            <h1 className="mapflow-workbench__title">
              {mode === 'public' ? '选择一个学习方向' : '我的学习地图'}
            </h1>
            <p className="mapflow-workbench__lede">
              {mode === 'public'
                ? '从一个具体领域开始，先看清它有哪些关系。'
                : '在地图里继续探索，记录新的理解。'}
            </p>
          </div>
          <button
            type="button"
            data-mapflow-onboarding-target="generate-map"
            onClick={onCreateTree}
            disabled={createTreeDisabled}
            className="mapflow-console-secondary-button"
          >
            {createTreeLabel}
          </button>
        </header>

        {mode === 'personal' && personalLibraryPending && (
          <section role="status" className="mapflow-status-card">
            <p>正在读取学习地图…</p>
          </section>
        )}

        {mode === 'personal' && personalLibraryError && (
          <section role="alert" className="mapflow-status-card mapflow-status-card--error">
            <p>{personalLibraryError}</p>
            {onRetryPersonalLibrary && (
              <button
                type="button"
                onClick={onRetryPersonalLibrary}
                className="mapflow-console-secondary-button mapflow-console-secondary-button--dark"
              >
                重新加载
              </button>
            )}
          </section>
        )}

        {hasPersonalTrees && (
          <section
            className="mapflow-continue-section"
            aria-labelledby="continue-learning-title"
          >
            <div className="mapflow-section-heading">
              <h2 id="continue-learning-title">继续学习</h2>
              <span>已保存的真实进度</span>
            </div>
            <div className="mapflow-continue-list">
              {personalEntries.map((entry) => (
                <PersonalTreeRow
                  key={entry.library_entry_id}
                  entry={entry}
                  onContinue={onContinuePersonalTree}
                />
              ))}
            </div>
          </section>
        )}

        {showPersonalEmptyState && (
          <section className="mapflow-empty-state">
            <h2>还没有自己的学习地图</h2>
            <p>从下面选一个方向，加入后记录你的进度。</p>
          </section>
        )}

        {(mode === 'public' || showPersonalEmptyState) && (
          <section className="mapflow-directions-section" aria-labelledby="public-directions-title">
            <div className="mapflow-section-heading">
              <h2 id="public-directions-title">学习方向</h2>
              <span>先看简介，再决定下一步</span>
            </div>
            {publicTrees.length > 0 ? (
              <div className="mapflow-direction-grid">
                {publicTrees.map((tree) => (
                  <PublicTreeCard
                    key={tree.id}
                    tree={tree}
                    onOpen={onOpenPublicTree}
                  />
                ))}
              </div>
            ) : (
              <p className="mapflow-empty-state mapflow-empty-state--compact">
                暂时没有可探索的方向。
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function PublicTreeCard({
  tree,
  onOpen,
}: {
  tree: SkillTree;
  onOpen: (treeId: string) => void;
}) {
  const guide = getTreeGuide(tree);

  return (
    <article className="mapflow-direction-card">
      <div className="mapflow-direction-card__topline">
        <h2>{guide.displayTitle}</h2>
        <span>{tree.total_nodes} 个知识点</span>
      </div>
      <p className="mapflow-direction-card__audience">{guide.audience}</p>
      <button
        type="button"
        aria-label={`查看 ${tree.title} 简介`}
        data-mapflow-onboarding-target="map-entry"
        onClick={() => onOpen(tree.id)}
        className="mapflow-direction-card__action"
      >
        查看方向
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function PersonalTreeRow({
  entry,
  onContinue,
}: {
  entry: PersonalLibraryEntry;
  onContinue: (libraryEntryId: string) => void;
}) {
  const guide = getTreeGuide(entry.tree);
  const totalNodes = Math.max(entry.tree.total_nodes, 0);
  const completedNodes = Math.min(Math.max(entry.completed_nodes, 0), totalNodes);
  const progress = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

  return (
    <article className="mapflow-continue-row">
      <div className="mapflow-continue-row__content">
        <h3>{guide.displayTitle}</h3>
        <p>{entry.tree.topic}</p>
        <div className="mapflow-progress-line">
          <div
            className="mapflow-progress-line__track"
            role="progressbar"
            aria-label={`${guide.displayTitle} 学习进度`}
            aria-valuemin={0}
            aria-valuemax={totalNodes}
            aria-valuenow={completedNodes}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>
            {entry.completed_nodes} / {entry.tree.total_nodes} 个节点已完成
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label={`继续探索 ${entry.tree.title}`}
        data-mapflow-onboarding-target="map-entry"
        onClick={() => onContinue(entry.library_entry_id)}
        className="mapflow-continue-row__action"
      >
        继续探索
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}
